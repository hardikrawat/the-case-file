import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { comments, users, userReputation } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { z } from 'zod';
import { checkRateLimit } from '@/lib/rate-limit';
import { getBoardAccess } from '@/lib/auth-checks';
import { awardPoints } from '@/lib/reputation';

const createCommentSchema = z.object({
    boardId: z.string().min(1, 'Board ID is required'),
    nodeId: z.string().optional().nullable(),
    content: z.string().trim().min(1, 'Content is required').max(5000, 'Content too long'),
    parentId: z.string().optional().nullable(),
    isAnonymous: z.boolean().optional().default(false),
});

// GET /api/comments?boardId=xxx&nodeId=xxx
export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const rateLimit = await checkRateLimit(`comments:read:${session.user.id}`, 60, 60000);
        if (!rateLimit.success) {
            return NextResponse.json({ error: 'Too many requests. Please wait.' }, { status: 429 });
        }

        const { searchParams } = new URL(req.url);
        const boardId = searchParams.get('boardId');
        const nodeId = searchParams.get('nodeId');

        if (!boardId) {
            return NextResponse.json({ error: 'Board ID required' }, { status: 400 });
        }

        // Authorization check: ensure user has access to view board comments
        const access = await getBoardAccess(boardId, session.user.id);
        if (!access.board) {
            return NextResponse.json({ error: 'Board not found' }, { status: 404 });
        }
        if (!access.canView) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Build query based on filters
        const conditions = [eq(comments.boardId, boardId)];

        if (nodeId) {
            conditions.push(eq(comments.nodeId, nodeId));
        }

        const rawResults = await db.select({
            id: comments.id,
            boardId: comments.boardId,
            nodeId: comments.nodeId,
            userId: comments.userId,
            content: comments.content,
            parentId: comments.parentId,
            isAnonymous: comments.isAnonymous,
            createdAt: comments.createdAt,
            updatedAt: comments.updatedAt,
            userName: users.name,
            userImage: users.image,
            points: userReputation.points,
        })
            .from(comments)
            .leftJoin(users, eq(comments.userId, users.id))
            .leftJoin(userReputation, eq(comments.userId, userReputation.userId))
            .where(and(...conditions))
            .orderBy(comments.createdAt);

        const results = rawResults.map((c) => {
            if (c.isAnonymous) {
                return { ...c, userName: 'Anonymous Detective', userImage: null, points: 0 };
            }
            return { ...c, points: c.points ?? 0 };
        });

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

        const { boardId, nodeId, content, parentId, isAnonymous } = validationResult.data;

        // Authorization check: ensure user has access to post comment on board
        const access = await getBoardAccess(boardId, session.user.id);
        if (!access.board) {
            return NextResponse.json({ error: 'Board not found' }, { status: 404 });
        }
        if (!access.canView) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Validate parentId if replying to a thread
        if (parentId) {
            const parentComment = await db.select({ id: comments.id, boardId: comments.boardId })
                .from(comments)
                .where(eq(comments.id, parentId))
                .limit(1);

            if (parentComment.length === 0 || parentComment[0].boardId !== boardId) {
                return NextResponse.json({ error: 'Parent comment does not exist on this board' }, { status: 400 });
            }
        }

        const sanitizedContent = content.trim();

        const newComment = await db.insert(comments).values({
            id: createId(),
            boardId,
            nodeId: nodeId || null,
            userId: session.user.id,
            content: sanitizedContent,
            parentId: parentId || null,
            isAnonymous: Boolean(isAnonymous),
            createdAt: new Date(),
            updatedAt: new Date(),
        }).returning();

        // Award reputation points for comment
        try {
            await awardPoints(session.user.id, 'comment_posted');
        } catch (repErr) {
            console.warn('Failed to award reputation points for comment:', repErr);
        }

        return NextResponse.json(newComment[0], { status: 201 });
    } catch (error) {
        console.error('Create comment error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
