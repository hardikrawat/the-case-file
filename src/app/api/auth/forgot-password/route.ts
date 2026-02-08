import { NextRequest, NextResponse } from 'next/server';
import { createPasswordResetToken } from '@/lib/auth-utils';
import { validateEmail } from '@/lib/password';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
    try {
        // Rate limit password reset requests (IP-based)
        const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
        const rateLimit = await checkRateLimit(`forgot:${ip}`, 3, 3600000); // 3 attempts per hour

        if (!rateLimit.success) {
            return NextResponse.json(
                { error: 'Too many reset attempts. Please try again later.' },
                { status: 429 }
            );
        }

        const body = await req.json();
        const { email } = body;

        if (!email || !validateEmail(email)) {
            return NextResponse.json(
                { error: 'Valid email is required' },
                { status: 400 }
            );
        }

        const token = await createPasswordResetToken(email);

        if (!token) {
            // Don't reveal if email exists or not for security
            return NextResponse.json({
                success: true,
                message: 'If an account exists with this email, a password reset link has been sent',
            });
        }

        // TODO: Send email with reset link
        // For now, return token in response for testing
        return NextResponse.json({
            success: true,
            message: 'Password reset link sent',
            // TODO: Remove in production
            resetToken: token,
        });

    } catch (error) {
        console.error('Forgot password error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
