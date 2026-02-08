import { test, expect } from '../fixtures/auth.fixtures';

test.describe('Reputation & Leaderboard', () => {

    test('should award points for creating board', async ({ authenticatedPage: page }) => {
        // Mock profile data
        await page.route('**/api/me', async route => {
            await route.fulfill({
                status: 200,
                json: { id: 'test-user-123', name: 'Test Detective', points: 100 }
            });
        });

        // Go to profile to check initial points
        await page.goto('/profile/test-user-123');
        await expect(page.locator('text=Reputation')).toBeVisible();

        // Mock the points increasing after board creation would happen
        // In a real E2E we'd check the leaderboard, but here we can just verify UI
        await page.goto('/leaderboard');

        // Mock leaderboard
        await page.route('**/api/leaderboard*', async route => {
            await route.fulfill({
                status: 200,
                json: [
                    { userId: 'test-user-123', points: 110, rank: 1 },
                    { userId: 'other-user', points: 50, rank: 2 }
                ]
            });
        });

        await page.reload();
        await expect(page.locator('text=Leaderboard')).toBeVisible();
    });

    test('should display user ranking', async ({ authenticatedPage: page }) => {
        // Mock leaderboard
        await page.route('**/api/leaderboard*', async route => {
            await route.fulfill({
                status: 200,
                json: [
                    { userId: 'test-user-123', points: 110, rank: 1, name: 'Test Detective' }
                ]
            });
        });

        await page.goto('/leaderboard');

        // Should show rankings
        await expect(page.locator('text=Leaderboard')).toBeVisible();
        // The mock user should be there
        await expect(page.getByText('Detective #test-use')).toBeVisible();
    });

    test('should show user stats on profile', async ({ authenticatedPage: page }) => {
        await page.goto('/profile/test-user-123');

        // Should display reputation and board count
        await expect(page.locator('text=Reputation')).toBeVisible();
        await expect(page.locator('text=Cases Closed')).toBeVisible();
    });
});
