import { db } from '@/lib/db';
import { rateLimits } from '@/lib/schema';
import { eq, lt } from 'drizzle-orm';

/**
 * Checks if a key (IP or UserId) has exceeded the rate limit.
 * @param key The identifier (e.g., "signup:127.0.0.1")
 * @param maxRequests Maximum allowed requests in the window
 * @param windowMs Time window in milliseconds
 * @returns { success: boolean, reset: number }
 */
export async function checkRateLimit(key: string, maxRequests: number = 5, windowMs: number = 60000) {
    const now = Date.now();

    // 1. Probabilistic cleanup (1% of requests) to prevent table bloat
    if (Math.random() < 0.01) {
        await db.delete(rateLimits).where(lt(rateLimits.expiresAt, new Date(now)));
    }

    // 2. Get current limit
    const record = await db.select().from(rateLimits).where(eq(rateLimits.key, key)).limit(1);

    if (record.length === 0) {
        // Create new record
        const expiresAt = new Date(now + windowMs);
        await db.insert(rateLimits).values({
            key,
            count: 1,
            expiresAt,
        });
        return { success: true, reset: expiresAt.getTime() };
    }

    const expiresAt = record[0].expiresAt;
    const count = record[0].count || 0;

    if (now > expiresAt.getTime()) {
        // Window expired, reset count
        const newExpiresAt = new Date(now + windowMs);
        await db.update(rateLimits)
            .set({ count: 1, expiresAt: newExpiresAt })
            .where(eq(rateLimits.key, key));
        return { success: true, reset: newExpiresAt.getTime() };
    }

    if (count >= maxRequests) {
        // Rate limit exceeded
        return { success: false, reset: expiresAt.getTime() };
    }

    // Increment count
    await db.update(rateLimits)
        .set({ count: count + 1 })
        .where(eq(rateLimits.key, key));

    return { success: true, reset: expiresAt.getTime() };
}
