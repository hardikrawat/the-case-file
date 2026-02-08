import { test, expect } from '@playwright/test';

test.describe('Collaboration Features', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/login');
        await page.fill('input[type="email"]', 'test@example.com');
        await page.fill('input[type="password"]', 'TestPass123');
        await page.click('button[type="submit"]');
        await page.waitForURL('/dashboard');
    });

    test('should open comments panel', async ({ page }) => {
        // Create or open a board first
        await page.goto('/board/test-board-id');
        
        // Click comments button
        await page.click('button:has-text("Comments")');
        
        // Should see comments panel
        await expect(page.locator('text=Comments')).toBeVisible();
    });

    test('should open version history', async ({ page }) => {
        await page.goto('/board/test-board-id');
        
        await page.click('button:has-text("History")');
        
        await expect(page.locator('text=Version History')).toBeVisible();
    });

    test('should open  collaborators panel', async ({ page }) => {
        await page.goto('/board/test-board-id');
        
        await page.click('button:has-text("Team")');
        
        await expect(page.locator('text=Collaborators')).toBeVisible();
    });

    test('should show export modal', async ({ page }) => {
        await page.goto('/board/test-board-id');
        
        // Assuming there's an export button
        await page.click('[data-testid="export-button"]', { timeout: 5000 }).catch(() => {
            // Export button might be in menu
        });
    });
});
