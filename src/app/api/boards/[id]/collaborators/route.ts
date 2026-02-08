import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { boardCollaborators, users, boards } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { z } from 'zod';

const addCollaboratorSchema = z.object({
    userId: z.string().min(1, 'User ID is required'),
    role: z.enum(['viewer', 'editor', 'owner']).default('viewer'),
});

// GET /api/boards/[id]/collaborators
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

        const collaborators = await db.select({
            id: boardCollaborators.id,
            userId: boardCollaborators.userId,
            role: boardCollaborators.role,
            addedAt: boardCollaborators.addedAt,
            userName: users.name,
            userEmail: users.email,
        })
            .from(boardCollaborators)
            .leftJoin(users, eq(boardCollaborators.userId, users.id))
            .where(eq(boardCollaborators.boardId, params.id));

        return NextResponse.json(collaborators);
    } catch (error) {
        console.error('Get collaborators error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST /api/boards/[id]/collaborators
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

        // CRITICAL: Check if user owns the board
        const board = await db.select()
            .from(boards)
            .where(eq(boards.id, params.id))
            .limit(1);

        if (board.length === 0) {
            return NextResponse.json({ error: 'Board not found' }, { status: 404 });
        }

        if (board[0].userId !== session.user.id) {
            return NextResponse.json({ error: 'Forbidden: Only board owner can add collaborators' }, { status: 403 });
        }

        const body = await req.json();

        // Validate with Zod
        const validationResult = addCollaboratorSchema.safeParse(body);
        if (!validationResult.success) {
            const errors = validationResult.error.issues.map((err) => ({
                field: err.path.join('.'),
                message: err.message
            }));
            return NextResponse.json(
                { error: 'Invalid input', details: errors },
                { status: 400 }
            );
        }

        const { userId, role } = validationResult.data;

        // Check if already a collaborator
        const existing = await db.select()
            .from(boardCollaborators)
            .where(
                and(
                    eq(boardCollaborators.boardId, params.id),
                    eq(boardCollaborators.userId, userId)
                )
            )
            .limit(1);

        if (existing.length > 0) {
            return NextResponse.json({ error: 'User is already a collaborator' }, { status: 400 });
        }

        const newCollaborator = await db.insert(boardCollaborators).values({
            id: createId(),
            boardId: params.id,
            userId,
            role,
            addedAt: new Date(),
        }).returning();

        return NextResponse.json(newCollaborator[0], { status: 201 });
    } catch (error) {
        console.error('Add collaborator error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
