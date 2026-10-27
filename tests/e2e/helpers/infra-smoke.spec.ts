import { test, expect } from '@playwright/test';
import { decode } from '@auth/core/jwt';
import {
    DETECTIVE_ALPHA,
    DETECTIVE_BETA,
    DETECTIVE_GAMMA,
    createSessionToken,
    createSessionCookie,
    getAuthHeaders,
    getAuthSecret,
} from './auth';
import {
    getTursoClient,
    seedTestUsers,
    cleanupTestData,
    createTestBoard,
    getTestBoard,
    getUserReputation,
    closeDbClient,
} from './db';
import { createApiClient, SecurityAssertions } from './api-client';

test.describe('E2E Infrastructure & Helpers Validation', () => {
    test.beforeAll(async () => {
        await seedTestUsers();
    });

    test.afterAll(async () => {
        await cleanupTestData();
        await closeDbClient();
    });

    test('generates a valid JWE session token decryptable by NextAuth secret and salt', async () => {
        const token = await createSessionToken(DETECTIVE_ALPHA);
        expect(token).toBeDefined();
        expect(typeof token).toBe('string');
        expect(token.length).toBeGreaterThan(100);

        const secret = getAuthSecret();
        const decoded = await decode({
            token,
            secret,
            salt: 'authjs.session-token',
        });

        expect(decoded).toBeDefined();
        expect(decoded?.sub).toBe(DETECTIVE_ALPHA.id);
        expect(decoded?.email).toBe(DETECTIVE_ALPHA.email);
        expect(decoded?.name).toBe(DETECTIVE_ALPHA.name);
    });

    test('creates formatted cookie with correct attributes for Playwright', async () => {
        const cookie = await createSessionCookie(DETECTIVE_BETA);
        expect(cookie.name).toBe('authjs.session-token');
        expect(cookie.value).toBeDefined();
        expect(cookie.domain).toBe('localhost');
        expect(cookie.path).toBe('/');
        expect(cookie.httpOnly).toBe(true);
        expect(cookie.sameSite).toBe('Lax');
        expect(cookie.secure).toBe(false);
    });

    test('generates HTTP auth headers containing session cookie', async () => {
        const headers = await getAuthHeaders(DETECTIVE_GAMMA);
        expect(headers.Cookie).toBeDefined();
        expect(headers.Cookie).toContain('authjs.session-token=');
    });

    test('connects to remote Turso DB and verifies seeded personas exist with verified email flag', async () => {
        const client = getTursoClient();
        const result = await client.execute({
            sql: `SELECT id, name, email, email_verified_flag FROM users 
                  WHERE id IN (?, ?, ?) 
                  ORDER BY id`,
            args: [DETECTIVE_ALPHA.id, DETECTIVE_BETA.id, DETECTIVE_GAMMA.id],
        });

        expect(result.rows.length).toBe(3);

        const emails = result.rows.map((r) => r.email);
        expect(emails).toContain(DETECTIVE_ALPHA.email);
        expect(emails).toContain(DETECTIVE_BETA.email);
        expect(emails).toContain(DETECTIVE_GAMMA.email);

        for (const row of result.rows) {
            expect(row.email_verified_flag).toBe(1);
        }
    });

    test('initializes user_reputation entries for all seeded personas', async () => {
        const repAlpha = await getUserReputation(DETECTIVE_ALPHA.id);
        expect(repAlpha).not.toBeNull();
        expect(typeof repAlpha?.points).toBe('number');
        expect(typeof repAlpha?.boardsCreated).toBe('number');
    });

    test('creates a test board directly in Turso DB and retrieves it', async () => {
        const testTitle = `[E2E-TEST] Smoke Verification ${Date.now()}`;
        const boardId = await createTestBoard({
            userId: DETECTIVE_ALPHA.id,
            title: testTitle,
            isPublic: true,
            content: {
                nodes: [{ id: 'smoke-node-1', type: 'sticky', data: { label: 'Smoke Test Clue' } }],
                edges: [],
            },
        });

        expect(boardId).toMatch(/^e2e_board_/);

        const board = await getTestBoard(boardId);
        expect(board).not.toBeNull();
        expect(board?.title).toBe(testTitle);
        expect(board?.is_public).toBe(1);
        const nodes = board?.content?.nodes as Array<{ data?: { label?: string } }> | undefined;
        expect(nodes?.length).toBe(1);
        expect(nodes?.[0]?.data?.label).toBe('Smoke Test Clue');
    });

    test('API client initializes without test bypass headers', () => {
        const client = createApiClient();
        expect(client).toBeDefined();
    });

    test('Security assertions detect sensitive token leakage', () => {
        expect(() => {
            SecurityAssertions.assertNoTokens({ verificationToken: 'secret-tok-123' });
        }).toThrow(/Security Violation/);

        expect(() => {
            SecurityAssertions.assertNoTokens({ resetToken: 'reset-tok-456' });
        }).toThrow(/Security Violation/);

        expect(() => {
            SecurityAssertions.assertNoTokens({ success: true, userId: 'u123' });
        }).not.toThrow();
    });

    test('Security assertions detect password hash leakage', () => {
        expect(() => {
            SecurityAssertions.assertNoPasswordHash({ passwordHash: '$2a$12$hashedstring' });
        }).toThrow(/Security Violation/);

        expect(() => {
            SecurityAssertions.assertNoPasswordHash({ id: 'u1', name: 'John Doe' });
        }).not.toThrow();
    });
});
