import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { comments } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { z } from 'zod';
import { checkRateLimit } from '@/lib/rate-limit';

const createCommentSchema = z.object({
    boardId: z.string().min(1, 'Board ID is required'),
    nodeId: z.string().optional().nullable(),
    content: z.string().min(1, 'Content is required').max(5000, 'Content too long'),
    parentId: z.string().optional().nullable(),
});

// GET /api/comments?boardId=xxx&nodeId=xxx
export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const boardId = searchParams.get('boardId');
        const nodeId = searchParams.get('nodeId');

        if (!boardId) {
            return NextResponse.json({ error: 'Board ID required' }, { status: 400 });
        }

        // Build query based on filters
        const conditions = [eq(comments.boardId, boardId)];

        if (nodeId) {
            conditions.push(eq(comments.nodeId, nodeId));
        }

        const results = await db.select()
            .from(comments)
            .where(and(...conditions))
            .orderBy(comments.createdAt);

        return NextResponse.json(results);
    } catch (error) {
        console.error('Get comments error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST /api/comments
export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Rate limit comments (prevent spam)
        const rateLimit = await checkRateLimit(`comment:${session.user.id}`, 30, 60000); // 30 comments per minute
        if (!rateLimit.success) {
            return NextResponse.json(
                { error: 'Too many comments. Please wait.' },
                { status: 429 }
            );
        }

        const body = await req.json();

        // Validate with Zod
        const validationResult = createCommentSchema.safeParse(body);
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

        const { boardId, nodeId, content, parentId } = validationResult.data;

        const newComment = (await db.insert(comments).values({
            id: createId(),
            boardId,
            nodeId: nodeId || null,
            userId: session.user.id,
            content,
            parentId: parentId || null,
            createdAt: new Date(),
            updatedAt: new Date(),
        }).returning()) as unknown[];

        return NextResponse.json(newComment[0], { status: 201 });
    } catch (error) {
        console.error('Create comment error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
