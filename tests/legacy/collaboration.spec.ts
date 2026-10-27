import { test, expect } from '../fixtures/auth.fixtures';
import { mockBoardAPI, createMockBoard, navigateToBoard } from '../helpers/test-helpers';

test.describe('Collaboration Features - Basic', () => {

    test('should show collaboration buttons in toolbar', async ({ authenticatedPage: page }) => {
        const mockBoard = createMockBoard({
            id: 'test-123',
            title: 'Test Case'
        });

        await mockBoardAPI(page, mockBoard);
        await navigateToBoard(page, mockBoard.id);

        // Check that fork button exists (uses aria-label)
        const forkBtn = page.getByLabel('Fork Board');
        await expect(forkBtn).toBeVisible({ timeout: 10000 });
    });

    test('UI renders correctly with parentId', async ({ authenticatedPage: page }) => {
        const forkedBoard = createMockBoard({
            id: 'test-fork',
            title: 'Forked Test',
            parentId: 'original-123'
        });

        await mockBoardAPI(page, forkedBoard);
        await navigateToBoard(page, forkedBoard.id);

        // The button should appear after state updates
        const suggestBtn = page.getByLabel('Suggest Changes');
        await expect(suggestBtn).toBeVisible({ timeout: 10000 });
    });
});
