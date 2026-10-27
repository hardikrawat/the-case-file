import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '@/app/api/contributions/route';
import { POST as MERGE } from '@/app/api/contributions/[id]/merge/route';
import { POST as REJECT } from '@/app/api/contributions/[id]/reject/route';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { getBoardAccess } from '@/lib/auth-checks';
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

// Mock rate-limit
vi.mock('@/lib/rate-limit', () => ({
    checkRateLimit: vi.fn().mockResolvedValue({ success: true, reset: Date.now() + 60000 }),
}));

// Mock reputation
vi.mock('@/lib/reputation', () => ({
    awardPoints: vi.fn().mockResolvedValue(undefined),
}));

// Mock auth-checks
vi.mock('@/lib/auth-checks', () => ({
    getBoardAccess: vi.fn(),
}));

// Mock DB
vi.mock('@/lib/db', () => ({
    db: {
        query: {
            contributions: {
                findFirst: vi.fn(),
            },
            boards: {
                findFirst: vi.fn(),
            },
        },
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([]),
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
    },
}));

// Mock cuid
vi.mock('@paralleldrive/cuid2', () => ({
    createId: vi.fn().mockReturnValue('contrib-123'),
}));

const createRequest = (body: any = null, searchParams: Record<string, string> = {}) => {
    const url = new URL('http://localhost:3000/api/contributions');
    Object.entries(searchParams).forEach(([k, v]) => url.searchParams.set(k, v));
    return {
        url: url.toString(),
        json: async () => body,
        headers: new Map(),
    } as unknown as NextRequest;
};

