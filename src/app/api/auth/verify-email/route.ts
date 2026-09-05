import { NextRequest, NextResponse } from 'next/server';
import { verifyEmailToken } from '@/lib/auth-utils';
import { checkRateLimit } from '@/lib/rate-limit';

export async function GET(req: NextRequest) {
    try {
        // Rate limiting (IP-based) to prevent brute-force attacks
        const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';
        const rateLimit = await checkRateLimit(`verify-email:${ip}`, 10, 60000); // 10 attempts per minute
        if (!rateLimit.success) {
            return NextResponse.json(
                { error: 'Too many verification attempts. Please try again later.' },
                { status: 429 }
            );
        }

        const { searchParams } = new URL(req.url);
        const token = searchParams.get('token');

        if (!token || typeof token !== 'string' || token.trim().length === 0 || token.length > 128) {
            return NextResponse.json(
                { error: 'Verification token is required' },
                { status: 400 }
            );
        }

        const result = await verifyEmailToken(token.trim());

        if (!result.valid) {
            return NextResponse.json(
                { error: 'Invalid or expired verification token' },
                { status: 400 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Email verified successfully',
        });

    } catch (error) {
        console.error('Email verification error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
