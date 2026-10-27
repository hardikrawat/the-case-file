import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST, DELETE } from '@/app/api/boards/[id]/collaborators/route';
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
        limit: vi.fn().mockResolvedValue([]),
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([]),
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
    },
}));

// Mock cuid
vi.mock('@paralleldrive/cuid2', () => ({
    createId: vi.fn().mockReturnValue('collab-new-123'),
}));

const createRequest = (body: any = null, searchParams: Record<string, string> = {}) => {
    const url = new URL('http://localhost:3000/api/boards/board-1/collaborators');
    Object.entries(searchParams).forEach(([k, v]) => url.searchParams.set(k, v));
    return {
        url: url.toString(),
        json: async () => body,
        headers: new Map(),
    } as unknown as NextRequest;
};

describe('/api/boards/[id]/collaborators', () => {
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

        it('should return 403 if user cannot view board', async () => {
            vi.mocked(auth).mockResolvedValue({ user: { id: 'unauthorized-user' } } as any);
            vi.mocked(getBoardAccess).mockResolvedValue({
                board: { id: 'board-1', userId: 'owner-1', title: 'Case X' },
                canView: false,
                canEdit: false,
                isOwner: false,
            });

            const req = createRequest();
            const res = await GET(req, params) as any;
            expect(res.status).toBe(403);
        });

        it('should return live roster with owner (role: owner) and active collaborators', async () => {
            vi.mocked(auth).mockResolvedValue({ user: { id: 'owner-1' } } as any);
            vi.mocked(getBoardAccess).mockResolvedValue({
                board: { id: 'board-1', userId: 'owner-1', title: 'Case X', createdAt: new Date() },
                canView: true,
                canEdit: true,
                isOwner: true,
            });

            // 1st select: active collaborators
            // 2nd select: owner user details
            const activeCollab = [
                {
                    id: 'collab-1',
                    userId: 'investigator-2',
                    role: 'editor',
                    addedAt: new Date(),
                    userName: 'Watson',
                    userEmail: 'watson@bakerst.com',
                    userImage: null,
                },
            ];
            const ownerDetails = [
                {
                    id: 'owner-1',
                    name: 'Holmes',
                    email: 'holmes@bakerst.com',
                    image: null,
                },
            ];

            let callCount = 0;
            vi.mocked(db.select).mockReturnValue({
                from: vi.fn().mockReturnThis(),
                leftJoin: vi.fn().mockReturnThis(),
                where: vi.fn(() => {
                    callCount++;
                    if (callCount === 1) {
                        return Promise.resolve(activeCollab);
                    }
                    return {
                        limit: vi.fn().mockResolvedValue(ownerDetails),
                    };
                }),
            } as any);

            const req = createRequest();
            const res = await GET(req, params) as any;
            expect(res.status).toBe(200);
            expect(res.data).toHaveLength(2);
            expect(res.data[0].role).toBe('owner');
            expect(res.data[0].isLeadOwner).toBe(true);
            expect(res.data[0].userName).toBe('Holmes');
            expect(res.data[1].role).toBe('editor');
            expect(res.data[1].isLeadOwner).toBe(false);
            expect(res.data[1].userName).toBe('Watson');
        });
    });

    describe('POST', () => {
        it('should return 403 if non-owner attempts to invite collaborator', async () => {
            vi.mocked(auth).mockResolvedValue({ user: { id: 'editor-1' } } as any);
            vi.mocked(getBoardAccess).mockResolvedValue({
                board: { id: 'board-1', userId: 'owner-1', title: 'Case X' },
                canView: true,
                canEdit: true,
                isOwner: false,
            });

            const req = createRequest({ userId: 'investigator-2', role: 'editor' });
            const res = await POST(req, params) as any;
            expect(res.status).toBe(403);
            expect(res.data.error).toContain('Only board owner');
        });

        it('should return 400 if user tries to add the board owner', async () => {
            vi.mocked(auth).mockResolvedValue({ user: { id: 'owner-1' } } as any);
            vi.mocked(getBoardAccess).mockResolvedValue({
                board: { id: 'board-1', userId: 'owner-1', title: 'Case X' },
                canView: true,
                canEdit: true,
                isOwner: true,
            });

            vi.mocked(db.select).mockReturnValue({
                from: vi.fn().mockReturnThis(),
                where: vi.fn().mockReturnThis(),
                limit: vi.fn().mockResolvedValue([{ id: 'owner-1', email: 'owner@test.com' }]),
            } as any);

            const req = createRequest({ userId: 'owner-1', role: 'editor' });
            const res = await POST(req, params) as any;
            expect(res.status).toBe(400);
            expect(res.data.error).toBe('User is the board owner');
        });

        it('should reactivate soft-deleted collaborator if re-invited', async () => {
            vi.mocked(auth).mockResolvedValue({ user: { id: 'owner-1' } } as any);
            vi.mocked(getBoardAccess).mockResolvedValue({
                board: { id: 'board-1', userId: 'owner-1', title: 'Case X' },
                canView: true,
                canEdit: true,
                isOwner: true,
            });

            let selectStep = 0;
            vi.mocked(db.select).mockReturnValue({
                from: vi.fn().mockReturnThis(),
                where: vi.fn().mockReturnThis(),
                limit: vi.fn(() => {
                    selectStep++;
                    if (selectStep === 1) {
                        return Promise.resolve([{ id: 'investigator-2', email: 'inv2@test.com' }]);
                    }
                    // Existing record was soft-deleted
                    return Promise.resolve([
                        {
                            id: 'existing-collab-1',
                            boardId: 'board-1',
                            userId: 'investigator-2',
                            role: 'viewer',
                            deletedAt: new Date(Date.now() - 10000),
                        },
                    ]);
                }),
            } as any);

            let updatedFields: any = null;
            vi.mocked(db.update).mockReturnValue({
                set: vi.fn((vals) => {
                    updatedFields = vals;
                    return {
                        where: vi.fn().mockReturnValue({
                            returning: vi.fn().mockResolvedValue([{
                                id: 'existing-collab-1',
                                boardId: 'board-1',
                                userId: 'investigator-2',
                                ...vals,
                            }]),
                        }),
                    };
                }),
            } as any);

            const req = createRequest({ userId: 'investigator-2', role: 'editor' });
            const res = await POST(req, params) as any;
            expect(res.status).toBe(201);
            expect(updatedFields.deletedAt).toBeNull();
            expect(updatedFields.role).toBe('editor');
        });
    });

    describe('DELETE', () => {
        it('should return 403 if non-owner attempts to remove collaborator', async () => {
            vi.mocked(auth).mockResolvedValue({ user: { id: 'viewer-1' } } as any);
            vi.mocked(getBoardAccess).mockResolvedValue({
                board: { id: 'board-1', userId: 'owner-1', title: 'Case X' },
                canView: true,
                canEdit: false,
                isOwner: false,
            });

            const req = createRequest(null, { collaboratorId: 'collab-1' });
            const res = await DELETE(req, params) as any;
            expect(res.status).toBe(403);
        });

        it('should soft-delete collaborator by updating deletedAt timestamp', async () => {
            vi.mocked(auth).mockResolvedValue({ user: { id: 'owner-1' } } as any);
            vi.mocked(getBoardAccess).mockResolvedValue({
                board: { id: 'board-1', userId: 'owner-1', title: 'Case X' },
                canView: true,
                canEdit: true,
                isOwner: true,
            });

            let updatedPayload: any = null;
            vi.mocked(db.update).mockReturnValue({
                set: vi.fn((vals) => {
                    updatedPayload = vals;
                    return {
                        where: vi.fn().mockReturnValue({
                            returning: vi.fn().mockResolvedValue([
                                {
                                    id: 'collab-1',
                                    boardId: 'board-1',
                                    userId: 'user-2',
                                    deletedAt: vals.deletedAt,
                                },
                            ]),
                        }),
                    };
                }),
            } as any);

            const req = createRequest(null, { collaboratorId: 'collab-1' });
            const res = await DELETE(req, params) as any;
            expect(res.status).toBe(200);
            expect(res.data.success).toBe(true);
            expect(updatedPayload.deletedAt).toBeInstanceOf(Date);
        });
    });
});
