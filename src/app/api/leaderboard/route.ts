import { NextRequest, NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { userReputation } from '@/lib/schema';
import { desc } from 'drizzle-orm';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const limit = parseInt(searchParams.get('limit') || '10');

        const leaders = await db.select()
            .from(userReputation)
            .orderBy(desc(userReputation.points))
            .limit(Math.min(limit, 50));

        return NextResponse.json(leaders);
    } catch (error) {
        console.error('Leaderboard error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
