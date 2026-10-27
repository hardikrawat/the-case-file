import { db } from '@/lib/db';
import { boards, users } from '@/lib/schema';
import { like, or, eq, isNull, and } from 'drizzle-orm';

export interface SearchResult {
    boards: Array<{
        id: string;
        title: string;
        userId: string;
        userName: string | null;
        isPublic: boolean;
        thumbnail: string | null;
        createdAt: Date | null;
    }>;
    users: Array<{
        id: string;
        name: string | null;
        avatarUrl: string | null;
    }>;
    totalResults: number;
}

/**
 * Search across boards and users
 */
export async function searchDatabase(query: string, userId?: string): Promise<SearchResult> {
    const searchTerm = `%${query}%`;

    // Search boards (title and content)
    const boardResults = await db
        .select({
            id: boards.id,
            title: boards.title,
            userId: boards.userId,
            userName: users.name,
            isPublic: boards.isPublic,
            thumbnail: boards.thumbnail,
            createdAt: boards.createdAt,
        })
        .from(boards)
        .leftJoin(users, eq(boards.userId, users.id))
        .where(
            and(
                like(boards.title, searchTerm),
                userId
                    ? or(eq(boards.isPublic, true), eq(boards.userId, userId))
                    : eq(boards.isPublic, true),
                isNull(boards.deletedAt) // Exclude soft-deleted boards
            )
        )
        .limit(20);

    const formattedBoards = boardResults.map(board => ({
        ...board,
        isPublic: !!board.isPublic
    }));

    // Filter to only include public boards or user's own boards
    const filteredBoards = formattedBoards.filter(
        board => board.isPublic || board.userId === userId
    );

    // Search users (names only - email omitted for privacy)
    const userResults = await db
        .select({
            id: users.id,
            name: users.name,
            avatarUrl: users.avatarUrl,
        })
        .from(users)
        .where(like(users.name, searchTerm))
        .limit(10);

    return {
        boards: filteredBoards,
        users: userResults,
        totalResults: filteredBoards.length + userResults.length,
    };
}
