import { db } from '@/lib/db';
import { rateLimits } from '@/lib/schema';
import { eq, sql } from 'drizzle-orm';

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
    const expiresAt = new Date(now + lockoutDuration);

    const res = await db.insert(rateLimits).values({
        key: lockoutKey,
        count: 1,
        expiresAt,
    }).onConflictDoUpdate({
        target: rateLimits.key,
        set: {
            count: sql`${rateLimits.count} + 1`,
            expiresAt: sql`CASE WHEN ${rateLimits.expiresAt} < ${now} THEN ${expiresAt.getTime()} ELSE ${rateLimits.expiresAt} END`
        }
    }).returning({
        count: rateLimits.count,
    });

    const count = res[0]?.count ?? 1;
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
