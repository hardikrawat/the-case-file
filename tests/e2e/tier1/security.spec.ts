import { test, expect } from '@playwright/test';
import {
    DETECTIVE_ALPHA,
    seedTestUsers,
    cleanupTestData,
    closeDbClient,
    getTursoClient,
    createApiClient,
    SecurityAssertions,
} from '../helpers';

test.describe('Tier 1: Security & Authentication Hardening', () => {
    const api = createApiClient();

    test.beforeAll(async () => {
        await seedTestUsers();
    });

    test.afterAll(async () => {
        await cleanupTestData();
        await closeDbClient();
    });

    test('T1-SEC-01: Signup Zero Token Leakage', async () => {
        const uniqueEmail = `detective_${Date.now()}@test-ephemeral.com`;
        const res = await api.post<{
            success?: boolean;
            userId?: string;
            verificationToken?: string;
            token?: string;
            passwordHash?: string;
            password?: string;
        }>('/api/auth/signup', {
            name: 'Forensic Cadet',
            email: uniqueEmail,
            password: 'CadetPassword123!',
        }, { user: null });

        expect(res.status).toBe(201);
        expect(res.data.success).toBe(true);
        expect(res.data.userId).toBeDefined();

        // Security Assertions: strictly zero token or password hash leakage
        SecurityAssertions.assertNoTokens(res.data);
        SecurityAssertions.assertNoPasswordHash(res.data);
        expect(res.data.verificationToken).toBeUndefined();
        expect(res.data.token).toBeUndefined();
        expect(res.data.passwordHash).toBeUndefined();
        expect(res.data.password).toBeUndefined();

        // Direct DB verification: user exists in Turso DB with unverified flag
        const db = getTursoClient();
        const userRow = await db.execute({
            sql: 'SELECT id, email, email_verified_flag FROM users WHERE email = ? LIMIT 1',
            args: [uniqueEmail],
        });
        expect(userRow.rows.length).toBe(1);
        expect(userRow.rows[0].email_verified_flag).toBe(0);
    });

    test('T1-SEC-02: Forgot Password Zero Token Leakage', async () => {
        const res = await api.post<{
            success?: boolean;
            message?: string;
            resetToken?: string;
            token?: string;
        }>('/api/auth/forgot-password', {
            email: DETECTIVE_ALPHA.email,
        }, { user: null });

        expect(res.status).toBe(200);
        expect(res.data.success).toBe(true);

        // Security Assertions: reset token must never be returned in HTTP response body
        SecurityAssertions.assertNoTokens(res.data);
        expect(res.data.resetToken).toBeUndefined();
        expect(res.data.token).toBeUndefined();

        // Direct DB verification: reset token record exists in database
        const db = getTursoClient();
        const tokenRows = await db.execute({
            sql: `SELECT identifier, token, expires FROM passwordResetTokens 
                  WHERE identifier = ? 
                  ORDER BY expires DESC LIMIT 1`,
            args: [DETECTIVE_ALPHA.email],
        });
        expect(tokenRows.rows.length).toBeGreaterThan(0);
    });

    test('T1-SEC-03: User Profile Strips passwordHash in GET /api/me', async () => {
        const res = await api.get<{
            id?: string;
            email?: string;
            name?: string;
            passwordHash?: string;
            password_hash?: string;
            reputationPoints?: number;
        }>('/api/me', { user: DETECTIVE_ALPHA });

        expect(res.status).toBe(200);
        expect(res.data.id).toBe(DETECTIVE_ALPHA.id);
        expect(res.data.email).toBe(DETECTIVE_ALPHA.email);
        expect(res.data.name).toBe(DETECTIVE_ALPHA.name);

        // Security Assertions: passwordHash must be strictly stripped
        SecurityAssertions.assertNoPasswordHash(res.data);
        expect(res.data.passwordHash).toBeUndefined();
        expect(res.data.password_hash).toBeUndefined();
        expect(JSON.stringify(res.data)).not.toContain('passwordHash');
        expect(JSON.stringify(res.data)).not.toContain('password_hash');
    });

    test('T1-SEC-04: User Profile Strips passwordHash in PUT /api/profile/[id]', async () => {
        const updatedBio = `Senior Case Specialist — updated ${Date.now()}`;
        const res = await api.put<{
            id?: string;
            name?: string;
            bio?: string;
            passwordHash?: string;
            password_hash?: string;
        }>(`/api/profile/${DETECTIVE_ALPHA.id}`, {
            name: 'Detective Alpha Special Ops',
            bio: updatedBio,
        }, { user: DETECTIVE_ALPHA });

        expect(res.status).toBe(200);
        expect(res.data.name).toBe('Detective Alpha Special Ops');
        expect(res.data.bio).toBe(updatedBio);

        // Security Assertions: passwordHash must never be leaked during profile updates
        SecurityAssertions.assertNoPasswordHash(res.data);
        expect(res.data.passwordHash).toBeUndefined();
        expect(res.data.password_hash).toBeUndefined();
        expect(JSON.stringify(res.data)).not.toContain('passwordHash');
    });

    test('T1-SEC-05: Public Profile Privacy Protection (Email & Hash Hidden)', async () => {
        // Unauthenticated request to public profile endpoint
        const res = await api.get<{
            id?: string;
            name?: string;
            bio?: string;
            email?: string;
            passwordHash?: string;
        }>(`/api/profile/${DETECTIVE_ALPHA.id}`, { user: null });

        expect(res.status).toBe(200);
        expect(res.data.id).toBe(DETECTIVE_ALPHA.id);
        expect(res.data.name).toBeDefined();

        // Security Assertions: email and passwordHash must NOT be leaked publicly
        expect(res.data.email).toBeUndefined();
        SecurityAssertions.assertNoPasswordHash(res.data);
        expect(res.data.passwordHash).toBeUndefined();
    });

    test('T1-SEC-06: Elimination of All Test Bypasses (x-test-bypass Rejected)', async () => {
        // Direct request with x-test-bypass header and no session must return 401
        const res = await api.get('/api/me', {
            user: null,
            headers: { 'x-test-bypass': 'true' },
        });

        expect(res.status).toBe(401);

        const boardsRes = await api.get('/api/boards', {
            user: null,
            headers: { 'x-test-bypass': 'true' },
        });

        expect(boardsRes.status).toBe(401);
    });

    test('T1-SEC-07: Route Middleware Protection (Unauthenticated Redirect)', async ({ page }) => {
        // Unauthenticated access to protected cases route must redirect to login
        await page.goto('/cases');
        await page.waitForURL(/\/login/, { timeout: 15000 });
        expect(page.url()).toContain('/login');

        // Unauthenticated access to protected settings route
        await page.goto('/settings');
        await page.waitForURL(/\/login/, { timeout: 15000 });
        expect(page.url()).toContain('/login');
    });
});
