import { test, expect } from '@playwright/test';
import {
    DETECTIVE_ALPHA,
    seedTestUsers,
    cleanupTestData,
    closeDbClient,
    getTursoClient,
    createTestBoard,
    createApiClient,
} from '../helpers';

test.describe('Tier 2: Input Boundary Values & Authentication Edge Cases', () => {
    const api = createApiClient();

    test.beforeAll(async () => {
        await seedTestUsers();
    });

    test.afterAll(async () => {
        await cleanupTestData();
        await closeDbClient();
    });

    test('T2-BOUND-01: Empty & Whitespace-Only Board Titles', async () => {
        const whitespaceTitles = ['', '   ', '\t\n\r'];

        for (const title of whitespaceTitles) {
            const res = await api.post<{ id?: string; title?: string }>('/api/boards', {
                title,
                isPublic: false,
            }, { user: DETECTIVE_ALPHA });

            // Either rejected with 400 or safely normalized to default fallback ('Untitled Case')
            if (res.status === 201) {
                expect(res.data.id).toBeDefined();

                // Verify in Turso DB that title was not stored as raw empty whitespace
                const db = getTursoClient();
                const dbRes = await db.execute({
                    sql: 'SELECT title FROM boards WHERE id = ? LIMIT 1',
                    args: [res.data.id!],
                });
                expect(dbRes.rows.length).toBe(1);
                const storedTitle = String(dbRes.rows[0].title).trim();
                expect(storedTitle.length).toBeGreaterThan(0);
            } else {
                expect(res.status).toBe(400);
            }
        }
    });

    test('T2-BOUND-02: Empty & Whitespace Comments Rejection', async () => {
        const boardId = await createTestBoard({
            userId: DETECTIVE_ALPHA.id,
            title: `[E2E-TEST] Comment Boundary ${Date.now()}`,
            isPublic: true,
        });

        const invalidContents = ['', '    ', '\n\t  \n'];

        for (const content of invalidContents) {
            const res = await api.post<{ error?: string }>('/api/comments', {
                boardId,
                content,
            }, { user: DETECTIVE_ALPHA });

            expect(res.status, 'Empty or whitespace-only comment must be rejected with 400 Bad Request').toBe(400);
            expect(res.data.error).toBeDefined();
        }
    });

    test('T2-BOUND-03: Malformed Registration Fields Validation', async () => {
        // Missing name
        const missingNameRes = await api.post<{ error?: string }>('/api/auth/signup', {
            email: `valid_${Date.now()}@test-ephemeral.com`,
            password: 'StrongPassword123!',
        }, { user: null });
        expect(missingNameRes.status).toBe(400);

        // Malformed email format
        const invalidEmailRes = await api.post<{ error?: string }>('/api/auth/signup', {
            name: 'Detective Novice',
            email: 'not-a-valid-email-address',
            password: 'StrongPassword123!',
        }, { user: null });
        expect(invalidEmailRes.status).toBe(400);

        // Weak/Short password (<8 chars)
        const shortPasswordRes = await api.post<{ error?: string }>('/api/auth/signup', {
            name: 'Detective Novice',
            email: `novice_${Date.now()}@test-ephemeral.com`,
            password: 'Sh1!',
        }, { user: null });
        expect(shortPasswordRes.status).toBe(400);

        // Password missing required variety (no digits or uppercase)
        const weakPasswordRes = await api.post<{ error?: string }>('/api/auth/signup', {
            name: 'Detective Novice',
            email: `novice2_${Date.now()}@test-ephemeral.com`,
            password: 'alllowercasepassword',
        }, { user: null });
        expect(weakPasswordRes.status).toBe(400);
    });

    test('T2-BOUND-04: Boundary Limits on Payloads (Comments & Profile Bio)', async () => {
        const boardId = await createTestBoard({
            userId: DETECTIVE_ALPHA.id,
            title: `[E2E-TEST] Payload Boundary ${Date.now()}`,
            isPublic: true,
        });

        // 1. Comment exceeding 5,000 characters limit
        const excessiveComment = 'C'.repeat(5001);
        const commentRes = await api.post<{ error?: string }>('/api/comments', {
            boardId,
            content: excessiveComment,
        }, { user: DETECTIVE_ALPHA });

        expect(commentRes.status).toBe(400);

        // 2. Profile Bio exceeding 500 characters limit
        const excessiveBio = 'B'.repeat(501);
        const profileRes = await api.put<{ error?: string }>(`/api/profile/${DETECTIVE_ALPHA.id}`, {
            bio: excessiveBio,
        }, { user: DETECTIVE_ALPHA });

        expect(profileRes.status).toBe(400);
    });

    test('T2-AUTH-01: Forged or Tampered Session JWT Rejection', async () => {
        // Tampered session cookie with altered signature
        const tamperedCookie = 'eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..fake_iv.fake_payload.fake_tag';

        const res = await api.get('/api/me', {
            user: null,
            headers: {
                Cookie: `authjs.session-token=${tamperedCookie}`,
            },
        });

        // Must reject forged session with 401 Unauthorized
        expect(res.status).toBe(401);
    });

    test('T2-AUTH-02: Expired or Invalid Password Reset Token', async () => {
        const res = await api.post<{ error?: string }>('/api/auth/reset-password', {
            token: 'nonexistent-or-expired-token-val-99999',
            password: 'NewStrongPassword123!',
        }, { user: null });

        expect(res.status).toBe(400);
        expect(res.data.error).toBeDefined();
    });
});
