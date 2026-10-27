import { db } from '@/lib/db';
import { boards } from '@/lib/schema';
import { eq, and, isNull } from 'drizzle-orm';

export interface BoardCollaboratorRecord {
    id: string;
    boardId: string;
    userId: string;
    role: 'owner' | 'editor' | 'viewer';
    addedAt: Date | string | number | null;
    deletedAt?: Date | string | number | null;
}

export interface BoardRecord {
    id: string;
    userId: string;
    title: string;
    parentId?: string | null;
    isPublic?: boolean | null;
    content?: Record<string, unknown> | null;
    thumbnail?: string | null;
    stars?: number | null;
    views?: number | null;
    version?: number;
    deletedAt?: Date | string | number | null;
    createdAt?: Date | string | number | null;
    updatedAt?: Date | string | number | null;
    collaborators?: BoardCollaboratorRecord[];
}

export interface BoardAccessResult {
    board: BoardRecord | null;
    canView: boolean;
    canEdit: boolean;
    isOwner: boolean;
}

/**
 * Validates board existence, soft-delete state, and user authorization per
 * PROJECT.md § Board Access Authorization Contract.
 */
export async function getBoardAccess(boardId: string, userId?: string): Promise<BoardAccessResult> {
    if (!boardId) {
        return { board: null, canView: false, canEdit: false, isOwner: false };
    }

    const board = await db.query.boards.findFirst({
        where: and(eq(boards.id, boardId), isNull(boards.deletedAt)),
        with: {
            collaborators: true,
        },
    });

    if (!board || board.deletedAt) {
        return { board: null, canView: false, canEdit: false, isOwner: false };
    }

    const isDirectOwner = !!(userId && board.userId === userId);
    const collaborator = userId
        ? board.collaborators?.find((c) => c.userId === userId && !c.deletedAt)
        : null;

    const role = collaborator?.role;
    const isCollaboratorOwner = role === 'owner';
    const isCollaboratorEditor = role === 'editor';
    const isCollaboratorViewer = role === 'viewer';

    const isOwner = isDirectOwner || isCollaboratorOwner;
    const canEdit = isOwner || isCollaboratorEditor;
    const canView = Boolean(board.isPublic || isOwner || isCollaboratorEditor || isCollaboratorViewer);

    return {
        board: board as unknown as BoardRecord,
        canView,
        canEdit,
        isOwner,
    };
}
