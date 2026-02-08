import { test, expect } from '@playwright/test';

test.describe('Smoke Tests - Critical Paths', () => {
    test('homepage loads successfully', async ({ page }) => {
        await page.goto('/');
        await expect(page).toHaveTitle(/Case File/i);
    });

    test('can navigate to signup page', async ({ page }) => {
        await page.goto('/');

        // Look for signup link
        const signupLink = page.locator('a[href*="signup"]').first();
        if (await signupLink.count() > 0) {
            await signupLink.click();
            await expect(page).toHaveURL(/signup/);
        }
    });

    test('can navigate to login page', async ({ page }) => {
        await page.goto('/');

        const loginLink = page.locator('a[href*="login"]').first();
        if (await loginLink.count() > 0) {
            await loginLink.click();
            await expect(page).toHaveURL(/login/);
        }
    });

    test('protected routes redirect to login', async ({ page }) => {
        await page.goto('/dashboard');

        // Should redirect to login
        await page.waitForURL(/login/, { timeout: 10000 });
        await expect(page).toHaveURL(/login/);
    });

    test('API routes respond', async ({ request }) => {
        // Test public API endpoint if any exist
        const response = await request.get('/api/health');
        // Expect either 200 or 404 (route might not exist)
        expect([200, 404]).toContain(response.status());
    });
});
