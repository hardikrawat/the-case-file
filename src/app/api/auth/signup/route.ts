import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/schema';
import { hashPassword } from '@/lib/password';
import { createVerificationToken } from '@/lib/auth-utils';
import { signupSchema } from '@/lib/validations/auth';
import { eq } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
    try {
        // 1. Rate Limiting (IP-based)
        const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
        const rateLimit = await checkRateLimit(`signup:${ip}`, 50, 3600000); // 50 signups per hour (increased for testing)

        if (!rateLimit.success) {
            return NextResponse.json(
                { error: 'Too many signup attempts. Please try again later.' },
                { status: 429 }
            );
        }

        const body = await req.json();

        // 2. Validation with Zod
        const validationResult = signupSchema.safeParse(body);
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

        const { name, email, password } = validationResult.data;

        // 3. Check if user already exists
        const existingUser = await db.select()
            .from(users)
            .where(eq(users.email, email))
            .limit(1);

        if (existingUser.length > 0) {
            return NextResponse.json(
                { error: 'Email already registered' },
                { status: 409 }
            );
        }

        // 4. Hash password
        const passwordHash = await hashPassword(password);

        // 5. Create user (unverified pending email confirmation)
        const userId = createId();
        await db.insert(users).values({
            id: userId,
            name,
            email,
            passwordHash,
            emailVerifiedFlag: false,
            createdAt: new Date(),
        });

        // 6. Create example starter case for new detective
        const { createExampleBoard } = await import('@/lib/example-case');
        await createExampleBoard(userId);

        // 7. Create verification token and send email via Resend
        const verificationToken = await createVerificationToken(userId);
        const { sendVerificationEmail } = await import('@/lib/email');
        
        try {
            await sendVerificationEmail(email, verificationToken);
            console.log(`[AUTH] Verification link dispatched for ${email}`);
        } catch (emailError) {
            // Rollback user creation
            await db.delete(users).where(eq(users.id, userId));
            console.error('Failed to dispatch email, rolling back user creation.', emailError);
            
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
            userId,
            message: 'Account created. Please check your email to verify your clearance.',
        }, { status: 201 });

    } catch (error) {
        console.error('Signup error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
