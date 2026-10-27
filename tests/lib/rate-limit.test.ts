import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkRateLimit } from '@/lib/rate-limit';
import { db } from '@/lib/db';
import { rateLimits } from '@/lib/schema';
import { eq } from 'drizzle-orm';

// Mock DB
vi.mock('../src/lib/db', () => ({
    db: {
        select: vi.fn(),
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
                catch: vi.fn()
            })
        }),
    }
}));

describe('Rate Limiter', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should allow request if within limit', async () => {
        const expiresAt = new Date(Date.now() + 60000);
        (db.insert as any).mockReturnValue({
            values: vi.fn().mockReturnValue({
                onConflictDoUpdate: vi.fn().mockReturnValue({
                    returning: vi.fn().mockResolvedValue([{
                        count: 1,
                        expiresAt: expiresAt,
                    }])
                })
            })
        });

        const result = await checkRateLimit('test:1', 5, 60000);
        expect(result.success).toBe(true);
        expect(db.insert).toHaveBeenCalled();
    });

    it('should block request if limit exceeded', async () => {
        const expiresAt = new Date(Date.now() + 60000);
        (db.insert as any).mockReturnValue({
            values: vi.fn().mockReturnValue({
                onConflictDoUpdate: vi.fn().mockReturnValue({
                    returning: vi.fn().mockResolvedValue([{
                        count: 6,
                        expiresAt: expiresAt,
                    }])
                })
            })
        });

        const result = await checkRateLimit('test:2', 5, 60000);
        expect(result.success).toBe(false);
    });

    it('should allow request when count resets on window expiry', async () => {
        const expiresAt = new Date(Date.now() + 60000);
        (db.insert as any).mockReturnValue({
            values: vi.fn().mockReturnValue({
                onConflictDoUpdate: vi.fn().mockReturnValue({
                    returning: vi.fn().mockResolvedValue([{
                        count: 1,
                        expiresAt: expiresAt,
                    }])
                })
            })
        });

        const result = await checkRateLimit('test:3', 5, 60000);
        expect(result.success).toBe(true);
        expect(db.insert).toHaveBeenCalled();
    });
});
