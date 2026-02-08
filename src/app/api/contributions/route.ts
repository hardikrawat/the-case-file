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

    try {
        if (targetBoardId) {
            const results = await db.select().from(contributions).where(eq(contributions.boardId, targetBoardId));
            return NextResponse.json(results);
        }

        return NextResponse.json([]);
    } catch (error) {
        console.error('Error fetching contributions:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
