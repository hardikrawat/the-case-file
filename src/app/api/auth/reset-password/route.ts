import { NextRequest, NextResponse } from 'next/server';
import { verifyResetToken, deleteResetToken } from '@/lib/auth-utils';
import { hashPassword } from '@/lib/password';
import { db } from '@/lib/db';
import { users } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { checkRateLimit } from '@/lib/rate-limit';
import { z } from 'zod';

const resetPasswordSchema = z.object({
    token: z.string().min(1, 'Token is required'),
    password: z.string()
        .min(8, 'Password must be at least 8 characters')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
        .regex(/[0-9]/, 'Password must contain at least one number'),
});

export async function POST(req: NextRequest) {
    try {
        // Rate limit reset attempts (IP-based)
        const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
        const rateLimit = await checkRateLimit(`reset:${ip}`, 5, 3600000); // 5 attempts per hour

        if (!rateLimit.success) {
            return NextResponse.json(
                { error: 'Too many reset attempts. Please try again later.' },
                { status: 429 }
            );
        }

        const body = await req.json();

        // Validate with Zod
        const validationResult = resetPasswordSchema.safeParse(body);
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

        const { token, password } = validationResult.data;

        // Verify token
        const result = await verifyResetToken(token);

        if (!result.valid || !result.userId) {
            return NextResponse.json(
                { error: 'Invalid or expired reset token' },
                { status: 400 }
            );
        }

        // Hash new password
        const passwordHash = await hashPassword(password);

        // Update user password
        await db.update(users)
            .set({ passwordHash })
            .where(eq(users.id, result.userId));

        // Delete the used token
        await deleteResetToken(token);

        return NextResponse.json({
            success: true,
            message: 'Password reset successfully',
        });

    } catch (error) {
        console.error('Reset password error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
