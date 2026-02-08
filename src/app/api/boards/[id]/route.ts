import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { boards } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { auth } from '@/auth';

export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const params = await props.params;
        const { id } = params;
        const { content, title, isPublic, thumbnail } = await req.json();

        // 1. Fetch board to check ownership
        const board = await db.query.boards.findFirst({
            where: eq(boards.id, id),
            with: {
                collaborators: true
            }
        });

        if (!board) {
            return NextResponse.json({ error: 'Board not found' }, { status: 404 });
        }

        // 2. Check Permissions
        const isOwner = board.userId === session.user.id;
        const collaborator = board.collaborators.find(c => c.userId === session.user.id);
        const isEditor = collaborator && (collaborator.role === 'editor' || collaborator.role === 'owner');

        if (!isOwner && !isEditor) {
            return NextResponse.json({ error: 'Forbidden: You do not have permission to edit this board' }, { status: 403 });
        }

        // 3. Update Board
        const updateData: Record<string, unknown> = {
            content: content,
            updatedAt: new Date(),
        };

        if (title) updateData.title = title;
        if (isPublic !== undefined) updateData.isPublic = isPublic;
        // Only allow thumbnail updates if permitted (usually auto-generated, so fine)
        if (thumbnail) updateData.thumbnail = thumbnail;

        await db.update(boards)
            .set(updateData)
            .where(eq(boards.id, id));

        return NextResponse.json({ success: true });
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

    try {
        const board = await db.query.boards.findFirst({
            where: eq(boards.id, id),
            with: {
                collaborators: true
            }
        });

        if (!board) {
            return NextResponse.json({ error: 'Board not found' }, { status: 404 });
        }

        // Access Logic:
        // 1. Public boards -> Allow everyone
        // 2. Private boards -> Allow Owner
        // 3. Private boards -> Allow Collaborators

        const isPublic = board.isPublic;
        const isOwner = currentUserId && board.userId === currentUserId;
        const isCollaborator = currentUserId && board.collaborators.some(c => c.userId === currentUserId);

        if (isPublic || isOwner || isCollaborator) {
            return NextResponse.json(board);
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
