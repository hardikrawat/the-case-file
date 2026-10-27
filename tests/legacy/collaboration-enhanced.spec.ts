import { test, expect } from '../fixtures/auth.fixtures';
import { mockBoardAPI, createMockBoard, navigateToBoard } from '../helpers/test-helpers';

test.describe('Collaboration Features - Enhanced', () => {

    test('should render board with collaboration buttons visible', async ({ authenticatedPage: page }) => {
        const mockBoard = createMockBoard({
            id: 'test-123',
            title: 'Test Investigation'
        });

        await mockBoardAPI(page, mockBoard);

        // Debug logging
        page.on('console', msg => console.log('BROWSER:', msg.text()));
        page.on('pageerror', err => console.error('BROWSER ERROR:', err.message));
        page.on('requestfailed', request => {
            console.log(`REQUEST FAILED: ${request.url()} - ${request.failure()?.errorText}`);
        });
        page.on('response', response => {
            if (response.status() >= 400) {
                console.log(`RESPONSE ERROR: ${response.url()} - ${response.status()}`);
            }
        });

        await navigateToBoard(page, mockBoard.id);

        // Verify board loaded
        await expect(page.getByText('Test Investigation')).toBeVisible({ timeout: 15000 });

        // Check that fork button exists
        const forkBtn = page.getByLabel('Fork Board');
        await expect(forkBtn).toBeVisible();

        // Check Settings button
        await expect(page.getByLabel('Settings')).toBeVisible();

        // Check Share button
        await expect(page.getByLabel('Share')).toBeVisible();
    });

    test('should show "Suggest Changes" button when board has parentId', async ({ authenticatedPage: page }) => {
        const forkedBoard = createMockBoard({
            id: 'forked-board-123',
            title: 'Forked Investigation',
            parentId: 'original-board-456'
        });

        await mockBoardAPI(page, forkedBoard);

        // Mock the contributions API
        await page.route('**/api/contributions', async route => {
            if (route.request().method() === 'POST') {
                await route.fulfill({
                    status: 201,
                    json: { id: 'new-contribution' }
                });
            } else {
                await route.continue();
            }
        });

        await navigateToBoard(page, forkedBoard.id);

        // Wait for component to mount and state to update
        const suggestBtn = page.getByLabel('Suggest Changes');
        await expect(suggestBtn).toBeVisible({ timeout: 15000 });
    });

    test('should NOT show "Suggest Changes" on original boards', async ({ authenticatedPage: page }) => {
        const originalBoard = createMockBoard({
            id: 'original-123',
            title: 'Original Investigation',
            parentId: null
        });

        await mockBoardAPI(page, originalBoard);
        await navigateToBoard(page, originalBoard.id);

        // Suggest Changes button should not exist
        const suggestBtn = page.getByLabel('Suggest Changes');
        await expect(suggestBtn).toBeHidden();
    });

    test('should show "Review Suggestions" button on original boards', async ({ authenticatedPage: page }) => {
        const originalBoard = createMockBoard({
            id: 'original-456',
            parentId: null
        });

        await mockBoardAPI(page, originalBoard);
        await navigateToBoard(page, originalBoard.id);

        // Wait for possible loading
        await expect(page.getByText('Test Case')).toBeVisible({ timeout: 10000 });

        // Review button should be visible
        const reviewBtn = page.getByLabel('Review Suggestions');
        await expect(reviewBtn).toBeVisible();
    });

    test('should open ContributionModal when clicking Review', async ({ authenticatedPage: page }) => {
        const originalBoard = createMockBoard({
            id: 'original-789',
            parentId: null
        });

        await mockBoardAPI(page, originalBoard);

        // Mock contributions list
        await page.route(new RegExp(`/api/contributions\\?boardId=${originalBoard.id}`), async route => {
            await route.fulfill({
                status: 200,
                json: [{
                    id: 'contribution-1',
                    userId: 'other-user',
                    message: 'Fixed the timeline',
                    status: 'open',
                    createdAt: new Date().toISOString(),
                    snapshot: { nodes: [], edges: [] }
                }]
            });
        });

        await navigateToBoard(page, originalBoard.id);

        // Click Review button
        const reviewBtn = page.getByLabel('Review Suggestions');
        await expect(reviewBtn).toBeVisible({ timeout: 10000 });
        await reviewBtn.click();

        // Check modal opened
        await expect(page.getByText('Manage Contributions')).toBeVisible({ timeout: 10000 });
        await expect(page.getByText('Fixed the timeline')).toBeVisible();
    });

    test('should fork a board successfully', async ({ authenticatedPage: page }) => {
        const originalBoard = createMockBoard({
            id: 'to-fork-123',
            title: 'Case to Fork'
        });

        await mockBoardAPI(page, originalBoard);

        // Mock fork API
        await page.route(new RegExp('/api/boards$'), async route => {
            if (route.request().method() === 'POST') {
                await route.fulfill({
                    status: 201,
                    json: { id: 'new-forked-board-456' }
                });
            } else {
                await route.continue();
            }
        });

        // Mock the newly forked board
        const newBoard = createMockBoard({
            id: 'new-forked-board-456',
            title: 'Copy of Case to Fork',
            parentId: 'to-fork-123'
        });
        await mockBoardAPI(page, newBoard);

        await navigateToBoard(page, originalBoard.id);

        // Click fork button
        const forkBtn = page.getByLabel('Fork Board');
        await expect(forkBtn).toBeVisible({ timeout: 10000 });
        await forkBtn.click();

        // Should navigate to new board
        await page.waitForURL('**/board/new-forked-board-456', { timeout: 15000 });
    });
});
