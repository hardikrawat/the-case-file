import { db } from '@/lib/db';
import { passwordResetTokens, emailVerificationTokens, users } from '@/lib/schema';
import { generateToken } from '@/lib/password';
import { eq, sql } from 'drizzle-orm';

/**
 * Create an email verification token for a user
 */
export async function createVerificationToken(userId: string): Promise<string> {
    const token = generateToken();
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await db.insert(emailVerificationTokens).values({
        id: generateToken(),
        userId,
        token,
        expires,
    });

    return token;
}

/**
 * Verify an email verification token
 */
export async function verifyEmailToken(token: string): Promise<{ valid: boolean; userId?: string }> {
    const result = await db.select()
        .from(emailVerificationTokens)
        .where(eq(emailVerificationTokens.token, token))
        .limit(1);

    if (result.length === 0) {
        return { valid: false };
    }

    const tokenData = result[0];

    // Check if token is expired
    if (new Date() > new Date(tokenData.expires)) {
        return { valid: false };
    }

    // Mark email as verified
    await db.update(users)
        .set({ emailVerifiedFlag: sql`1` })
        .where(eq(users.id, tokenData.userId));

    // Delete the used token
    await db.delete(emailVerificationTokens)
        .where(eq(emailVerificationTokens.token, token));

    return { valid: true, userId: tokenData.userId };
}

/**
 * Create a password reset token for a user
 */
export async function createPasswordResetToken(email: string): Promise<string | null> {
    // Find user by email
    const userResult = await db.select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

    if (userResult.length === 0) {
        return null;
    }

    const user = userResult[0];
    const token = generateToken();
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Delete any existing reset tokens for this user
    await db.delete(passwordResetTokens)
        .where(eq(passwordResetTokens.userId, user.id));

    // Create new reset token
    await db.insert(passwordResetTokens).values({
        id: generateToken(),
        userId: user.id,
        token,
        expires,
    });

    return token;
}

/**
 * Verify a password reset token
 */
export async function verifyResetToken(token: string): Promise<{ valid: boolean; userId?: string }> {
    const result = await db.select()
        .from(passwordResetTokens)
        .where(eq(passwordResetTokens.token, token))
        .limit(1);

    if (result.length === 0) {
        return { valid: false };
    }

    const tokenData = result[0];

    // Check if token is expired
    if (new Date() > new Date(tokenData.expires)) {
        // Delete expired token
        await db.delete(passwordResetTokens)
            .where(eq(passwordResetTokens.token, token));
        return { valid: false };
    }

    return { valid: true, userId: tokenData.userId };
}

/**
 * Delete a password reset token after use
 */
export async function deleteResetToken(token: string): Promise<void> {
    await db.delete(passwordResetTokens)
        .where(eq(passwordResetTokens.token, token));
}
