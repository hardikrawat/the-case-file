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
        delete: vi.fn(), // If used
    }
}));

describe('Rate Limiter', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should allow request if no record exists', async () => {
        // Mock db.select to return empty array
        (db.select as any).mockReturnValue({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([])
                })
            })
        });

        // Mock db.insert
        (db.insert as any).mockReturnValue({
            values: vi.fn().mockResolvedValue(undefined)
        });

        const result = await checkRateLimit('test:1', 5, 60000);
        expect(result.success).toBe(true);
        expect(db.insert).toHaveBeenCalled();
    });

    it('should block request if limit exceeded', async () => {
        const now = Date.now();
        const expiresAt = new Date(now + 60000); // Valid window

        // Mock db.select to return existing record with max count
        (db.select as any).mockReturnValue({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([{
                        key: 'test:2',
                        count: 5,
                        expiresAt: expiresAt
                    }])
                })
            })
        });

        const result = await checkRateLimit('test:2', 5, 60000);
        expect(result.success).toBe(false);
    });

    it('should reset limit if window expired', async () => {
        const now = Date.now();
        const expiresAt = new Date(now - 1000); // Expired

        (db.select as any).mockReturnValue({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([{
                        key: 'test:3',
                        count: 5,
                        expiresAt: expiresAt
                    }])
                })
            })
        });

        (db.update as any).mockReturnValue({
            set: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue(undefined)
            })
        });

        const result = await checkRateLimit('test:3', 5, 60000);
        expect(result.success).toBe(true);
        // Expect update to be called with count: 1
        expect(db.update).toHaveBeenCalled();
    });
});
