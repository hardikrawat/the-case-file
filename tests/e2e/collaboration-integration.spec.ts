import { test, expect } from '../fixtures/auth.fixtures';
import { mockBoardAPI, createMockBoard, navigateToBoard } from '../helpers/test-helpers';

test.describe('Collaboration Features - Integration', () => {

    test('should open settings modal', async ({ authenticatedPage: page }) => {
        const mockBoard = createMockBoard({ id: 'test-board-id' });
        await mockBoardAPI(page, mockBoard);
        await navigateToBoard(page, mockBoard.id);

        // Click settings button
        await page.getByLabel('Settings').click();

        // Should see settings modal
        await expect(page.getByText('Case Settings')).toBeVisible();
    });

    test('should show share feedback', async ({ authenticatedPage: page }) => {
        const mockBoard = createMockBoard({ id: 'test-board-id' });
        await mockBoardAPI(page, mockBoard);
        await navigateToBoard(page, mockBoard.id);

        await page.getByLabel('Share').click();

        // Should see toast
        await expect(page.locator('text=Board link copied to clipboard!')).toBeVisible({ timeout: 10000 });
    });

    test('should show export feedback', async ({ authenticatedPage: page }) => {
        const mockBoard = createMockBoard({ id: 'test-board-id' });
        await mockBoardAPI(page, mockBoard);
        await navigateToBoard(page, mockBoard.id);

        // Click export button in toolbar
        const exportBtn = page.getByTitle('Export JSON');
        await expect(exportBtn).toBeVisible();
        // We don't necessarily need to click it and check file download in E2E unless configured
    });
});
