import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { boardVersions, boards, boardCollaborators } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';

// GET /api/boards/[id]/versions
export async function GET(
    req: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const params = await props.params;
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check if user has access to view versions (owner or collaborator)
        const board = await db.select()
            .from(boards)
            .where(eq(boards.id, params.id))
            .limit(1);

        if (board.length === 0) {
            return NextResponse.json({ error: 'Board not found' }, { status: 404 });
        }

        const isOwner = board[0].userId === session.user.id;

        if (!isOwner) {
            // Check if collaborator
            const collab = await db.select()
                .from(boardCollaborators)
                .where(
                    and(
                        eq(boardCollaborators.boardId, params.id),
                        eq(boardCollaborators.userId, session.user.id)
                    )
                )
                .limit(1);

            if (collab.length === 0) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
        }

        const versions = await db.select()
            .from(boardVersions)
            .where(eq(boardVersions.boardId, params.id))
            .orderBy(boardVersions.createdAt);

        return NextResponse.json(versions);
    } catch (error) {
        console.error('Get versions error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST /api/boards/[id]/versions
export async function POST(
    req: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const params = await props.params;
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check if user can create versions (owner or editor)
        const board = await db.select()
            .from(boards)
            .where(eq(boards.id, params.id))
            .limit(1);

        if (board.length === 0) {
            return NextResponse.json({ error: 'Board not found' }, { status: 404 });
        }

        const isOwner = board[0].userId === session.user.id;

        if (!isOwner) {
            // Check if editor collaborator
            const collab = await db.select()
                .from(boardCollaborators)
                .where(
                    and(
                        eq(boardCollaborators.boardId, params.id),
                        eq(boardCollaborators.userId, session.user.id)
                    )
                )
                .limit(1);

            if (collab.length === 0 || (collab[0].role !== 'editor' && collab[0].role !== 'owner')) {
                return NextResponse.json({ error: 'Forbidden: Only owners and editors can create versions' }, { status: 403 });
            }
        }

        const body = await req.json();
        const { content } = body;

        if (!content) {
            return NextResponse.json({ error: 'Content is required' }, { status: 400 });
        }

        const newVersion = await db.insert(boardVersions).values({
            id: createId(),
            boardId: params.id,
            content,
            createdBy: session.user.id,
            createdAt: new Date(),
        }).returning();

        return NextResponse.json(newVersion[0], { status: 201 });
    } catch (error) {
        console.error('Create version error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
