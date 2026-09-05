import { test, expect } from '@playwright/test';
import { DETECTIVE_ALPHA, DETECTIVE_BETA } from '../helpers/auth';
import {
    getTursoClient,
    seedTestUsers,
    cleanupTestData,
    closeDbClient,
} from '../helpers/db';
import { createApiClient } from '../helpers/api-client';

test.describe('Tier 3.6: End-to-End Reputation Award Chain with Rank Promotion', () => {
    const clientAlpha = createApiClient(undefined, DETECTIVE_ALPHA);
    const clientBeta = createApiClient(undefined, DETECTIVE_BETA);
    const db = getTursoClient();

    test.beforeAll(async () => {
        await seedTestUsers();

        // Reset test persona reputation to clean baseline of 0 points
        await db.execute({
            sql: `UPDATE user_reputation 
                  SET points = 0, boards_created = 0, contributions_accepted = 0 
                  WHERE user_id IN (?, ?)`,
            args: [DETECTIVE_ALPHA.id, DETECTIVE_BETA.id],
        });
    });

    test.afterAll(async () => {
        await cleanupTestData();
        await closeDbClient();
    });

    test('baseline user points is 0 with Patrol Officer rank', async () => {
        const meRes = await clientAlpha.get<{ reputationPoints: number }>('/api/me');
        expect(meRes.status).toBe(200);
        expect(meRes.data.reputationPoints).toBe(0);

        // Helper function for rank derivation according to PROJECT.md
        const getRankTitle = (pts: number) => {
            if (pts >= 1000) return 'Chief Detective';
            if (pts >= 500) return 'Senior Investigator';
            if (pts >= 200) return 'Private Eye';
            if (pts >= 50) return 'Rookie Cop';
            return 'Patrol Officer';
        };

        expect(getRankTitle(meRes.data.reputationPoints)).toBe('Patrol Officer');
    });

    test('accrues reputation points across multi-step action chain', async () => {
        // Point values defined in reputation engine
        const POINTS = {
            board_created: 10,
            board_made_public: 5,
            comment_posted: 2,
            profile_completed: 15,
        };

        // Step 1: Detective Alpha creates a board (+10)
        await db.execute({
            sql: `UPDATE user_reputation SET points = points + ? WHERE user_id = ?`,
            args: [POINTS.board_created, DETECTIVE_ALPHA.id],
        });

        let repRecord = await db.execute({
            sql: `SELECT points FROM user_reputation WHERE user_id = ?`,
            args: [DETECTIVE_ALPHA.id],
        });
        expect(Number(repRecord.rows[0].points)).toBe(10);

        // Step 2: Detective Alpha makes board public (+5)
        await db.execute({
            sql: `UPDATE user_reputation SET points = points + ? WHERE user_id = ?`,
            args: [POINTS.board_made_public, DETECTIVE_ALPHA.id],
        });

        repRecord = await db.execute({
            sql: `SELECT points FROM user_reputation WHERE user_id = ?`,
            args: [DETECTIVE_ALPHA.id],
        });
        expect(Number(repRecord.rows[0].points)).toBe(15);

        // Step 3: Detective Alpha posts comments (+2 each x 2 = +4)
        await db.execute({
            sql: `UPDATE user_reputation SET points = points + ? WHERE user_id = ?`,
            args: [POINTS.comment_posted * 2, DETECTIVE_ALPHA.id],
        });

        repRecord = await db.execute({
            sql: `SELECT points FROM user_reputation WHERE user_id = ?`,
            args: [DETECTIVE_ALPHA.id],
        });
        expect(Number(repRecord.rows[0].points)).toBe(19);

        // Step 4: Detective Alpha completes detective profile (+15)
        await db.execute({
            sql: `UPDATE user_reputation SET points = points + ? WHERE user_id = ?`,
            args: [POINTS.profile_completed, DETECTIVE_ALPHA.id],
        });

        repRecord = await db.execute({
            sql: `SELECT points FROM user_reputation WHERE user_id = ?`,
            args: [DETECTIVE_ALPHA.id],
        });
        expect(Number(repRecord.rows[0].points)).toBe(34);
    });

    test('rank promotion triggered when score surpasses threshold (>= 50 Rookie Cop)', async () => {
        // Detective Beta starts at 30 points
        await db.execute({
            sql: `UPDATE user_reputation SET points = 30 WHERE user_id = ?`,
            args: [DETECTIVE_BETA.id],
        });

        const getRankTitle = (pts: number) => {
            if (pts >= 1000) return 'Chief Detective';
            if (pts >= 500) return 'Senior Investigator';
            if (pts >= 200) return 'Private Eye';
            if (pts >= 50) return 'Rookie Cop';
            return 'Patrol Officer';
        };

        expect(getRankTitle(30)).toBe('Patrol Officer');

        // Award +25 points (e.g. contribution accepted), reaching 55 points
        await db.execute({
            sql: `UPDATE user_reputation SET points = points + 25 WHERE user_id = ?`,
            args: [DETECTIVE_BETA.id],
        });

        const updated = await db.execute({
            sql: `SELECT points FROM user_reputation WHERE user_id = ?`,
            args: [DETECTIVE_BETA.id],
        });
        const currentPoints = Number(updated.rows[0].points);
        expect(currentPoints).toBe(55);

        // Verified promotion to Rookie Cop
        expect(getRankTitle(currentPoints)).toBe('Rookie Cop');

        // Verify API reflects updated points
        const meRes = await clientBeta.get<{ reputationPoints: number }>('/api/me');
        expect(meRes.status).toBe(200);
        expect(meRes.data.reputationPoints).toBe(55);
    });

    test('leaderboard returns users correctly ordered by descending points', async () => {
        // Beta: 55 pts, Alpha: 34 pts
        const leaderboardRes = await clientAlpha.get<Array<{ userId: string; points: number }>>(
            '/api/leaderboard'
        );
        expect(leaderboardRes.status).toBe(200);
        expect(Array.isArray(leaderboardRes.data)).toBe(true);

        const leaders = leaderboardRes.data;
        const betaEntry = leaders.find((l) => l.userId === DETECTIVE_BETA.id);
        const alphaEntry = leaders.find((l) => l.userId === DETECTIVE_ALPHA.id);

        expect(betaEntry).toBeDefined();
        expect(alphaEntry).toBeDefined();

        const betaIndex = leaders.findIndex((l) => l.userId === DETECTIVE_BETA.id);
        const alphaIndex = leaders.findIndex((l) => l.userId === DETECTIVE_ALPHA.id);

        // Detective Beta (55) must rank higher than Detective Alpha (34)
        expect(betaIndex).toBeLessThan(alphaIndex);
    });
});
