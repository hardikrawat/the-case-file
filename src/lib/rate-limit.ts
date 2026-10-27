import { db } from '@/lib/db';
import { rateLimits } from '@/lib/schema';
import { lt, sql } from 'drizzle-orm';

/**
 * Checks if a key (IP or UserId) has exceeded the rate limit using an atomic SQLite UPSERT.
 * Eliminates check-then-act race conditions under concurrent load.
 * @param key The identifier (e.g., "signup:127.0.0.1")
 * @param maxRequests Maximum allowed requests in the window
 * @param windowMs Time window in milliseconds
 * @returns { success: boolean, reset: number }
 */
export async function checkRateLimit(
    key: string,
    maxRequests: number = 5,
    windowMs: number = 60000
): Promise<{ success: boolean; reset: number }> {
    const now = Date.now();
    const expiresAt = new Date(now + windowMs);

    // 1. Probabilistic cleanup (1% of requests) to prevent table bloat
    if (Math.random() < 0.01) {
        await db.delete(rateLimits).where(lt(rateLimits.expiresAt, new Date(now))).catch(() => {});
    }

    // 2. Atomic UPSERT with RETURNING
    const result = await db.insert(rateLimits).values({
        key,
        count: 1,
        expiresAt,
    }).onConflictDoUpdate({
        target: rateLimits.key,
        set: {
            count: sql`CASE WHEN ${rateLimits.expiresAt} < ${now} THEN 1 ELSE ${rateLimits.count} + 1 END`,
            expiresAt: sql`CASE WHEN ${rateLimits.expiresAt} < ${now} THEN ${expiresAt.getTime()} ELSE ${rateLimits.expiresAt} END`,
        }
    }).returning({
        count: rateLimits.count,
        expiresAt: rateLimits.expiresAt,
    });

    const record = result[0];
    const count = record?.count ?? 1;
    const reset = record?.expiresAt instanceof Date
        ? record.expiresAt.getTime()
        : Number(record?.expiresAt ?? (now + windowMs));

    return {
        success: count <= maxRequests,
        reset,
    };
}
