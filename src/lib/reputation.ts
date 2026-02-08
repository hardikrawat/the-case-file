import { db } from '@/lib/db';
import { userReputation, boards } from '@/lib/schema';
import { eq, sql } from 'drizzle-orm';

export type ReputationAction =
    | 'board_created'
    | 'board_made_public'
    | 'board_shared'
    | 'comment_posted'
    | 'profile_completed';

const POINTS: Record<ReputationAction, number> = {
    board_created: 10,
    board_made_public: 5,
    board_shared: 3,
    comment_posted: 2,
    profile_completed: 15,
};

/**
 * Award points to a user for an action
 */
export async function awardPoints(userId: string, action: ReputationAction): Promise<number> {
    const points = POINTS[action];

    try {
        // Check if user has reputation record
        const existing = await db.select()
            .from(userReputation)
            .where(eq(userReputation.userId, userId))
            .limit(1);

        if (existing.length > 0) {
            // Update existing record
            const updated = await db.update(userReputation)
                .set({
                    points: sql`${userReputation.points} + ${points}`,
                    lastUpdated: new Date(),
                })
                .where(eq(userReputation.userId, userId))
                .returning();

            return updated[0].points || 0;
        } else {
            // Count user's boards for initial record
            const userBoards = await db.select()
                .from(boards)
                .where(eq(boards.userId, userId));

            // Create new reputation record
            const created = await db.insert(userReputation).values({
                userId,
                points,
                boardsCreated: userBoards.length,
                lastUpdated: new Date(),
            }).returning();

            return created[0].points || 0;
        }
    } catch (error) {
        console.error('Award points error:', error);
        return 0;
    }
}

/**
 * Update board count for a user
 */
export async function updateBoardCount(userId: string): Promise<void> {
    try {
        const userBoards = await db.select()
            .from(boards)
            .where(eq(boards.userId, userId));

        const existing = await db.select()
            .from(userReputation)
            .where(eq(userReputation.userId, userId))
            .limit(1);

        if (existing.length > 0) {
            await db.update(userReputation)
                .set({
                    boardsCreated: userBoards.length,
                    lastUpdated: new Date(),
                })
                .where(eq(userReputation.userId, userId));
        } else {
            await db.insert(userReputation).values({
                userId,
                points: 0,
                boardsCreated: userBoards.length,
                lastUpdated: new Date(),
            });
        }
    } catch (error) {
        console.error('Update board count error:', error);
    }
}

/**
 * Get user's current points
 */
export async function getUserPoints(userId: string): Promise<number> {
    try {
        const result = await db.select()
            .from(userReputation)
            .where(eq(userReputation.userId, userId))
            .limit(1);

        return result.length > 0 ? (result[0].points || 0) : 0;
    } catch (error) {
        console.error('Get user points error:', error);
        return 0;
    }
}

/**
 * Get user's rank
 */
export async function getUserRank(userId: string): Promise<number> {
    try {
        const allUsers = await db.select()
            .from(userReputation)
            .orderBy(sql`${userReputation.points} DESC`);

        const rank = allUsers.findIndex(u => u.userId === userId);
        return rank >= 0 ? rank + 1 : 0;
    } catch (error) {
        console.error('Get user rank error:', error);
        return 0;
    }
}
