import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/schema';
import { createVerificationToken } from '@/lib/auth-utils';
import { checkRateLimit } from '@/lib/rate-limit';
import { eq } from 'drizzle-orm';

export async function POST(req: NextRequest) {
    try {
        // Rate limiting (IP-based) to prevent email spam
        const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
        const rateLimit = await checkRateLimit(`resend_verification:${ip}`, 3, 3600000); // 3 resends per hour

        if (!rateLimit.success) {
            return NextResponse.json(
                { error: 'Too many resend attempts. Please try again later.' },
                { status: 429 }
            );
        }

        const body = await req.json();
        const { email } = body;

        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }

        // Check if user exists
        const existingUser = await db.select()
            .from(users)
            .where(eq(users.email, email))
            .limit(1);

        if (existingUser.length === 0) {
            // Return success even if not found to prevent email enumeration
            return NextResponse.json({ success: true, message: 'If an account exists, a verification link has been sent' });
        }

        const user = existingUser[0];

        if (user.emailVerifiedFlag) {
            return NextResponse.json({ error: 'Email is already verified' }, { status: 400 });
        }

        // Create new verification token and send email
        const verificationToken = await createVerificationToken(user.id);
        const { sendVerificationEmail } = await import('@/lib/email');
        
        try {
            await sendVerificationEmail(email, verificationToken);
            console.log(`[AUTH] Resent verification link for ${email}`);
        } catch (emailError) {
            let errorMessage = emailError instanceof Error ? emailError.message : 'Unknown email error';
            if (errorMessage.includes('You can only send testing emails')) {
                errorMessage = 'Resend sandbox limit: You can only send to your verified Resend email address.';
            }

            return NextResponse.json(
                { error: `Email dispatch failed: ${errorMessage}` },
                { status: 400 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Verification email resent successfully.',
        });

    } catch (error) {
        console.error('Resend verification error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
