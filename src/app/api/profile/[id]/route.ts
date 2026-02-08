import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users, boards, userReputation } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { z } from 'zod';
import { checkRateLimit } from '@/lib/rate-limit';

const updateProfileSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(100).optional(),
    bio: z.string().max(500, 'Bio must be less than 500 characters').optional(),
    avatarUrl: z.string().url('Invalid URL').optional().or(z.literal('')),
});

// GET /api/profile/[id]
export async function GET(
    req: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const params = await props.params;
        // Get user profile
        const userProfile = await db.select()
            .from(users)
            .where(eq(users.id, params.id))
            .limit(1);

        if (userProfile.length === 0) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const user = userProfile[0];

        // Get user's boards count
        const userBoards = await db.select()
            .from(boards)
            .where(eq(boards.userId, params.id));

        // Get reputation if exists
        const reputation = await db.select()
            .from(userReputation)
            .where(eq(userReputation.userId, params.id))
            .limit(1);

        return NextResponse.json({
            id: user.id,
            name: user.name,
            email: user.email,
            bio: user.bio,
            avatarUrl: user.avatarUrl,
            boardsCount: userBoards.length,
            reputation: reputation.length > 0 ? reputation[0].points : 0,
        });
    } catch (error) {
        console.error('Profile fetch error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PUT /api/profile/[id]
export async function PUT(
    req: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const params = await props.params;
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Only allow editing own profile
        if (session.user.id !== params.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Rate limit profile updates (prevent spam)
        const rateLimit = await checkRateLimit(`profile:${session.user.id}`, 10, 60000); // 10 updates per minute
        if (!rateLimit.success) {
            return NextResponse.json(
                { error: 'Too many profile updates. Please wait.' },
                { status: 429 }
            );
        }

        const body = await req.json();

        // Validate with Zod
        const validationResult = updateProfileSchema.safeParse(body);
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

        const { name, bio, avatarUrl } = validationResult.data;

        const updateData: Record<string, string> = {};
        if (name !== undefined) updateData.name = name;
        if (bio !== undefined) updateData.bio = bio;
        if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
        }

        const updated = await db.update(users)
            .set(updateData)
            .where(eq(users.id, params.id))
            .returning();

        return NextResponse.json(updated[0]);
    } catch (error) {
        console.error('Profile update error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
