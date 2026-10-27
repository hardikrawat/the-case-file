import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '@/app/api/boards/[id]/versions/route';
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

// Mock auth-checks
vi.mock('@/lib/auth-checks', () => ({
    getBoardAccess: vi.fn(),
}));

// Mock DB
vi.mock('@/lib/db', () => ({
    db: {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockResolvedValue([]),
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([]),
    },
}));

// Mock cuid
vi.mock('@paralleldrive/cuid2', () => ({
    createId: vi.fn().mockReturnValue('version-123'),
}));

const createRequest = (body: any = null, searchParams: Record<string, string> = {}) => {
    const url = new URL('http://localhost:3000/api/boards/board-1/versions');
    Object.entries(searchParams).forEach(([k, v]) => url.searchParams.set(k, v));
    const rawText = body !== null ? JSON.stringify(body) : '';
    return {
        url: url.toString(),
        text: async () => rawText,
        json: async () => body,
        headers: new Map(),
    } as unknown as NextRequest;
};

const createRawRequest = (rawText: string) => {
    const url = new URL('http://localhost:3000/api/boards/board-1/versions');
    return {
        url: url.toString(),
        text: async () => rawText,
        json: async () => JSON.parse(rawText),
        headers: new Map(),
    } as unknown as NextRequest;
};

describe('/api/boards/[id]/versions', () => {
    const params = { params: Promise.resolve({ id: 'board-1' }) };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('GET', () => {
        it('should return 401 if unauthenticated', async () => {
            vi.mocked(auth).mockResolvedValue(null as any);
            const req = createRequest();
            const res = await GET(req, params) as any;
            expect(res.status).toBe(401);
        });

        it('should return 404 if board does not exist', async () => {
            vi.mocked(auth).mockResolvedValue({ user: { id: 'user-1' } } as any);
            vi.mocked(getBoardAccess).mockResolvedValue({
                board: null,
                canView: false,
                canEdit: false,
                isOwner: false,
            });
            const req = createRequest();
            const res = await GET(req, params) as any;
            expect(res.status).toBe(404);
        });

        it('should return 403 if user cannot view board', async () => {
            vi.mocked(auth).mockResolvedValue({ user: { id: 'user-2' } } as any);
            vi.mocked(getBoardAccess).mockResolvedValue({
                board: { id: 'board-1', userId: 'user-1', title: 'Test' },
                canView: false,
                canEdit: false,
                isOwner: false,
            });
            const req = createRequest();
            const res = await GET(req, params) as any;
            expect(res.status).toBe(403);
        });

        it('should return version list with parsed metadata', async () => {
            vi.mocked(auth).mockResolvedValue({ user: { id: 'user-1' } } as any);
            vi.mocked(getBoardAccess).mockResolvedValue({
                board: { id: 'board-1', userId: 'user-1', title: 'Test' },
                canView: true,
                canEdit: true,
                isOwner: true,
            });

            vi.mocked(db.select).mockReturnValue({
                from: vi.fn().mockReturnThis(),
                leftJoin: vi.fn().mockReturnThis(),
                where: vi.fn().mockReturnThis(),
                orderBy: vi.fn().mockReturnThis(),
                limit: vi.fn().mockReturnThis(),
                offset: vi.fn().mockResolvedValue([
                    {
                        id: 'v1',
                        boardId: 'board-1',
                        content: JSON.stringify({
                            nodes: [],
                            _metadata: { notes: 'Breakthrough clue discovered', isManual: true },
                        }),
                        createdBy: 'user-1',
                        createdAt: new Date(),
                        creatorName: 'Sherlock',
                        creatorImage: '/avatar.png',
                    },
                ]),
            } as any);

            const req = createRequest();
            const res = await GET(req, params) as any;
            expect(res.status).toBe(200);
            expect(res.data).toHaveLength(1);
            expect(res.data[0].notes).toBe('Breakthrough clue discovered');
            expect(res.data[0].isManual).toBe(true);
        });
    });

    describe('POST', () => {
        it('should return 401 if unauthenticated', async () => {
            vi.mocked(auth).mockResolvedValue(null as any);
            const req = createRequest({ content: { nodes: [] } });
            const res = await POST(req, params) as any;
            expect(res.status).toBe(401);
        });

        it('should return 403 if user cannot edit board (e.g. viewer)', async () => {
            vi.mocked(auth).mockResolvedValue({ user: { id: 'viewer-1' } } as any);
            vi.mocked(getBoardAccess).mockResolvedValue({
                board: { id: 'board-1', userId: 'owner-1', title: 'Test' },
                canView: true,
                canEdit: false,
                isOwner: false,
            });

            const req = createRequest({ content: { nodes: [] } });
            const res = await POST(req, params) as any;
            expect(res.status).toBe(403);
        });

        it('should return 413 if version payload exceeds 5MB limit', async () => {
            vi.mocked(auth).mockResolvedValue({ user: { id: 'user-1' } } as any);
            vi.mocked(getBoardAccess).mockResolvedValue({
                board: { id: 'board-1', userId: 'user-1', title: 'Test' },
                canView: true,
                canEdit: true,
                isOwner: true,
            });

            // Fake a 6MB text payload
            const oversizedText = 'a'.repeat(6 * 1024 * 1024);
            const req = createRawRequest(oversizedText);
            const res = await POST(req, params) as any;
            expect(res.status).toBe(413);
            expect(res.data.error).toContain('5MB');
        });

        it('should sanitize notes to strip HTML and script tags for XSS protection', async () => {
            vi.mocked(auth).mockResolvedValue({
                user: { id: 'user-1', name: 'Detective', image: null },
            } as any);
            vi.mocked(getBoardAccess).mockResolvedValue({
                board: { id: 'board-1', userId: 'user-1', title: 'Test' },
                canView: true,
                canEdit: true,
                isOwner: true,
            });

            let insertedValues: any = null;
            vi.mocked(db.insert).mockReturnValue({
                values: vi.fn((vals) => {
                    insertedValues = vals;
                    return {
                        returning: vi.fn().mockResolvedValue([vals]),
                    };
                }),
            } as any);

            const req = createRequest({
                content: { nodes: [{ id: 'n1' }] },
                notes: '<script>alert("xss")</script>Important <b>crime</b> scene note',
                isManual: true,
            });

            const res = await POST(req, params) as any;
            expect(res.status).toBe(201);
            expect(res.data.notes).not.toContain('<script>');
            expect(res.data.notes).not.toContain('<b>');
            expect(res.data.notes).toBe('alert("xss")Important crime scene note');
            expect(insertedValues.content._metadata.notes).toBe('alert("xss")Important crime scene note');
        });
    });
});
