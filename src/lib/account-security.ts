import { db } from '@/lib/db';
import { rateLimits } from '@/lib/schema';
import { eq } from 'drizzle-orm';

/**
 * Track failed login attempts and implement account lockout
 */
export async function checkAccountLockout(email: string): Promise<{
    isLocked: boolean;
    remainingTime?: number;
    attempts?: number;
}> {
    const lockoutKey = `lockout:${email}`;
    const now = Date.now();

    // Check if account is currently locked
    const lockoutRecord = await db.select()
        .from(rateLimits)
        .where(eq(rateLimits.key, lockoutKey))
        .limit(1);

    if (lockoutRecord.length > 0) {
        const expiresAt = lockoutRecord[0].expiresAt.getTime();
        const count = lockoutRecord[0].count || 0;

        // If still locked
        if (now < expiresAt && count >= 5) {
            const remainingTime = Math.ceil((expiresAt - now) / 1000 / 60); // minutes
            return {
                isLocked: true,
                remainingTime,
                attempts: count
            };
        }

        // Lock expired, clean up
        if (now >= expiresAt) {
            await db.delete(rateLimits).where(eq(rateLimits.key, lockoutKey));
        }
    }

    return { isLocked: false };
}

/**
 * Record a failed login attempt
 * Returns true if account should be locked
 */
export async function recordFailedAttempt(email: string): Promise<{
    shouldLock: boolean;
    attempts: number;
}> {
    const lockoutKey = `lockout:${email}`;
    const now = Date.now();
    const lockoutDuration = 30 * 60 * 1000; // 30 minutes

    const existingRecord = await db.select()
        .from(rateLimits)
        .where(eq(rateLimits.key, lockoutKey))
        .limit(1);

    if (existingRecord.length === 0) {
        // First failed attempt
        const expiresAt = new Date(now + lockoutDuration);
        await db.insert(rateLimits).values({
            key: lockoutKey,
            count: 1,
            expiresAt,
        });
        return { shouldLock: false, attempts: 1 };
    }

    const record = existingRecord[0];
    const expiresAt = record.expiresAt.getTime();
    const count = (record.count || 0) + 1;

    // Reset if window expired
    if (now > expiresAt) {
        const newExpiresAt = new Date(now + lockoutDuration);
        await db.update(rateLimits)
            .set({ count: 1, expiresAt: newExpiresAt })
            .where(eq(rateLimits.key, lockoutKey));
        return { shouldLock: false, attempts: 1 };
    }

    // Increment count
    await db.update(rateLimits)
        .set({ count })
        .where(eq(rateLimits.key, lockoutKey));

    // Lock if 5 or more attempts
    const shouldLock = count >= 5;
    return { shouldLock, attempts: count };
}

/**
 * Clear failed attempts after successful login
 */
export async function clearFailedAttempts(email: string): Promise<void> {
    const lockoutKey = `lockout:${email}`;
    await db.delete(rateLimits).where(eq(rateLimits.key, lockoutKey));
}
