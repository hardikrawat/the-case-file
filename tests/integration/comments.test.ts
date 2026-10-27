import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '@/app/api/comments/route';
import { PUT, DELETE } from '@/app/api/comments/[id]/route';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { comments } from '@/lib/schema';
import { NextRequest } from 'next/server';

// Mock Next.js modules
vi.mock('next/server', () => ({
    NextRequest: vi.fn(),
    NextResponse: {
        json: vi.fn((data, init) => ({ data, status: init?.status || 200 })),
    },
}));

// Mock auth
vi.mock('@/auth', () => ({
    auth: vi.fn(),
}));

// Mock reputation
vi.mock('@/lib/reputation', () => ({
    awardPoints: vi.fn().mockResolvedValue(undefined),
}));

// Mock DB
vi.mock('@/lib/db', () => ({
    db: {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
        orderBy: vi.fn().mockResolvedValue([]),
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([]),
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
    },
}));

// Mock cuid
vi.mock('@paralleldrive/cuid2', () => ({
    createId: vi.fn().mockReturnValue('comment-123'),
}));

// Mock rate-limit
vi.mock('@/lib/rate-limit', () => ({
    checkRateLimit: vi.fn().mockResolvedValue({ success: true, reset: Date.now() + 60000 }),
}));

import { getBoardAccess } from '@/lib/auth-checks';

// Mock auth-checks
vi.mock('@/lib/auth-checks', () => ({
    getBoardAccess: vi.fn().mockResolvedValue({
        board: { id: 'board-1', isPublic: true },
        canView: true,
        canEdit: true,
        isOwner: false,
    }),
}));

// Helper to create NextRequest with search params
const createRequest = (body: any = null, searchParams: Record<string, string> = {}) => {
    const url = new URL('http://localhost:3000/api/comments');
    Object.entries(searchParams).forEach(([k, v]) => url.searchParams.set(k, v));
    return {
        url: url.toString(),
        json: () => Promise.resolve(body),
        headers: new Map(),
    } as unknown as NextRequest;
};

