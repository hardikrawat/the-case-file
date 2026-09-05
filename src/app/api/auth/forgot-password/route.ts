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

        // Create reset token if user exists (persisted in DB; dispatched out-of-band via email)
        await createPasswordResetToken(email);

        // Always return generic success message to prevent user enumeration and token leakage
        return NextResponse.json({
            success: true,
            message: 'If an account exists with this email, a password reset link has been sent',
        });

    } catch (error) {
        console.error('Forgot password error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
