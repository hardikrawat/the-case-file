import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getBoardAccess } from '@/lib/auth-checks';
import { db } from '@/lib/db';

vi.mock('@/lib/db', () => ({
    db: {
        query: {
            boards: {
                findFirst: vi.fn(),
            },
        },
    },
}));

describe('Authorization Helper: getBoardAccess', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return null access if boardId is empty', async () => {
        const result = await getBoardAccess('', 'user-1');
        expect(result).toEqual({
            board: null,
            canView: false,
            canEdit: false,
            isOwner: false,
        });
    });

    it('should return null access if board does not exist', async () => {
        (db.query.boards.findFirst as any).mockResolvedValue(null);

        const result = await getBoardAccess('missing-id', 'user-1');
        expect(result).toEqual({
            board: null,
            canView: false,
            canEdit: false,
            isOwner: false,
        });
    });

    it('should return null access if board is soft-deleted', async () => {
        (db.query.boards.findFirst as any).mockResolvedValue({
            id: 'deleted-id',
            title: 'Deleted Case',
            userId: 'user-1',
            isPublic: true,
            deletedAt: new Date(),
            collaborators: [],
        });

        const result = await getBoardAccess('deleted-id', 'user-1');
        expect(result).toEqual({
            board: null,
            canView: false,
            canEdit: false,
            isOwner: false,
        });
    });

    it('should allow viewing public boards for strangers or unauthenticated callers', async () => {
        const mockBoard = {
            id: 'public-id',
            title: 'Public Case',
            userId: 'owner-id',
            isPublic: true,
            deletedAt: null,
            collaborators: [],
        };
        (db.query.boards.findFirst as any).mockResolvedValue(mockBoard);

        const unauthResult = await getBoardAccess('public-id');
        expect(unauthResult.canView).toBe(true);
        expect(unauthResult.canEdit).toBe(false);
        expect(unauthResult.isOwner).toBe(false);

        const strangerResult = await getBoardAccess('public-id', 'stranger-id');
        expect(strangerResult.canView).toBe(true);
        expect(strangerResult.canEdit).toBe(false);
        expect(strangerResult.isOwner).toBe(false);
    });

    it('should grant full access to direct board owner', async () => {
        const mockBoard = {
            id: 'owner-id-case',
            title: 'Owner Case',
            userId: 'agent-007',
            isPublic: false,
            deletedAt: null,
            collaborators: [],
        };
        (db.query.boards.findFirst as any).mockResolvedValue(mockBoard);

        const result = await getBoardAccess('owner-id-case', 'agent-007');
        expect(result.canView).toBe(true);
        expect(result.canEdit).toBe(true);
        expect(result.isOwner).toBe(true);
    });

    it('should grant full access to collaborator with role owner', async () => {
        const mockBoard = {
            id: 'collab-case',
            title: 'Collab Case',
            userId: 'creator-id',
            isPublic: false,
            deletedAt: null,
            collaborators: [
                { userId: 'co-owner-id', role: 'owner' },
            ],
        };
        (db.query.boards.findFirst as any).mockResolvedValue(mockBoard);

        const result = await getBoardAccess('collab-case', 'co-owner-id');
        expect(result.canView).toBe(true);
        expect(result.canEdit).toBe(true);
        expect(result.isOwner).toBe(true);
    });

    it('should grant edit access without ownership to collaborator with role editor', async () => {
        const mockBoard = {
            id: 'collab-case',
            title: 'Collab Case',
            userId: 'creator-id',
            isPublic: false,
            deletedAt: null,
            collaborators: [
                { userId: 'editor-id', role: 'editor' },
            ],
        };
        (db.query.boards.findFirst as any).mockResolvedValue(mockBoard);

        const result = await getBoardAccess('collab-case', 'editor-id');
        expect(result.canView).toBe(true);
        expect(result.canEdit).toBe(true);
        expect(result.isOwner).toBe(false);
    });

    it('should grant view-only access to collaborator with role viewer', async () => {
        const mockBoard = {
            id: 'collab-case',
            title: 'Collab Case',
            userId: 'creator-id',
            isPublic: false,
            deletedAt: null,
            collaborators: [
                { userId: 'viewer-id', role: 'viewer' },
            ],
        };
        (db.query.boards.findFirst as any).mockResolvedValue(mockBoard);

        const result = await getBoardAccess('collab-case', 'viewer-id');
        expect(result.canView).toBe(true);
        expect(result.canEdit).toBe(false);
        expect(result.isOwner).toBe(false);
    });

    it('should deny all access to non-collaborator on private board', async () => {
        const mockBoard = {
            id: 'private-case',
            title: 'Secret Case',
            userId: 'creator-id',
            isPublic: false,
            deletedAt: null,
            collaborators: [
                { userId: 'trusted-id', role: 'editor' },
            ],
        };
        (db.query.boards.findFirst as any).mockResolvedValue(mockBoard);

        const result = await getBoardAccess('private-case', 'untrusted-id');
        expect(result.canView).toBe(false);
        expect(result.canEdit).toBe(false);
        expect(result.isOwner).toBe(false);
    });
});
