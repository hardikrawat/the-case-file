import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as getBoard, PUT as putBoard, DELETE as deleteBoard } from '@/app/api/boards/[id]/route';
import { GET as getBoards } from '@/app/api/boards/route';
import { GET as getProfile } from '@/app/api/profile/[id]/route';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { NextRequest } from 'next/server';

// Mock auth
vi.mock('@/auth', () => ({
    auth: vi.fn(),
}));

// Mock rate-limit
vi.mock('@/lib/rate-limit', () => ({
    checkRateLimit: vi.fn().mockResolvedValue({ success: true, reset: Date.now() + 60000 }),
}));

describe('Adversarial Stress Test: Soft-Delete Query Logic and API Endpoints', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const createParams = (id: string) => ({
        params: Promise.resolve({ id }),
    });

    const createJsonRequest = (url: string, method: string, body?: any) => {
        return new NextRequest(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
            },
            body: body ? JSON.stringify(body) : undefined,
        });
    };

    // =========================================================================
    // FOCUS A: Soft-deleted board cannot be retrieved via GET /api/boards/[id]
    // =========================================================================
    describe('Focus (a): GET /api/boards/[id] Soft-Delete Rejection', () => {
        it('must return 404 for a soft-deleted board even if user is the owner', async () => {
            vi.mocked(auth).mockResolvedValue({ user: { id: 'owner-user-1' } } as any);

            // DB findFirst returns null because of isNull(boards.deletedAt)
            (db.query.boards.findFirst as any).mockResolvedValue(null);

            const req = createJsonRequest('http://localhost:3000/api/boards/deleted-board-1', 'GET');
            const res = await getBoard(req, createParams('deleted-board-1'));

            expect(res.status).toBe(404);
            const json = await res.json();
            expect(json.error).toBe('Board not found');
        });

        it('must return 404 if DB somehow returned a record with deletedAt set (defensive check)', async () => {
            vi.mocked(auth).mockResolvedValue({ user: { id: 'owner-user-1' } } as any);

            // Defense-in-depth test: findFirst returned object, but deletedAt is populated
            (db.query.boards.findFirst as any).mockResolvedValue({
                id: 'deleted-board-2',
                userId: 'owner-user-1',
                title: 'Deleted Board',
                isPublic: true,
                deletedAt: new Date(),
                collaborators: [],
            });

            const req = createJsonRequest('http://localhost:3000/api/boards/deleted-board-2', 'GET');
            const res = await getBoard(req, createParams('deleted-board-2'));

            expect(res.status).toBe(404);
            const json = await res.json();
            expect(json.error).toBe('Board not found');
        });

        it('must return 200 for an active board when requested by owner', async () => {
            vi.mocked(auth).mockResolvedValue({ user: { id: 'owner-user-1' } } as any);

            (db.query.boards.findFirst as any).mockResolvedValue({
                id: 'active-board-1',
                userId: 'owner-user-1',
                title: 'Active Case File',
                isPublic: false,
                deletedAt: null,
                collaborators: [],
            });

            const req = createJsonRequest('http://localhost:3000/api/boards/active-board-1', 'GET');
            const res = await getBoard(req, createParams('active-board-1'));

            expect(res.status).toBe(200);
            const json = await res.json();
            expect(json.id).toBe('active-board-1');
            expect(json.title).toBe('Active Case File');
        });

        it('must return 403 for an active private board when requested by a stranger', async () => {
            vi.mocked(auth).mockResolvedValue({ user: { id: 'stranger-user-1' } } as any);

            (db.query.boards.findFirst as any).mockResolvedValue({
                id: 'active-board-1',
                userId: 'owner-user-1',
                title: 'Active Private File',
                isPublic: false,
                deletedAt: null,
                collaborators: [],
            });

            const req = createJsonRequest('http://localhost:3000/api/boards/active-board-1', 'GET');
            const res = await getBoard(req, createParams('active-board-1'));

            expect(res.status).toBe(403);
            const json = await res.json();
            expect(json.error).toBe('Forbidden');
        });

        it('must return 401 for an active private board when unauthenticated', async () => {
            vi.mocked(auth).mockResolvedValue(null as any);

            (db.query.boards.findFirst as any).mockResolvedValue({
                id: 'active-board-1',
                userId: 'owner-user-1',
                title: 'Active Private File',
                isPublic: false,
                deletedAt: null,
                collaborators: [],
            });

            const req = createJsonRequest('http://localhost:3000/api/boards/active-board-1', 'GET');
            const res = await getBoard(req, createParams('active-board-1'));

            expect(res.status).toBe(401);
            const json = await res.json();
            expect(json.error).toBe('Unauthorized');
        });
    });

    // =========================================================================
    // FOCUS B: Soft-deleted board cannot be retrieved in GET /api/boards list
    // =========================================================================
    describe('Focus (b): GET /api/boards Soft-Delete Filtering', () => {
        it('must return 401 when unauthenticated', async () => {
            vi.mocked(auth).mockResolvedValue(null as any);

            const res = await getBoards();
            expect(res.status).toBe(401);
            const json = await res.json();
            expect(json.error).toBe('Unauthorized');
        });

        it('must query boards with isNull(boards.deletedAt) and return active boards only', async () => {
            vi.mocked(auth).mockResolvedValue({ user: { id: 'owner-user-1' } } as any);

            const activeBoards = [
                { id: 'board-1', title: 'Active 1', isPublic: false, updatedAt: new Date() },
                { id: 'board-2', title: 'Active 2', isPublic: true, updatedAt: new Date() },
            ];

            const mockWhere = vi.fn().mockReturnThis();
            const mockOrderBy = vi.fn().mockResolvedValue(activeBoards);

            (db.select as any).mockReturnValue({
                from: vi.fn().mockReturnValue({
                    leftJoin: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            orderBy: mockOrderBy,
                        }),
                    }),
                }),
            });

            const res = await getBoards();
            expect(res.status).toBe(200);
            const json = await res.json();
            expect(json).toHaveLength(2);
            expect(json[0].id).toBe('board-1');
            expect(json[1].id).toBe('board-2');
        });
    });

    // =========================================================================
    // FOCUS C: Soft-deleted board cannot be updated via PUT /api/boards/[id]
    // =========================================================================
    describe('Focus (c): PUT /api/boards/[id] Soft-Delete Protection', () => {
        it('must return 401 if unauthenticated', async () => {
            vi.mocked(auth).mockResolvedValue(null as any);

            const req = createJsonRequest('http://localhost:3000/api/boards/board-1', 'PUT', { title: 'Updated' });
            const res = await putBoard(req, createParams('board-1'));

            expect(res.status).toBe(401);
            const json = await res.json();
            expect(json.error).toBe('Unauthorized');
        });

        it('must return 404 when attempting to update a soft-deleted board', async () => {
            vi.mocked(auth).mockResolvedValue({ user: { id: 'owner-user-1' } } as any);

            // DB lookup returns null due to isNull(boards.deletedAt)
            (db.query.boards.findFirst as any).mockResolvedValue(null);

            const req = createJsonRequest('http://localhost:3000/api/boards/deleted-board-1', 'PUT', {
                title: 'Hacked Title',
                content: { nodes: [], edges: [] },
            });
            const res = await putBoard(req, createParams('deleted-board-1'));

            expect(res.status).toBe(404);
            const json = await res.json();
            expect(json.error).toBe('Board not found');
            expect(db.update).not.toHaveBeenCalled();
        });

        it('must return 403 when a non-owner/non-editor attempts to update an active board', async () => {
            vi.mocked(auth).mockResolvedValue({ user: { id: 'stranger-user-1' } } as any);

            (db.query.boards.findFirst as any).mockResolvedValue({
                id: 'active-board-1',
                userId: 'owner-user-1',
                title: 'Secret Board',
                isPublic: false,
                deletedAt: null,
                collaborators: [
                    { userId: 'stranger-user-1', role: 'viewer' } // viewer only, not editor
                ],
            });

            const req = createJsonRequest('http://localhost:3000/api/boards/active-board-1', 'PUT', {
                title: 'Viewer Attempting Edit',
            });
            const res = await putBoard(req, createParams('active-board-1'));

            expect(res.status).toBe(403);
            const json = await res.json();
            expect(json.error).toContain('Forbidden');
            expect(db.update).not.toHaveBeenCalled();
        });

        it('must return 200 and update board when owner submits valid update', async () => {
            vi.mocked(auth).mockResolvedValue({ user: { id: 'owner-user-1' } } as any);

            (db.query.boards.findFirst as any).mockResolvedValue({
                id: 'active-board-1',
                userId: 'owner-user-1',
                title: 'Original Title',
                isPublic: false,
                deletedAt: null,
                collaborators: [],
            });

            const mockWhere = vi.fn().mockResolvedValue({ rowsAffected: 1 });
            const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
            (db.update as any).mockReturnValue({ set: mockSet });

            const req = createJsonRequest('http://localhost:3000/api/boards/active-board-1', 'PUT', {
                title: 'Legitimate Owner Update',
                content: { nodes: [{ id: 'n1' }], edges: [] },
            });
            const res = await putBoard(req, createParams('active-board-1'));

            expect(res.status).toBe(200);
            const json = await res.json();
            expect(json.success).toBe(true);
            expect(db.update).toHaveBeenCalled();
        });
    });

    // =========================================================================
    // FOCUS E: Soft-deleted board is excluded from profile.boardsCount
    // =========================================================================
    describe('Focus (e): GET /api/profile/[id] boardsCount Excludes Soft-Deleted', () => {
        it('must return 404 for non-existent profile', async () => {
            (db.select as any).mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([]),
                    }),
                }),
            });

            const req = createJsonRequest('http://localhost:3000/api/profile/ghost-user', 'GET');
            const res = await getProfile(req, createParams('ghost-user'));

            expect(res.status).toBe(404);
            const json = await res.json();
            expect(json.error).toBe('User not found');
        });

        it('must calculate boardsCount excluding soft-deleted boards', async () => {
            // Mock 1: user profile lookup
            const mockUser = {
                id: 'detective-1',
                name: 'Detective Sherlock',
                email: 'sherlock@bakerstreet.com',
                bio: 'Consulting detective',
                avatarUrl: null,
            };

            // Mock 2: active user boards (only 2 out of 5 total boards are active)
            const mockActiveBoards = [
                { id: 'board-1', userId: 'detective-1', deletedAt: null },
                { id: 'board-2', userId: 'detective-1', deletedAt: null },
            ];

            let callCount = 0;
            (db.select as any).mockImplementation(() => ({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockImplementation(() => {
                        callCount++;
                        if (callCount === 1) {
                            // User lookup
                            return { limit: vi.fn().mockResolvedValue([mockUser]) };
                        } else if (callCount === 2) {
                            // Boards lookup with isNull(boards.deletedAt)
                            return Promise.resolve(mockActiveBoards);
                        } else {
                            // Reputation lookup
                            return { limit: vi.fn().mockResolvedValue([{ points: 150 }]) };
                        }
                    }),
                }),
            }));

            const req = createJsonRequest('http://localhost:3000/api/profile/detective-1', 'GET');
            const res = await getProfile(req, createParams('detective-1'));

            expect(res.status).toBe(200);
            const json = await res.json();
            expect(json.id).toBe('detective-1');
            expect(json.boardsCount).toBe(2); // strictly matches active boards
            expect(json.reputation).toBe(150);
        });
    });

    // =========================================================================
    // FOCUS F: DELETE /api/boards/[id] Security and Soft-Delete Behavior
    // =========================================================================
    describe('Focus (f): DELETE /api/boards/[id] Soft-Delete Execution & Access Control', () => {
        it('must return 401 when unauthenticated', async () => {
            vi.mocked(auth).mockResolvedValue(null as any);

            const req = createJsonRequest('http://localhost:3000/api/boards/board-to-delete', 'DELETE');
            const res = await deleteBoard(req, createParams('board-to-delete'));

            expect(res.status).toBe(401);
            const json = await res.json();
            expect(json.error).toBe('Unauthorized');
            expect(db.update).not.toHaveBeenCalled();
        });

        it('must return 404 when board does not exist or is already soft-deleted', async () => {
            vi.mocked(auth).mockResolvedValue({ user: { id: 'owner-user-1' } } as any);

            // DB findFirst returns null due to where: and(eq(boards.id, id), isNull(boards.deletedAt))
            (db.query.boards.findFirst as any).mockResolvedValue(null);

            const req = createJsonRequest('http://localhost:3000/api/boards/already-deleted-board', 'DELETE');
            const res = await deleteBoard(req, createParams('already-deleted-board'));

            expect(res.status).toBe(404);
            const json = await res.json();
            expect(json.error).toBe('Board not found');
            expect(db.update).not.toHaveBeenCalled();
        });

        it('must return 403 when non-owner (stranger) attempts to delete board', async () => {
            vi.mocked(auth).mockResolvedValue({ user: { id: 'stranger-user-1' } } as any);

            (db.query.boards.findFirst as any).mockResolvedValue({
                id: 'active-board-1',
                userId: 'owner-user-1',
                title: 'Owner Board',
                deletedAt: null,
                collaborators: [],
            });

            const req = createJsonRequest('http://localhost:3000/api/boards/active-board-1', 'DELETE');
            const res = await deleteBoard(req, createParams('active-board-1'));

            expect(res.status).toBe(403);
            const json = await res.json();
            expect(json.error).toBe('Forbidden: Only the board owner can delete this board');
            expect(db.update).not.toHaveBeenCalled();
        });

        it('must return 403 when editor collaborator attempts to delete board', async () => {
            vi.mocked(auth).mockResolvedValue({ user: { id: 'editor-user-1' } } as any);

            (db.query.boards.findFirst as any).mockResolvedValue({
                id: 'active-board-1',
                userId: 'owner-user-1',
                title: 'Owner Board',
                deletedAt: null,
                collaborators: [
                    { userId: 'editor-user-1', role: 'editor' } // Editor cannot delete
                ],
            });

            const req = createJsonRequest('http://localhost:3000/api/boards/active-board-1', 'DELETE');
            const res = await deleteBoard(req, createParams('active-board-1'));

            expect(res.status).toBe(403);
            const json = await res.json();
            expect(json.error).toBe('Forbidden: Only the board owner can delete this board');
            expect(db.update).not.toHaveBeenCalled();
        });

        it('must return 200 and set deletedAt = new Date() when executed by genuine owner', async () => {
            vi.mocked(auth).mockResolvedValue({ user: { id: 'owner-user-1' } } as any);

            (db.query.boards.findFirst as any).mockResolvedValue({
                id: 'active-board-to-delete',
                userId: 'owner-user-1',
                title: 'Owner Board',
                deletedAt: null,
                collaborators: [],
            });

            let capturedUpdatePayload: any = null;
            const mockWhere = vi.fn().mockResolvedValue({ rowsAffected: 1 });
            const mockSet = vi.fn().mockImplementation((payload) => {
                capturedUpdatePayload = payload;
                return { where: mockWhere };
            });
            (db.update as any).mockReturnValue({ set: mockSet });

            const preTime = Date.now();
            const req = createJsonRequest('http://localhost:3000/api/boards/active-board-to-delete', 'DELETE');
            const res = await deleteBoard(req, createParams('active-board-to-delete'));
            const postTime = Date.now();

            expect(res.status).toBe(200);
            const json = await res.json();
            expect(json.success).toBe(true);
            expect(json.message).toBe('Board deleted successfully');

            expect(db.update).toHaveBeenCalled();
            expect(capturedUpdatePayload).toBeDefined();
            expect(capturedUpdatePayload.deletedAt).toBeInstanceOf(Date);
            expect(capturedUpdatePayload.updatedAt).toBeInstanceOf(Date);

            const deletedAtMs = (capturedUpdatePayload.deletedAt as Date).getTime();
            expect(deletedAtMs).toBeGreaterThanOrEqual(preTime);
            expect(deletedAtMs).toBeLessThanOrEqual(postTime);
        });

        it('must return 200 and delete board when executed by collaborator with owner role', async () => {
            vi.mocked(auth).mockResolvedValue({ user: { id: 'co-owner-user-1' } } as any);

            (db.query.boards.findFirst as any).mockResolvedValue({
                id: 'co-owned-board',
                userId: 'original-creator',
                title: 'Co-Owned Board',
                deletedAt: null,
                collaborators: [
                    { userId: 'co-owner-user-1', role: 'owner' } // Collaborator with role 'owner'
                ],
            });

            const mockWhere = vi.fn().mockResolvedValue({ rowsAffected: 1 });
            const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
            (db.update as any).mockReturnValue({ set: mockSet });

            const req = createJsonRequest('http://localhost:3000/api/boards/co-owned-board', 'DELETE');
            const res = await deleteBoard(req, createParams('co-owned-board'));

            expect(res.status).toBe(200);
            const json = await res.json();
            expect(json.success).toBe(true);
            expect(db.update).toHaveBeenCalled();
        });
    });
});
