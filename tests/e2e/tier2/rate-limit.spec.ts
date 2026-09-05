import { test, expect } from '@playwright/test';
import {
    DETECTIVE_ALPHA,
    seedTestUsers,
    cleanupTestData,
    closeDbClient,
    createApiClient,
} from '../helpers';
import { checkRateLimit } from '@/lib/rate-limit';

test.describe('Tier 2: Rate Limiting & Concurrency Race Protection', () => {
    const api = createApiClient();

    test.beforeAll(async () => {
        await seedTestUsers();
    });

    test.afterAll(async () => {
        await cleanupTestData();
        await closeDbClient();
    });

    test('T2-RATE-01: Signup Flood Exceeding 5 Requests / Hour', async () => {
        // Use an isolated mock client IP for rate limit tracking
        const clientIp = `198.51.100.${Math.floor(Math.random() * 200) + 10}`;

        const responses: number[] = [];

        // Send 6 rapid signup attempts from the same IP
        for (let i = 1; i <= 6; i++) {
            const res = await api.post(
                '/api/auth/signup',
                {
                    name: `Cadet ${i}`,
                    email: `flood_${Date.now()}_${i}@test-ephemeral.com`,
                    password: 'SecurePassword123!',
                },
                {
                    user: null,
                    headers: { 'x-forwarded-for': clientIp },
                }
            );
            responses.push(res.status);
        }

        // The first 5 requests should be accepted/processed (201 or 400/409)
        for (let i = 0; i < 5; i++) {
            expect(responses[i], `Request #${i + 1} should not be rate-limited`).not.toBe(429);
        }

        // The 6th request from the same IP MUST receive 429 Too Many Requests
        expect(responses[5], 'Request #6 exceeding threshold must be rejected with 429').toBe(429);
    });

    test('T2-RATE-02: Forgot Password Flood Exceeding 3 Requests / Hour', async () => {
        const clientIp = `198.51.101.${Math.floor(Math.random() * 200) + 10}`;

        const responses: number[] = [];

        // Send 4 rapid forgot-password attempts from the same IP
        for (let i = 1; i <= 4; i++) {
            const res = await api.post(
                '/api/auth/forgot-password',
                { email: DETECTIVE_ALPHA.email },
                {
                    user: null,
                    headers: { 'x-forwarded-for': clientIp },
                }
            );
            responses.push(res.status);
        }

        // The first 3 requests are processed
        expect(responses[0]).toBe(200);
        expect(responses[1]).toBe(200);
        expect(responses[2]).toBe(200);

        // The 4th request MUST receive 429 Too Many Requests
        expect(responses[3], 'Request #4 exceeding 3 attempts/hr must be 429').toBe(429);
    });

    test('T2-RACE-01: Atomic Rate Limiting Under Concurrency (Zero Race Conditions)', async () => {
        const concurrencyKey = `concurrency_race_test_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const limit = 5;
        const totalRequests = 20;

        // Launch 20 simultaneous rate-limit checks against the same key in parallel
        const promises = Array.from({ length: totalRequests }, () =>
            checkRateLimit(concurrencyKey, limit, 60000)
        );

        const results = await Promise.all(promises);

        const successCount = results.filter((r) => r.success).length;
        const rateLimitedCount = results.filter((r) => !r.success).length;

        // Exactly `limit` (5) requests must succeed, and 15 must be rate-limited
        expect(successCount, 'Atomic limiter must allow exactly 5 concurrent requests').toBe(limit);
        expect(rateLimitedCount, 'Remaining 15 requests must be rate-limited').toBe(totalRequests - limit);
    });
});
