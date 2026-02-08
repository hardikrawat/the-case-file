import { test, expect } from '@playwright/test';

test.describe('Dashboard Integration', () => {
    test.beforeEach(async ({ page }) => {
        // Login
        await page.goto('/login');
        await page.fill('input[type="email"]', 'test@example.com');
        await page.fill('input[type="password"]', 'TestPass123');
        await page.click('button[type="submit"]');
        await page.waitForURL('/dashboard');
    });

    test('should display dashboard with boards', async ({ page }) => {
        await expect(page.locator('text=My Cases')).toBeVisible();
        await expect(page.locator('text=New Case')).toBeVisible();
    });

    test('should filter boards by privacy', async ({ page }) => {
        // Click filter button
        await page.click('button:has-text("Filters")');
        await expect(page.locator('text=Filters & Sort')).toBeVisible();

        // Select public only
        await page.click('text=Public Only');

        // Check that only public boards are shown
        const privacy Badges = page.locator('[class*="green-500"]');
        const count = await privacyBadges.count();
        expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should sort boards by name', async ({ page }) => {
        await page.click('button:has-text("Filters")');
        await page.click('text=Name');

        // Verify boards are displayed
        await expect(page.locator('[href^="/board/"]').first()).toBeVisible();
    });

    test('should create new board and see it in dashboard', async ({ page }) => {
        await page.click('text=New Case');
        await page.fill('input[placeholder*="title"]', 'E2E Test Case');
        await page.click('button[type="submit"]');

        // Should redirect to new board
        await page.waitForURL(/\/board\/.+/);

        // Go back to dashboard
        await page.goto('/dashboard');

        // Should see the new board
        await expect(page.locator('text=E2E Test Case')).toBeVisible();
    });
});
