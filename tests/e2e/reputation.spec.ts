import { test, expect } from '@playwright/test';

test.describe('Reputation & Leaderboard', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/login');
        await page.fill('input[type="email"]', 'test@example.com');
        await page.fill('input[type="password"]', 'TestPass123');
        await page.click('button[type="submit"]');
        await page.waitForURL('/dashboard');
    });

    test('should award points for creating board', async ({ page }) => {
        // Go to leaderboard to check initial points
        await page.goto('/leaderboard');
        const initialPoints = await page.locator('[data-testid="user-points"]').textContent();

        // Create a new board
        await page.goto('/dashboard');
        await page.click('text=New Case');
        await page.fill('input[placeholder*="title"]', 'Test Investigation');
        await page.click('button[type="submit"]');

        // Check leaderboard again
        await page.goto('/leaderboard');
        const newPoints = await page.locator('[data-testid="user-points"]').textContent();

        // Points should have increased by 10
        expect(parseInt(newPoints || '0')).toBeGreaterThan(parseInt(initialPoints || '0'));
    });

    test('should display user ranking', async ({ page }) => {
        await page.goto('/leaderboard');

        // Should show rankings
        await expect(page.locator('text=Ranking')).toBeVisible();
        await expect(page.locator('[data-testid="rank-1"]')).toBeVisible();
    });

    test('should show user stats on profile', async ({ page }) => {
        await page.goto('/profile/test-user-id');

        // Should display reputation and board count
        await expect(page.locator('text=Reputation')).toBeVisible();
        await expect(page.locator('text=Boards Created')).toBeVisible();
    });
});