describe('/api/comments', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('GET', () => {
        it('should return 401 if unauthorized', async () => {
            vi.mocked(auth).mockResolvedValue(null as any);
            const req = createRequest(null, { boardId: 'board-1' });
            const response = await GET(req) as any;
            expect(response.status).toBe(401);
        });

        it('should return 400 if boardId missing', async () => {
            vi.mocked(auth).mockResolvedValue({ user: { id: 'user-1' } } as any);
            const req = createRequest();
            const response = await GET(req) as any;
            expect(response.status).toBe(400);
        });

        it('should return comments for board', async () => {
            vi.mocked(auth).mockResolvedValue({ user: { id: 'user-1' } } as any);
            vi.mocked(db.select).mockReturnValue({
                from: vi.fn().mockReturnThis(),
                leftJoin: vi.fn().mockReturnThis(),
                where: vi.fn().mockReturnThis(),
                orderBy: vi.fn().mockResolvedValue([{ id: 'c1', content: 'test', userName: 'Detective' }]),
            } as any);

            const req = createRequest(null, { boardId: 'board-1' });
            const response = await GET(req) as any;
            expect(response.status).toBe(200);
            expect(response.data).toHaveLength(1);
        });
    });

    describe('POST', () => {
        it('should return 401 if unauthorized', async () => {
            vi.mocked(auth).mockResolvedValue(null as any);
            const req = createRequest({});
            const response = await POST(req) as any;
            expect(response.status).toBe(401);
        });

        it('should return 400 if fields missing', async () => {
            vi.mocked(auth).mockResolvedValue({ user: { id: 'user-1' } } as any);
            const req = createRequest({});
            const response = await POST(req) as any;
            expect(response.status).toBe(400);
        });

        it('should create comment', async () => {
            vi.mocked(auth).mockResolvedValue({ user: { id: 'user-1' } } as any);
            vi.mocked(db.insert).mockReturnValue({
                values: vi.fn().mockReturnThis(),
                returning: vi.fn().mockResolvedValue([{ id: 'comment-123' }]),
            } as any);

            const req = createRequest({ boardId: 'board-1', content: 'hello' });
            const response = await POST(req) as any;
            expect(response.status).toBe(201);
            expect(response.data.id).toBe('comment-123');
        });
    });

    describe('PUT /[id]', () => {
        const params = { params: Promise.resolve({ id: 'c1' }) };

        it('should return 401 if unauthorized', async () => {
            vi.mocked(auth).mockResolvedValue(null as any);
            const req = createRequest({});
            const response = await PUT(req, params) as any;
            expect(response.status).toBe(401);
        });

        it('should return 404 if comment not found', async () => {
            vi.mocked(auth).mockResolvedValue({ user: { id: 'user-1' } } as any);
            vi.mocked(db.select).mockReturnValue({
                from: vi.fn().mockReturnThis(),
                where: vi.fn().mockReturnThis(),
                limit: vi.fn().mockResolvedValue([]),
            } as any);

            const req = createRequest({ content: 'update' });
            const response = await PUT(req, params) as any;
            expect(response.status).toBe(404);
        });

        it('should return 403 if forbidden', async () => {
            vi.mocked(auth).mockResolvedValue({ user: { id: 'user-1' } } as any);
            vi.mocked(db.select).mockReturnValue({
                from: vi.fn().mockReturnThis(),
                where: vi.fn().mockReturnThis(),
                limit: vi.fn().mockResolvedValue([{ id: 'c1', userId: 'user-2' }]),
            } as any);

            const req = createRequest({ content: 'update' });
            const response = await PUT(req, params) as any;
            expect(response.status).toBe(403);
        });

        it('should update comment', async () => {
            vi.mocked(auth).mockResolvedValue({ user: { id: 'user-1' } } as any);
            vi.mocked(db.select).mockReturnValue({
                from: vi.fn().mockReturnThis(),
                where: vi.fn().mockReturnThis(),
                limit: vi.fn().mockResolvedValue([{ id: 'c1', userId: 'user-1' }]),
            } as any);
            vi.mocked(db.update).mockReturnValue({
                set: vi.fn().mockReturnThis(),
                where: vi.fn().mockReturnThis(),
                returning: vi.fn().mockResolvedValue([{ id: 'c1', content: 'updated' }]),
            } as any);

            const req = createRequest({ content: 'updated' });
            const response = await PUT(req, params) as any;
            expect(response.status).toBe(200);
            expect(response.data.content).toBe('updated');
        });
    });

    describe('DELETE /[id]', () => {
        const params = { params: Promise.resolve({ id: 'c1' }) };

        it('should return 403 if forbidden', async () => {
            vi.mocked(auth).mockResolvedValue({ user: { id: 'user-1' } } as any);
            vi.mocked(db.select).mockReturnValue({
                from: vi.fn().mockReturnThis(),
                where: vi.fn().mockReturnThis(),
                limit: vi.fn().mockResolvedValue([{ id: 'c1', userId: 'user-2' }]),
            } as any);

            const req = createRequest({});
            const response = await DELETE(req, params) as any;
            expect(response.status).toBe(403);
        });

        it('should delete comment', async () => {
            vi.mocked(auth).mockResolvedValue({ user: { id: 'user-1' } } as any);
            vi.mocked(db.select).mockReturnValue({
                from: vi.fn().mockReturnThis(),
                where: vi.fn().mockReturnThis(),
                limit: vi.fn().mockResolvedValue([{ id: 'c1', userId: 'user-1' }]),
            } as any);

            const req = createRequest({});
            const response = await DELETE(req, params) as any;
            expect(response.status).toBe(200);
            expect(db.delete).toHaveBeenCalled();
        });

        it('should allow board owner to delete comments from other users', async () => {
            vi.mocked(auth).mockResolvedValue({ user: { id: 'owner-1' } } as any);
            vi.mocked(getBoardAccess).mockResolvedValueOnce({
                board: { id: 'board-1', isPublic: true },
                canView: true,
                canEdit: true,
                isOwner: true,
            } as any);
            vi.mocked(db.select).mockReturnValue({
                from: vi.fn().mockReturnThis(),
                where: vi.fn().mockReturnThis(),
                limit: vi.fn().mockResolvedValue([{ id: 'c1', userId: 'author-2', boardId: 'board-1' }]),
            } as any);

            const req = createRequest({});
            const response = await DELETE(req, params) as any;
            expect(response.status).toBe(200);
            expect(db.delete).toHaveBeenCalled();
        });
    });
});
