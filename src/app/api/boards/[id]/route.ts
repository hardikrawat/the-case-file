import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { boards, boardVersions } from '@/lib/schema';
import { eq, and, isNull, desc } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { auth } from '@/auth';
import { getBoardAccess } from '@/lib/auth-checks';
import { checkRateLimit } from '@/lib/rate-limit';
import { awardPoints } from '@/lib/reputation';

export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimit = await checkRateLimit(`boards:update:${session.user.id}`, 60, 60000);
    if (!rateLimit.success) {
        return NextResponse.json({ error: 'Too many requests. Please wait.' }, { status: 429 });
    }

    try {
        const params = await props.params;
        const { id } = params;
        const body = await req.json();
        const { content, title, isPublic, thumbnail, version: clientVersion } = body;

        // 1. Fetch board access and ensure active (not soft-deleted)
        const access = await getBoardAccess(id, session.user.id);

        if (!access.board) {
            return NextResponse.json({ error: 'Board not found' }, { status: 404 });
        }

        // 2. Check Permissions
        if (!access.canEdit) {
            return NextResponse.json({ error: 'Forbidden: You do not have permission to edit this board' }, { status: 403 });
        }

        // Only owner can change board visibility
        if (isPublic !== undefined && !access.isOwner) {
            return NextResponse.json({ error: 'Forbidden: Only board owner can change visibility' }, { status: 403 });
        }

        // 3. Optimistic Concurrency Check
        const currentVersion = typeof access.board.version === 'number' ? access.board.version : 1;
        if (clientVersion !== undefined && clientVersion !== null) {
            if (typeof clientVersion === 'number' && clientVersion !== currentVersion) {
                return NextResponse.json(
                    {
                        error: 'Conflict: Board has been modified by another session',
                        currentVersion,
                        expectedVersion: clientVersion,
                    },
                    { status: 409 }
                );
            }
        }

        // 4. Increment Version
        const nextVersion = currentVersion + 1;
        const updateData: Record<string, unknown> = {
            updatedAt: new Date(),
            version: nextVersion,
        };

        if (content !== undefined) updateData.content = content;
        if (title !== undefined) {
            if (typeof title !== 'string' || title.trim().length === 0) {
                return NextResponse.json({ error: 'Case title cannot be empty' }, { status: 400 });
            }
            if (title.length > 120) {
                return NextResponse.json({ error: 'Case title cannot exceed 120 characters' }, { status: 400 });
            }
            updateData.title = title.trim();
        }
        if (isPublic !== undefined) {
            updateData.isPublic = isPublic;
            if (isPublic === true && !access.board.isPublic) {
                try {
                    await awardPoints(session.user.id, 'board_made_public');
                } catch (err) {
                    console.error('Failed to award points for board_made_public:', err);
                }
            }
        }
        if (thumbnail !== undefined) updateData.thumbnail = thumbnail;

        // Atomic update with version lock
        const conditions = [eq(boards.id, id), isNull(boards.deletedAt)];
        if (typeof clientVersion === 'number') {
            conditions.push(eq(boards.version, clientVersion));
        }

        const query = db.update(boards)
            .set(updateData)
            .where(and(...conditions));

        let updateResult: unknown = query;
        if ('returning' in query && typeof (query as { returning?: () => Promise<unknown> }).returning === 'function') {
            updateResult = await (query as { returning: () => Promise<unknown> }).returning();
        } else {
            updateResult = await query;
        }

        if (Array.isArray(updateResult) && updateResult.length === 0 && typeof clientVersion === 'number') {
            return NextResponse.json(
                {
                    error: 'Conflict: Board has been modified by another session',
                },
                { status: 409 }
            );
        }

        // 5. Create version snapshot in boardVersions table if content updated
        if (content !== undefined) {
            try {
                const lastVersion = await db.select()
                    .from(boardVersions)
                    .where(eq(boardVersions.boardId, id))
                    .orderBy(desc(boardVersions.createdAt))
                    .limit(1);

                const now = new Date();
                const lastTime = lastVersion[0]?.createdAt ? new Date(lastVersion[0].createdAt).getTime() : 0;
                
                // Snapshot if no previous version, or 30s elapsed, or node count changed (structural milestone)
                const lastNodes = Array.isArray((lastVersion[0]?.content as Record<string, unknown>)?.nodes) 
                    ? ((lastVersion[0]?.content as Record<string, unknown>).nodes as unknown[]).length 
                    : -1;
                const currentNodes = Array.isArray((content as Record<string, unknown>)?.nodes)
                    ? ((content as Record<string, unknown>).nodes as unknown[]).length
                    : -1;
                const structuralChange = lastNodes !== currentNodes;
                const shouldCreateVersion = lastVersion.length === 0 || (now.getTime() - lastTime > 30000) || structuralChange;

                if (shouldCreateVersion) {
                    await db.insert(boardVersions).values({
                        id: createId(),
                        boardId: id,
                        content: content as Record<string, unknown>,
                        createdBy: session.user.id,
                        createdAt: now,
                    });
                }
            } catch (verErr) {
                console.warn('Failed to snapshot board version:', verErr);
            }
        }

        return NextResponse.json({
            success: true,
            version: nextVersion,
        });
    } catch (error) {
        console.error('Error saving board:', error);
        return NextResponse.json({ error: 'Failed to save board' }, { status: 500 });
    }
}

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const { id } = params;
    const session = await auth();
    const currentUserId = session?.user?.id;

    const identifier = currentUserId || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';
    const rateLimit = await checkRateLimit(`boards:read:${identifier}`, 100, 60000);
    if (!rateLimit.success) {
        return NextResponse.json({ error: 'Too many requests. Please wait.' }, { status: 429 });
    }

    try {
        const access = await getBoardAccess(id, currentUserId);

        if (!access.board) {
            return NextResponse.json({ error: 'Board not found' }, { status: 404 });
        }

        if (access.canView) {
            let parentTitle: string | null = null;
            if (access.board.parentId) {
                try {
                    const parentBoard = await db.query.boards.findFirst({
                        where: and(eq(boards.id, access.board.parentId), isNull(boards.deletedAt)),
                        columns: { title: true },
                    });
                    if (parentBoard) {
                        parentTitle = parentBoard.title;
                    }
                } catch {
                    // non-critical
                }
            }

            return NextResponse.json({
                ...access.board,
                parentTitle,
                canEdit: access.canEdit,
                isOwner: access.isOwner,
            });
        }

        // Access Denied
        if (!currentUserId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        } else {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

    } catch (error) {
        console.error('Board fetch error:', error);
        return NextResponse.json({ error: 'Failed to fetch board' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const params = await props.params;
        const { id } = params;

        // 1. Fetch board to check existence, soft-delete status, and ownership
        const access = await getBoardAccess(id, session.user.id);

        if (!access.board) {
            return NextResponse.json({ error: 'Board not found' }, { status: 404 });
        }

        // 2. Check Permissions: Only the board owner can delete the board
        if (!access.isOwner) {
            return NextResponse.json({ error: 'Forbidden: Only the board owner can delete this board' }, { status: 403 });
        }

        // 3. Soft-delete the board
        await db.update(boards)
            .set({ 
                deletedAt: new Date(),
                updatedAt: new Date()
            })
            .where(and(eq(boards.id, id), isNull(boards.deletedAt)));

        return NextResponse.json({ success: true, message: 'Board deleted successfully' });
    } catch (error) {
        console.error('Error deleting board:', error);
        return NextResponse.json({ error: 'Failed to delete board' }, { status: 500 });
    }
}
