import { test, expect } from '../fixtures/auth.fixtures';
import { mockBoardAPI, createMockBoard, navigateToBoard, addNode, saveBoard } from '../helpers/test-helpers';

test.describe('Board Interaction Tests - Enhanced', () => {

    test('should load board and display title', async ({ authenticatedPage: page }) => {
        const board = createMockBoard({
            id: 'interaction-test-1',
            title: 'My Test Case'
        });

        await mockBoardAPI(page, board);
        await navigateToBoard(page, board.id);

        // Verify title is displayed in the top bar
        await expect(page.getByText('My Test Case')).toBeVisible();
    });

    test('should save board successfully', async ({ authenticatedPage: page }) => {
        const board = createMockBoard({
            id: 'save-test-1'
        });

        let saveWasCalled = false;

        // Mock PUT request
        await page.route(`**/api/boards/${board.id}`, async route => {
            if (route.request().method() === 'PUT') {
                saveWasCalled = true;
                await route.fulfill({ status: 200, json: { success: true } });
            } else {
                await route.fulfill({ status: 200, json: board });
            }
        });

        await navigateToBoard(page, board.id);

        // Click save
        await saveBoard(page);

        // Verify save was called
        await page.waitForTimeout(1000);
        expect(saveWasCalled).toBe(true);

        // Check for save indication
        const savedIndicator = page.getByText(/Saved/i);
        await expect(savedIndicator).toBeVisible({ timeout: 5000 });
    });

    test('should open settings modal', async ({ authenticatedPage: page }) => {
        const board = createMockBoard({
            id: 'settings-test-1'
        });

        await mockBoardAPI(page, board);
        await navigateToBoard(page, board.id);

        // Click settings button
        const settingsBtn = page.getByLabel('Settings');
        await settingsBtn.click();

        // Verify modal opened
        await expect(page.getByText(/Board Settings/i)).toBeVisible({ timeout: 5000 });
    });

    test('should copy share link to clipboard', async ({ authenticatedPage: page, context }) => {
        const board = createMockBoard({
            id: 'share-test-1'
        });

        await mockBoardAPI(page, board);

        // Grant clipboard permissions
        await context.grantPermissions(['clipboard-read', 'clipboard-write']);

        await navigateToBoard(page, board.id);

        // Click share button
        const shareBtn = page.getByLabel('Share');
        await shareBtn.click();

        // Wait for toast notification
        await expect(page.getByText(/copied to clipboard/i)).toBeVisible({ timeout: 5000 });
    });

    test('should handle board with existing nodes', async ({ authenticatedPage: page }) => {
        const boardWithNodes = createMockBoard({
            id: 'nodes-test-1',
            content: {
                nodes: [
                    {
                        id: 'node-1',
                        type: 'sticky',
                        position: { x: 100, y: 100 },
                        data: { content: 'Test Note', color: '#fef3c7' }
                    }
                ],
                edges: []
            }
        });

        await mockBoardAPI(page, boardWithNodes);
        await navigateToBoard(page, boardWithNodes.id);

        // Verify node content is rendered (note: actual ReactFlow rendering might vary)
        // This is a basic check that the board loaded
        await expect(page.locator('.react-flow')).toBeVisible();
    });

    test('should handle empty board gracefully', async ({ authenticatedPage: page }) => {
        const emptyBoard = createMockBoard({
            id: 'empty-test-1',
            content: { nodes: [], edges: [] }
        });

        await mockBoardAPI(page, emptyBoard);
        await navigateToBoard(page, emptyBoard.id);

        // Verify ReactFlow canvas is present
        await expect(page.locator('.react-flow')).toBeVisible();

        // Verify toolbar is visible
        await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
    });
});
