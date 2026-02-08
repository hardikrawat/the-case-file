export interface Board {
    id: string;
    title: string;
    userId: string;
    parentId: string | null;
    isPublic: boolean | null;
    content: BoardContent;
    thumbnail: string | null;
    stars: number | null;
    views: number | null;
    createdAt: Date | string | null;
    updatedAt: Date | string | null;
    author?: {
        name: string | null;
        image: string | null;
    };
}

export interface BoardContent {
    nodes: Record<string, unknown>[];
    edges: Record<string, unknown>[];
    [key: string]: unknown;
}

export interface Contribution {
    id: string;
    boardId: string;
    userId: string;
    snapshot: BoardContent;
    message: string | null;
    status: 'open' | 'merged' | 'rejected' | null;
    createdAt: Date | string | null;
}
