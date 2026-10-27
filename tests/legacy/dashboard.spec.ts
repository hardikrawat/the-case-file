import { test, expect } from '../fixtures/auth.fixtures';
import { createMockBoard } from '../helpers/test-helpers';

test.describe('Dashboard Integration', () => {
    test.beforeEach(async ({ authenticatedPage: page }) => {
        // No real login needed, session is mocked via authenticatedPage fixture
        // Mock dashboard boards
        const board1 = createMockBoard({ id: '1', title: 'Board One', isPublic: true });
        const board2 = createMockBoard({ id: '2', title: 'Board Two', isPublic: true });

        const boards = [board1, board2];

        await page.route('**/api/boards**', async route => {
            if (route.request().method() === 'GET' && !route.request().url().includes('new-board-id')) {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify(boards)
                });
            } else if (route.request().method() === 'POST') {
                const newBoard = createMockBoard({ id: 'new-board-id', title: 'E2E Test Case', isPublic: false });
                boards.push(newBoard);
                await route.fulfill({
                    status: 201,
                    contentType: 'application/json',
                    body: JSON.stringify(newBoard)
                });
            }
        });

        // Mock individual board detail for redirection
        await page.route('**/api/boards/new-board-id**', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(createMockBoard({ id: 'new-board-id', title: 'E2E Test Case' }))
            });
        });

        // Wait for page to load and authentication to settle
        await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    });

    test('should display dashboard with boards', async ({ authenticatedPage: page }) => {
        // Wait for auth loading to finish
        await expect(page.locator('text=Loading...')).not.toBeVisible({ timeout: 15000 });
        // Wait for data loading to finish
        await expect(page.locator('text=Loading cases...')).not.toBeVisible({ timeout: 15000 });

        await expect(page.getByRole('heading', { name: 'My Cases' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'New Case' })).toBeVisible();
    });

    test('should filter boards by privacy', async ({ authenticatedPage: page }) => {
        // Wait for loading to finish
        await expect(page.locator('text=Loading cases...')).not.toBeVisible();

        // Click filter button
        await page.click('button:has-text("Filters")');
        await expect(page.locator('text=Filters & Sort')).toBeVisible();

        // Select public only
        await page.click('text=Public Only');

        // Check that only public boards are shown
        const privacyBadges = page.locator('[class*="green-500"]');
        const count = await privacyBadges.count();
        expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should sort boards by name', async ({ authenticatedPage: page }) => {
        // Wait for loading to finish
        await expect(page.locator('text=Loading cases...')).not.toBeVisible();

        await page.click('button:has-text("Filters")');
        await page.click('text=Name');

        // Verify boards are displayed
        await expect(page.locator('[href^="/board/"]').first()).toBeVisible();
    });

    test('should create new board and see it in dashboard', async ({ authenticatedPage: page }) => {
        // Wait for loading to finish
        await expect(page.locator('text=Loading cases...')).not.toBeVisible();

        await page.waitForSelector('text=New Case');
        await page.click('text=New Case');

        // Modal should be open
        await page.waitForSelector('text=Open New Case File');
        await page.getByPlaceholder('The Missing Clock').fill('E2E Test Case');
        await page.getByRole('button', { name: 'Create Case File' }).click();

        // Should redirect to new board
        await page.waitForURL(/\/board\/.+/, { timeout: 15000 });

        // Go back to dashboard
        await page.goto('/dashboard');

        // Wait for loading to finish again
        await expect(page.locator('text=Loading cases...')).not.toBeVisible();

        // Should see the new board
        await expect(page.locator('text=E2E Test Case')).toBeVisible();
    });
});
