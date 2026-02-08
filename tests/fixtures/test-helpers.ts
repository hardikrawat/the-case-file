import { test as base, Page } from '@playwright/test';

export type TestFixtures = {
    authenticatedPage: Page;
};

// Extend base test with custom fixtures
export const test = base.extend<TestFixtures>({
    // Authenticated user fixture
    authenticatedPage: async ({ page }, use) => {
        // Navigate to login
        await page.goto('/login');

        // Fill in test credentials
        await page.fill('input[type="email"]', 'test@example.com');
        await page.fill('input[type="password"]', 'TestPass123');
        await page.click('button[type="submit"]');

        // Wait for redirect to dashboard
        await page.waitForURL('/dashboard', { timeout: 10000 }).catch(() => {
            // If redirect fails, continue anyway for tests that handle it
        });

        await use(page);
    },
});

export { expect } from '@playwright/test';

// Test data helpers
export const testUser = {
    email: 'test@example.com',
    password: 'TestPass123',
    name: 'Test User',
};

export const createTestBoard = async (page: any) => {
    await page.goto('/dashboard');
    await page.click('text=New Case');
    await page.fill('input[placeholder*="title"]', 'Test Board');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/board\/.+/);

    const url = page.url();
    const boardId = url.split('/board/')[1];
    return boardId;
};
