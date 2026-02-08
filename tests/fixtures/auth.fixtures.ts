import { test as base, Page } from '@playwright/test';

export type TestFixtures = {
    authenticatedPage: Page;
};

/**
 * Extended test with authenticated page fixture
 */
export const test = base.extend<TestFixtures>({
    authenticatedPage: async ({ page }: { page: Page }, use) => {
        // Mock authentication before each test
        await page.route('**/api/auth/session', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    user: {
                        id: 'test-user-123',
                        email: 'test@example.com',
                        name: 'Test Detective'
                    },
                    expires: new Date(Date.now() + 86400000).toISOString()
                })
            });
        });

        await use(page);
    }
});

export { expect } from '@playwright/test';
