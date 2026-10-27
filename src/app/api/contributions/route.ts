import { auth } from '@/auth';
import { db } from '@/lib/db';
import { contributions, notifications, users, boards } from '@/lib/schema';
import { NextRequest, NextResponse } from 'next/server';
import { eq, and, desc } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { z } from 'zod';
import { checkRateLimit } from '@/lib/rate-limit';
import { getBoardAccess } from '@/lib/auth-checks';

const contributionNodeSchema = z.object({
    id: z.string(),
    type: z.string().optional(),
    position: z.object({
        x: z.number(),
        y: z.number(),
    }).optional(),
    data: z.record(z.string(), z.unknown()).optional(),
}).passthrough();

const contributionEdgeSchema = z.object({
    id: z.string(),
    source: z.string(),
    target: z.string(),
    type: z.string().optional(),
    data: z.record(z.string(), z.unknown()).optional(),
}).passthrough();

const createContributionSchema = z.object({
    targetBoardId: z.string().min(1, 'Target board ID is required'),
    message: z.string().max(1000, 'Message too long').optional().default(''),
    snapshot: z.object({
        nodes: z.array(contributionNodeSchema).optional(),
        edges: z.array(contributionEdgeSchema).optional(),
    }).passthrough(),
});

export async function POST(req: NextRequest) {
    const session = await auth();

    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limit contributions (prevent spam)
    const rateLimit = await checkRateLimit(`contribution:${session.user.id}`, 10, 3600000); // 10 per hour
    if (!rateLimit.success) {
        return NextResponse.json(
            { error: 'Too many contributions. Please wait.' },
            { status: 429 }
        );
    }

    try {
        const body = await req.json();

        // Validate with Zod
        const validationResult = createContributionSchema.safeParse(body);
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

        const { targetBoardId, message, snapshot } = validationResult.data;

        // Verify target board existence and permissions
        const access = await getBoardAccess(targetBoardId, session.user.id);
        if (!access.board) {
            return NextResponse.json({ error: 'Target case file not found' }, { status: 404 });
        }
        if (!access.canView) {
            return NextResponse.json({ error: 'Forbidden: You do not have permission to view this case' }, { status: 403 });
        }
        if (access.board.userId === session.user.id) {
            return NextResponse.json({ error: 'You cannot submit suggestions to your own case file' }, { status: 400 });
        }

        const nodes = Array.isArray(snapshot?.nodes) ? snapshot.nodes : [];
        const edges = Array.isArray(snapshot?.edges) ? snapshot.edges : [];
        if (nodes.length === 0 && edges.length === 0) {
            return NextResponse.json({ error: 'Suggestion snapshot cannot be empty' }, { status: 400 });
        }

        const contributionId = createId();
        const now = new Date();

        await db.insert(contributions).values({
            id: contributionId,
            userId: session.user.id,
            boardId: targetBoardId,
            snapshot: snapshot as Record<string, unknown>,
            message: message ? message.replace(/<[^>]*>?/gm, '').trim() : '',
            status: 'open',
            createdAt: now,
            updatedAt: now,
        });

        // Notify target board owner
        try {
            await db.insert(notifications).values({
                id: createId(),
                recipientId: access.board.userId,
                actorId: session.user.id,
                type: 'contribution_submitted',
                referenceId: contributionId,
                referenceType: 'contribution',
                message: `${session.user.name || 'A detective'} submitted investigation suggestions to "${access.board.title}"`,
                isRead: false,
                createdAt: now,
            });
        } catch (notifErr) {
            console.warn('Failed to dispatch contribution notification:', notifErr);
        }

        return NextResponse.json({ id: contributionId }, { status: 201 });
    } catch (error) {
        console.error('Error creating contribution:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    const session = await auth();

    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimit = await checkRateLimit(`contributions:${session.user.id}`, 30, 60000);
    if (!rateLimit.success) {
        return NextResponse.json({ error: 'Too many requests. Please wait.' }, { status: 429 });
    }

    const { searchParams } = new URL(req.url);
    const targetBoardId = searchParams.get('boardId');
    const type = searchParams.get('type'); // 'sent', 'public', or 'received' (default)

    try {
        if (type === 'sent') {
            // Fetch contributions MADE BY this user with joined case details
            const results = await db.select({
                id: contributions.id,
                userId: contributions.userId,
                boardId: contributions.boardId,
                snapshot: contributions.snapshot,
                message: contributions.message,
                status: contributions.status,
                rejectionReason: contributions.rejectionReason,
                createdAt: contributions.createdAt,
                updatedAt: contributions.updatedAt,
                boardTitle: boards.title,
                contributorName: users.name,
                contributorImage: users.image,
            })
            .from(contributions)
            .leftJoin(boards, eq(contributions.boardId, boards.id))
            .leftJoin(users, eq(contributions.userId, users.id))
            .where(
                targetBoardId
                    ? and(eq(contributions.userId, session.user.id), eq(contributions.boardId, targetBoardId))
                    : eq(contributions.userId, session.user.id)
            )
            .orderBy(desc(contributions.createdAt));

            return NextResponse.json(results);
        } else if (type === 'public' && targetBoardId) {
            // Fetch public community suggestions for this board
            const access = await getBoardAccess(targetBoardId, session.user.id);
            if (!access.board || !access.canView) {
                return NextResponse.json({ error: 'Case file not found or inaccessible' }, { status: 404 });
            }

            const results = await db.select({
                id: contributions.id,
                userId: contributions.userId,
                boardId: contributions.boardId,
                snapshot: contributions.snapshot,
                message: contributions.message,
                status: contributions.status,
                rejectionReason: contributions.rejectionReason,
                createdAt: contributions.createdAt,
                updatedAt: contributions.updatedAt,
                boardTitle: boards.title,
                contributorName: users.name,
                contributorImage: users.image,
            })
            .from(contributions)
            .leftJoin(boards, eq(contributions.boardId, boards.id))
            .leftJoin(users, eq(contributions.userId, users.id))
            .where(
                and(
                    eq(contributions.boardId, targetBoardId),
                    eq(contributions.status, 'open')
                )
            )
            .orderBy(desc(contributions.createdAt));

            return NextResponse.json(results);
        } else if (targetBoardId) {
            // Fetch contributions TO this board
            const access = await getBoardAccess(targetBoardId, session.user.id);
            if (!access.board) {
                return NextResponse.json({ error: 'Board not found' }, { status: 404 });
            }
            if (!access.canView) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }

            // Public viewers can see open suggestions; editors/owners see all
            const whereClause = !access.canEdit
                ? and(eq(contributions.boardId, targetBoardId), eq(contributions.status, 'open'))
                : eq(contributions.boardId, targetBoardId);

            const results = await db.select({
                id: contributions.id,
                userId: contributions.userId,
                boardId: contributions.boardId,
                snapshot: contributions.snapshot,
                message: contributions.message,
                status: contributions.status,
                rejectionReason: contributions.rejectionReason,
                createdAt: contributions.createdAt,
                updatedAt: contributions.updatedAt,
                boardTitle: boards.title,
                contributorName: users.name,
                contributorImage: users.image,
            })
            .from(contributions)
            .leftJoin(boards, eq(contributions.boardId, boards.id))
            .leftJoin(users, eq(contributions.userId, users.id))
            .where(whereClause)
            .orderBy(desc(contributions.createdAt));

            return NextResponse.json(results);
        }

        return NextResponse.json({ error: 'boardId or type=sent query parameter required' }, { status: 400 });
    } catch (error) {
        console.error('Error fetching contributions:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