describe('/api/contributions Engine', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('POST /api/contributions (Submit Suggestion)', () => {
        it('should return 401 if unauthenticated', async () => {
            vi.mocked(auth).mockResolvedValue(null as any);
            const req = createRequest({ targetBoardId: 'board-1', snapshot: { nodes: [] } });
            const res = await POST(req) as any;
            expect(res.status).toBe(401);
        });

        it('should return 400 if snapshot has invalid node schema', async () => {
            vi.mocked(auth).mockResolvedValue({ user: { id: 'sleuth-1' } } as any);
            vi.mocked(getBoardAccess).mockResolvedValue({
                board: { id: 'board-1', userId: 'owner-1', title: 'Cold Case' },
                canView: true,
                canEdit: true,
                isOwner: false,
            });

            // Node missing 'id' string field
            const req = createRequest({
                targetBoardId: 'board-1',
                snapshot: {
                    nodes: [{ type: 'note', position: { x: 10, y: 20 } }],
                },
            });

            const res = await POST(req) as any;
            expect(res.status).toBe(400);
            expect(res.data.error).toBe('Invalid input');
        });

        it('should submit valid suggestion and return 201', async () => {
            vi.mocked(auth).mockResolvedValue({ user: { id: 'sleuth-1' } } as any);
            vi.mocked(getBoardAccess).mockResolvedValue({
                board: { id: 'board-1', userId: 'owner-1', title: 'Cold Case' },
                canView: true,
                canEdit: false,
                isOwner: false,
            });

            vi.mocked(db.insert).mockReturnValue({
                values: vi.fn().mockReturnThis(),
                returning: vi.fn().mockResolvedValue([
                    {
                        id: 'contrib-123',
                        boardId: 'board-1',
                        userId: 'sleuth-1',
                        status: 'pending',
                        message: 'Found murder weapon connection',
                    },
                ]),
            } as any);

            const req = createRequest({
                targetBoardId: 'board-1',
                message: 'Found murder weapon connection',
                snapshot: {
                    nodes: [{ id: 'clue-99', type: 'clue', data: { label: 'Revolver' } }],
                    edges: [{ id: 'edge-99', source: 'clue-1', target: 'clue-99' }],
                },
            });

            const res = await POST(req) as any;
            expect(res.status).toBe(201);
            expect(res.data.id).toBe('contrib-123');
            expect(res.data.status).toBe('pending');
        });
    });

    describe('POST /api/contributions/[id]/merge', () => {
        const mergeParams = { params: Promise.resolve({ id: 'contrib-123' }) };

        it('should return 403 if non-owner tries to merge proposal', async () => {
            vi.mocked(auth).mockResolvedValue({ user: { id: 'editor-1' } } as any);

            (db.query.contributions.findFirst as any).mockResolvedValue({
                id: 'contrib-123',
                boardId: 'board-1',
                userId: 'sleuth-2',
                status: 'pending',
                snapshot: { nodes: [], edges: [] },
            });

            (db.query.boards.findFirst as any).mockResolvedValue({
                id: 'board-1',
                userId: 'owner-lead',
                content: { nodes: [], edges: [] },
                version: 1,
            });

            vi.mocked(getBoardAccess).mockResolvedValue({
                board: { id: 'board-1', userId: 'owner-lead', title: 'Cold Case' },
                canView: true,
                canEdit: true,
                isOwner: false, // Not lead owner
            });

            const req = createRequest();
            const res = await MERGE(req as any, mergeParams) as any;
            expect(res.status).toBe(403);
            expect(res.data.error).toContain('Only board owners can accept and merge');
        });

        it('should allow lead owner to merge suggestion into target board', async () => {
            vi.mocked(auth).mockResolvedValue({ user: { id: 'owner-lead' } } as any);

            (db.query.contributions.findFirst as any).mockResolvedValue({
                id: 'contrib-123',
                boardId: 'board-1',
                userId: 'sleuth-2',
                status: 'pending',
                snapshot: {
                    nodes: [{ id: 'clue-new', type: 'polaroid', data: { title: 'Suspect photo' } }],
                    edges: [],
                },
            });

            (db.query.boards.findFirst as any).mockResolvedValue({
                id: 'board-1',
                userId: 'owner-lead',
                content: { nodes: [{ id: 'clue-old' }], edges: [] },
                version: 1,
            });

            vi.mocked(getBoardAccess).mockResolvedValue({
                board: { id: 'board-1', userId: 'owner-lead', title: 'Cold Case' },
                canView: true,
                canEdit: true,
                isOwner: true,
            });

            vi.mocked(db.update).mockReturnValue({
                set: vi.fn().mockReturnThis(),
                where: vi.fn().mockReturnValue({
                    returning: vi.fn().mockResolvedValue([{ id: 'board-1' }]),
                }),
            } as any);

            const req = createRequest();
            const res = await MERGE(req as any, mergeParams) as any;
            expect(res.status).toBe(200);
            expect(res.data.success).toBe(true);
            expect(res.data.status).toBe('merged');
        });
    });

    describe('POST /api/contributions/[id]/reject', () => {
        const rejectParams = { params: Promise.resolve({ id: 'contrib-123' }) };

        it('should allow reviewer to reject with feedback reason', async () => {
            vi.mocked(auth).mockResolvedValue({ user: { id: 'reviewer-1' } } as any);

            (db.query.contributions.findFirst as any).mockResolvedValue({
                id: 'contrib-123',
                boardId: 'board-1',
                userId: 'author-2',
                status: 'pending',
            });

            (db.query.boards.findFirst as any).mockResolvedValue({
                id: 'board-1',
                userId: 'owner-1',
                title: 'Cold Case',
            });

            vi.mocked(getBoardAccess).mockResolvedValue({
                board: { id: 'board-1', userId: 'owner-1', title: 'Cold Case' },
                canView: true,
                canEdit: true,
                isOwner: false,
            });

            let updatedStatus: any = null;
            vi.mocked(db.update).mockReturnValue({
                set: vi.fn((vals) => {
                    updatedStatus = vals;
                    return {
                        where: vi.fn().mockResolvedValue([]),
                    };
                }),
            } as any);

            const req = createRequest({ reason: 'Insufficient alibi evidence' });
            const res = await REJECT(req as any, rejectParams) as any;
            expect(res.status).toBe(200);
            expect(res.data.success).toBe(true);
            expect(res.data.status).toBe('rejected');
            expect(res.data.withdrawn).toBe(false);
            expect(updatedStatus.rejectionReason).toBe('Insufficient alibi evidence');
        });

        it('should allow author to withdraw their own proposal', async () => {
            vi.mocked(auth).mockResolvedValue({ user: { id: 'author-2' } } as any);

            (db.query.contributions.findFirst as any).mockResolvedValue({
                id: 'contrib-123',
                boardId: 'board-1',
                userId: 'author-2',
                status: 'pending',
            });

            (db.query.boards.findFirst as any).mockResolvedValue({
                id: 'board-1',
                userId: 'owner-1',
                title: 'Cold Case',
            });

            vi.mocked(getBoardAccess).mockResolvedValue({
                board: { id: 'board-1', userId: 'owner-1', title: 'Cold Case' },
                canView: true,
                canEdit: false,
                isOwner: false,
            });

            let updatedStatus: any = null;
            vi.mocked(db.update).mockReturnValue({
                set: vi.fn((vals) => {
                    updatedStatus = vals;
                    return {
                        where: vi.fn().mockResolvedValue([]),
                    };
                }),
            } as any);

            const req = createRequest({});
            const res = await REJECT(req as any, rejectParams) as any;
            expect(res.status).toBe(200);
            expect(res.data.success).toBe(true);
            expect(res.data.withdrawn).toBe(true);
            expect(updatedStatus.rejectionReason).toBe('Withdrawn by author');
        });
    });
});
