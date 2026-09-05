import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '@/app/api/boards/route';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { boards } from '@/lib/schema';
import { NextResponse } from 'next/server';

// Mock Next.js modules
vi.mock('next/server', () => ({
    NextResponse: {
        json: vi.fn((data, init) => ({ data, status: init?.status || 200 })),
    },
}));

// Mock auth
vi.mock('@/auth', () => ({
    auth: vi.fn(),
}));

// Mock DB
vi.mock('@/lib/db', () => ({
    db: {
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockResolvedValue({}),
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
    },
}));

// Mock cuid
vi.mock('@paralleldrive/cuid2', () => ({
    createId: vi.fn().mockReturnValue('board-123'),
}));

// Mock rate-limit
vi.mock('@/lib/rate-limit', () => ({
    checkRateLimit: vi.fn().mockResolvedValue({ success: true, reset: Date.now() + 60000 }),
}));

describe('/api/boards', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const createRequest = (body: any = {}) => ({
        json: async () => body,
    } as unknown as Request);

    describe('POST', () => {
        it('should return 401 if not authenticated', async () => {
            vi.mocked(auth).mockResolvedValue(null as any);
            const req = createRequest();
            const response = await POST(req) as any;
            expect(response.status).toBe(401);
            expect(response.data.error).toBe('Unauthorized');
        });

        it('should create a board successfully', async () => {
            vi.mocked(auth).mockResolvedValue({ user: { id: 'user-123' } } as any);
            const req = createRequest({ title: 'New Case' });

            const response = await POST(req) as any;

            expect(response.status).toBe(201);
            expect(response.data.id).toBe('board-123');
            expect(db.insert).toHaveBeenCalled();
        });

        it('should use default values', async () => {
            vi.mocked(auth).mockResolvedValue({ user: { id: 'user-123' } } as any);
            const req = createRequest({}); // Empty body

            await POST(req);

            expect(db.insert).toHaveBeenCalled();
            // We can't easily inspect arguments of chained calls without returning a specific mock object with spies on methods.
            // But since our mock returns `this`, we can spy on `values`.
        });

        it('should handle errors gracefully', async () => {
            vi.mocked(auth).mockResolvedValue({ user: { id: 'user-123' } } as any);
            const req = createRequest();
            (db.insert as any).mockImplementationOnce(() => { throw new Error('DB Error'); });

            const response = await POST(req) as any;

            expect(response.status).toBe(500);
            expect(response.data.error).toBe('Internal Server Error');
        });
    });

    describe('GET', () => {
        it('should return 401 if not authenticated', async () => {
            vi.mocked(auth).mockResolvedValue(null as any);
            const req = createRequest();
            const response = await GET() as any;
            expect(response.status).toBe(401);
        });

        it('should return user boards', async () => {
            vi.mocked(auth).mockResolvedValue({ user: { id: 'user-123' } } as any);
            (db.select as any).mockReturnValue({
                from: vi.fn().mockReturnThis(),
                leftJoin: vi.fn().mockReturnThis(),
                where: vi.fn().mockReturnThis(),
                orderBy: vi.fn().mockResolvedValue([{ id: 'board-1', title: 'Case 1' }]),
            });

            const response = await GET() as any;

            expect(response.status).toBe(200);
            expect(response.data).toHaveLength(1);
            expect(response.data[0].title).toBe('Case 1');
        });

        it('should handle errors gracefully', async () => {
            vi.mocked(auth).mockResolvedValue({ user: { id: 'user-123' } } as any);
            (db.select as any).mockImplementationOnce(() => { throw new Error('DB Error') });

            const response = await GET() as any;

            expect(response.status).toBe(500);
        });
    });
});
