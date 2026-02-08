import { auth } from '@/auth';
import { db } from '@/lib/db';
import { contributions } from '@/lib/schema';
import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { z } from 'zod';
import { checkRateLimit } from '@/lib/rate-limit';

const createContributionSchema = z.object({
    targetBoardId: z.string().min(1, 'Target board ID is required'),
    message: z.string().max(1000, 'Message too long').optional().default(''),
    snapshot: z.object({
        nodes: z.array(z.any()).optional(),
        edges: z.array(z.any()).optional(),
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

        const contributionId = createId();

        await db.insert(contributions).values({
            id: contributionId,
            userId: session.user.id,
            boardId: targetBoardId,
            snapshot: snapshot,
            message: message || '',
            status: 'open',
            createdAt: new Date(),
        });

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

    const { searchParams } = new URL(req.url);
    const targetBoardId = searchParams.get('boardId');
    const type = searchParams.get('type'); // 'sent' or 'received' (default)

    try {
        if (type === 'sent') {
            // Fetch contributions MADE BY this user
            const query = db.select().from(contributions).where(eq(contributions.userId, session.user.id));

            if (targetBoardId) {
                // If boardId is provided, also filter by target board
                // changing query to use $and or simpler logic if chaining isn't supported directly like this in drizzle without and()
                // Drizzle select().from().where() returns a QueryBuilder. 
                // Let's use the `and` operator from drizzle-orm for clarity
                const { and } = await import('drizzle-orm');
                const results = await db.select().from(contributions).where(
                    and(
                        eq(contributions.userId, session.user.id),
                        eq(contributions.boardId, targetBoardId)
                    )
                );
                return NextResponse.json(results);
            }

            // Otherwise return all (or we could default to none if we strictly want board context? 
            // The user requirement implies "limited to that particular board", so filtering is key. 
            // But if called without boardId (e.g. from a main dashboard profile page?), we might still want all.
            // For now, let's keep 'all' if no boardId is strict, but the frontend will pass it.)
            const results = await query;
            return NextResponse.json(results);
        } else if (targetBoardId) {
            // Fetch contributions TO this board (existing behavior)
            const results = await db.select().from(contributions).where(eq(contributions.boardId, targetBoardId));
            return NextResponse.json(results);
        }

        return NextResponse.json([]);
    } catch (error) {
        console.error('Error fetching contributions:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
