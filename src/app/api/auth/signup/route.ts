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
        const rateLimit = await checkRateLimit(`signup:${ip}`, 5, 3600000); // 5 signups per hour

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

        // 5. Create user
        const userId = createId();
        await db.insert(users).values({
            id: userId,
            name,
            email,
            passwordHash,
            emailVerifiedFlag: false,
            createdAt: new Date(),
        });

        // 6. Create verification token
        const verificationToken = await createVerificationToken(userId);

        // In a production app, send email with verification link
        // For now, we'll return the token in the response for testing
        return NextResponse.json({
            success: true,
            userId,
            message: 'Account created successfully',
            // TODO: Remove in production, send via email instead
            verificationToken,
        }, { status: 201 });

    } catch (error) {
        console.error('Signup error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
