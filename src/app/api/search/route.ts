import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { searchDatabase } from '@/lib/search';
import { checkRateLimit } from '@/lib/rate-limit';

export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        const identifier = session?.user?.id || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';
        const rateLimit = await checkRateLimit(`search:${identifier}`, 30, 60000);
        if (!rateLimit.success) {
            return NextResponse.json({ error: 'Too many requests. Please wait.' }, { status: 429 });
        }

        const { searchParams } = new URL(req.url);
        const query = searchParams.get('q');

        if (!query || query.trim().length === 0) {
            return NextResponse.json(
                { error: 'Search query is required' },
                { status: 400 }
            );
        }

        if (query.length < 2) {
            return NextResponse.json(
                { error: 'Search query must be at least 2 characters' },
                { status: 400 }
            );
        }

        const results = await searchDatabase(query, session?.user?.id);

        return NextResponse.json(results);
    } catch (error) {
        console.error('Search error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
