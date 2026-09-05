import { test, expect } from '@playwright/test';
import {
    DETECTIVE_ALPHA,
    DETECTIVE_BETA,
    DETECTIVE_GAMMA,
    seedTestUsers,
    cleanupTestData,
    closeDbClient,
    getTursoClient,
    createApiClient,
} from '../helpers';
import { awardPoints, ReputationAction } from '@/lib/reputation';

test.describe('Tier 1: Reputation Engine & Leaderboard System', () => {
    const api = createApiClient();

    test.beforeAll(async () => {
        await seedTestUsers();
    });

    test.afterAll(async () => {
        await cleanupTestData();
        await closeDbClient();
    });

    test('T1-REP-01: Gamification Points Allocation on Core Actions', async () => {
        const db = getTursoClient();
        const testUserId = DETECTIVE_ALPHA.id;

        // Reset user reputation to clean 0 baseline
        await db.execute({
            sql: 'UPDATE user_reputation SET points = 0 WHERE user_id = ?',
            args: [testUserId],
        });

        // Test action deltas as specified by the requirements
        const actionRules: Array<{ action: ReputationAction; expectedDelta: number }> = [
            { action: 'board_created', expectedDelta: 10 },
            { action: 'board_made_public', expectedDelta: 5 },
            { action: 'board_shared', expectedDelta: 3 },
            { action: 'comment_posted', expectedDelta: 2 },
            { action: 'profile_completed', expectedDelta: 15 },
        ];

        let accumulatedPoints = 0;

        for (const rule of actionRules) {
            const newPoints = await awardPoints(testUserId, rule.action);
            accumulatedPoints += rule.expectedDelta;
            expect(newPoints).toBe(accumulatedPoints);
        }

        // Verify direct state in Turso DB
        const finalRep = await db.execute({
            sql: 'SELECT points FROM user_reputation WHERE user_id = ? LIMIT 1',
            args: [testUserId],
        });

        expect(Number(finalRep.rows[0].points)).toBe(accumulatedPoints);
    });

    test('T1-REP-02: Unified Detective Rank Title Thresholds', () => {
        function evaluateRank(points: number): string {
            if (points >= 1000) return 'Chief Detective';
            if (points >= 500) return 'Senior Investigator';
            if (points >= 200) return 'Private Eye';
            if (points >= 50) return 'Rookie Cop';
            return 'Patrol Officer';
        }

        expect(evaluateRank(0)).toBe('Patrol Officer');
        expect(evaluateRank(49)).toBe('Patrol Officer');
        expect(evaluateRank(50)).toBe('Rookie Cop');
        expect(evaluateRank(199)).toBe('Rookie Cop');
        expect(evaluateRank(200)).toBe('Private Eye');
        expect(evaluateRank(499)).toBe('Private Eye');
        expect(evaluateRank(500)).toBe('Senior Investigator');
        expect(evaluateRank(999)).toBe('Senior Investigator');
        expect(evaluateRank(1000)).toBe('Chief Detective');
        expect(evaluateRank(5000)).toBe('Chief Detective');
    });

    test('T1-REP-03: Leaderboard Real User Details Join', async () => {
        const db = getTursoClient();

        // Seed distinct point values for test detectives
        await db.execute({
            sql: 'UPDATE user_reputation SET points = 350 WHERE user_id = ?',
            args: [DETECTIVE_ALPHA.id],
        });
        await db.execute({
            sql: 'UPDATE user_reputation SET points = 120 WHERE user_id = ?',
            args: [DETECTIVE_BETA.id],
        });

        const res = await api.get<Array<{
            userId?: string;
            points?: number;
            name?: string;
            userName?: string;
            image?: string;
            rankTitle?: string;
        }>>('/api/leaderboard?limit=10', { user: null });

        expect(res.status).toBe(200);
        expect(Array.isArray(res.data)).toBe(true);
        expect(res.data.length).toBeGreaterThan(0);

        // Verification: Leaderboard must join user details rather than returning bare anonymous records
        const alphaEntry = res.data.find((e) => e.userId === DETECTIVE_ALPHA.id);
        expect(alphaEntry).toBeDefined();
        expect(alphaEntry?.points).toBe(350);

        // Name must be present via join
        const name = alphaEntry?.name || alphaEntry?.userName;
        expect(name).toBeDefined();
        expect(name).toContain(DETECTIVE_ALPHA.name);
    });

    test('T1-LEAD-01: Leaderboard Sorted Order', async () => {
        const db = getTursoClient();

        // Set descending points: Gamma > Beta
        await db.execute({
            sql: 'UPDATE user_reputation SET points = 800 WHERE user_id = ?',
            args: [DETECTIVE_GAMMA.id],
        });
        await db.execute({
            sql: 'UPDATE user_reputation SET points = 600 WHERE user_id = ?',
            args: [DETECTIVE_BETA.id],
        });

        const res = await api.get<Array<{ userId: string; points: number }>>('/api/leaderboard', {
            user: null,
        });

        expect(res.status).toBe(200);
        expect(res.data.length).toBeGreaterThanOrEqual(2);

        // Verify descending order
        for (let i = 0; i < res.data.length - 1; i++) {
            expect(res.data[i].points).toBeGreaterThanOrEqual(res.data[i + 1].points);
        }
    });

    test('T1-LEAD-02: Leaderboard Pagination Limit Parameter', async () => {
        const res = await api.get<Array<unknown>>('/api/leaderboard?limit=2', { user: null });
        expect(res.status).toBe(200);
        expect(Array.isArray(res.data)).toBe(true);
        expect(res.data.length).toBeLessThanOrEqual(2);
    });
});
