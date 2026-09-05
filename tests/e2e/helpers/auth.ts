import { encode } from '@auth/core/jwt';
import type { BrowserContext, Page } from '@playwright/test';

export interface TestUserPersona {
    id: string;
    email: string;
    name: string;
    password: string;
    roleTitle?: string;
}

/**
 * Standard persistent detective personas for E2E testing.
 * These users are seeded into Turso DB and used across all test tiers.
 */
export const DETECTIVE_ALPHA: TestUserPersona = {
    id: 'e2e-user-alpha',
    email: 'alpha@testcasefile.dev',
    name: 'Detective Alpha',
    password: 'DetectivePass123!',
    roleTitle: 'Chief Detective',
};

export const DETECTIVE_BETA: TestUserPersona = {
    id: 'e2e-user-beta',
    email: 'beta@testcasefile.dev',
    name: 'Detective Beta',
    password: 'DetectivePass123!',
    roleTitle: 'Senior Investigator',
};

export const DETECTIVE_GAMMA: TestUserPersona = {
    id: 'e2e-user-gamma',
    email: 'gamma@testcasefile.dev',
    name: 'Detective Gamma',
    password: 'DetectivePass123!',
    roleTitle: 'Patrol Officer',
};

export const TEST_PERSONAS = [DETECTIVE_ALPHA, DETECTIVE_BETA, DETECTIVE_GAMMA];

/**
 * Get NextAuth secret key from environment
 */
export function getAuthSecret(): string {
    return process.env.AUTH_SECRET || 'the-case-file-super-secret-key-development-2026';
}

/**
 * Cryptographically generates an authentic NextAuth v5 JWE session token
 * identical to tokens issued by NextAuth's credentials provider.
 */
export async function createSessionToken(
    user: TestUserPersona,
    maxAgeSeconds: number = 30 * 24 * 60 * 60
): Promise<string> {
    const secret = getAuthSecret();
    const salt = 'authjs.session-token';

    const token = await encode({
        token: {
            id: user.id,
            sub: user.id,
            email: user.email,
            name: user.name,
        },
        secret,
        salt,
        maxAge: maxAgeSeconds,
    });

    return token;
}

/**
 * Generates an authentic session cookie object for Playwright browser context.
 */
export async function createSessionCookie(
    user: TestUserPersona,
    domain: string = 'localhost'
) {
    const token = await createSessionToken(user);

    return {
        name: 'authjs.session-token',
        value: token,
        domain,
        path: '/',
        httpOnly: true,
        sameSite: 'Lax' as const,
        secure: false,
    };
}

/**
 * Injects a genuine NextAuth v5 session cookie into a Playwright BrowserContext,
 * enabling authenticated browsing without relying on test bypasses or UI login forms.
 */
export async function authenticateContext(
    context: BrowserContext,
    user: TestUserPersona = DETECTIVE_ALPHA,
    domain: string = 'localhost'
): Promise<void> {
    const cookie = await createSessionCookie(user, domain);
    await context.addCookies([cookie]);
}

/**
 * Returns authentic Cookie headers containing the JWE session token
 * for direct API requests via node-fetch or Playwright request context.
 */
export async function getAuthHeaders(
    user: TestUserPersona = DETECTIVE_ALPHA
): Promise<Record<string, string>> {
    const token = await createSessionToken(user);
    return {
        Cookie: `authjs.session-token=${token}`,
    };
}

/**
 * Performs a genuine UI login flow via browser form submission.
 * Used for testing authentication flows, validation, and session establishment.
 */
export async function loginViaUI(
    page: Page,
    email: string,
    password: string,
    expectedUrlPattern: RegExp = /\/cases|\/board/
): Promise<void> {
    await page.goto('/login');
    await page.waitForSelector('input[type="email"]', { state: 'visible' });

    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');

    await page.waitForURL(expectedUrlPattern, { timeout: 15000 });
}
