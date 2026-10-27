import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { userReputation, users } from '@/lib/schema';
import { desc, eq } from 'drizzle-orm';
import { checkRateLimit } from '@/lib/rate-limit';

export async function GET(req: NextRequest) {
    try {
        const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';
        const rateLimit = await checkRateLimit(`leaderboard:${ip}`, 60, 60000);
        if (!rateLimit.success) {
            return NextResponse.json({ error: 'Too many requests. Please wait.' }, { status: 429 });
        }

        const { searchParams } = new URL(req.url);
        const rawLimit = parseInt(searchParams.get('limit') || '10', 10);
        const limit = Number.isNaN(rawLimit) || rawLimit <= 0 ? 10 : Math.min(rawLimit, 50);

        const leaders = await db.select({
            userId: userReputation.userId,
            points: userReputation.points,
            boardsCreated: userReputation.boardsCreated,
            lastUpdated: userReputation.lastUpdated,
            userName: users.name,
            userImage: users.image,
            userAvatarUrl: users.avatarUrl,
        })
            .from(userReputation)
            .leftJoin(users, eq(userReputation.userId, users.id))
            .orderBy(desc(userReputation.points))
            .limit(limit);

        return NextResponse.json(leaders);
    } catch (error) {
        console.error('Leaderboard error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
