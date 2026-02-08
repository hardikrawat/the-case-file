import { Page, expect } from '@playwright/test';

/**
 * Test helper for authentication and session management
 */
export async function mockAuth(page: Page, userId = 'test-user-123') {
    // Mock the auth session
    await page.route('**/api/auth/session', async route => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                user: {
                    id: userId,
                    email: 'test@example.com',
                    name: 'Test User'
                },
                expires: new Date(Date.now() + 86400000).toISOString()
            })
        });
    });
}

/**
 * Mock board data for tests
 */
export interface MockBoard {
    id: string;
    title: string;
    isPublic: boolean;
    parentId: string | null;
    userId: string;
    content: { nodes: any[]; edges: any[] };
    createdAt?: Date;
    updatedAt?: Date;
}

export function createMockBoard(overrides: Partial<MockBoard> = {}): MockBoard {
    return {
        id: 'test-board-123',
        title: 'Test Case',
        isPublic: true,
        parentId: null,
        userId: 'test-user-123',
        content: { nodes: [], edges: [] },
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides
    };
}

/**
 * Setup board API mocks for reliable testing
 * CRITICAL: Must be called BEFORE navigating to the page
 */
export async function mockBoardAPI(page: Page, board: MockBoard) {
    // Also mock /api/me which is used by UserBadge
    await page.route('**/api/me', async route => {
        await route.fulfill({
            status: 200,
            json: {
                id: board.userId || 'test-user-123',
                name: 'Test Viewer',
                email: 'test@example.com',
                image: null,
                rank: 'Detective'
            }
        });
    });

    // Unified Boards API Mock
    await page.route('**/api/boards**', async route => {
        const method = route.request().method();
        const url = route.request().url();

        // Handle single board GET/PUT/POST (sub-resources like /fork)
        if (url.includes(`/api/boards/${board.id}`)) {
            if (method === 'GET') {
                return route.fulfill({ status: 200, json: board });
            } else if (method === 'PUT') {
                return route.fulfill({ status: 200, json: { success: true } });
            } else if (method === 'POST') {
                // Could be /fork or other actions
                return route.fulfill({
                    status: 200,
                    json: { ...board, id: `new-${board.id}`, parentId: board.id }
                });
            }
        }

        // Handle board list GET
        if (method === 'GET') {
            return route.fulfill({ status: 200, json: [board] });
        }

        // Handle board creation POST
        if (method === 'POST') {
            return route.fulfill({
                status: 201,
                json: { ...board, id: 'new-board-id' }
            });
        }

        // Fallback
        await route.continue();
    });

    // Default contributions mock (empty)
    await page.route(new RegExp(`/api/contributions\\?boardId=${board.id}$`), async route => {
        await route.fulfill({
            status: 200,
            json: []
        });
    });
}

/**
 * Mock contributions API
 */
export async function mockContributionsAPI(page: Page, contributions: any[] = []) {
    await page.route('**/api/contributions**', async route => {
        const method = route.request().method();
        const url = route.request().url();

        if (method === 'GET') {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(contributions)
            });
        } else if (method === 'POST' && !url.includes('/merge')) {
            await route.fulfill({
                status: 201,
                contentType: 'application/json',
                body: JSON.stringify({ id: 'new-contribution-123' })
            });
        } else if (url.includes('/merge')) {
            await route.fulfill({ status: 200, json: { success: true } });
        } else {
            await route.continue();
        }
    });
}

/**
 * Wait for page to fully load with all network activity settled
 */
export async function waitForPageReady(page: Page, options: { timeout?: number } = {}) {
    const timeout = options.timeout || 30000;

    try {
        // Wait for initial load
        await page.waitForLoadState('domcontentloaded', { timeout });

        // Wait for React to hydrate - check for loading overlay
        // We look for BOTH the positive existence and then disappearance
        const observer = page.locator('div:has-text("Reconstructing Case Evidence")').first();

        // Use a shorter timeout to see if it appears, then wait for it to go
        try {
            await expect(observer).toBeVisible({ timeout: 2000 });
            await expect(observer).not.toBeVisible({ timeout: 15000 });
        } catch (e) {
            // If it never appeared or already vanished, that's fine
        }

        // Wait for ReactFlow to be present
        await page.waitForSelector('.react-flow', { timeout: 10000 }).catch(() => { });

        // Wait for any async hydration/store updates
        await page.waitForTimeout(1000);
    } catch (error) {
        console.warn('Page ready wait timeout:', error);
    }
}

/**
 * Navigate to board and wait for it to be ready
 * CRITICAL: Call mockBoardAPI BEFORE this function
 */
export async function navigateToBoard(page: Page, boardId: string) {
    // Navigate to the board
    await page.goto(`/board/${boardId}`, { waitUntil: 'domcontentloaded' });

    // Wait for page to be fully ready
    await waitForPageReady(page);
}

/**
 * Add a node to the board (simulating toolbar click)
 */
export async function addNode(page: Page, nodeType: 'sticky' | 'image' | 'text' | 'article') {
    const buttonNames = {
        sticky: 'Sticky',
        image: 'Image',
        text: 'Text',
        article: 'Article'
    };

    const button = page.getByRole('button', { name: buttonNames[nodeType] });
    await button.click({ force: true });

    // Wait for node to appear
    await page.waitForTimeout(500);
}

/**
 * Click save button and wait for save to complete
 */
export async function saveBoard(page: Page) {
    const saveButton = page.getByRole('button', { name: 'Save' });
    await saveButton.click();
    // Wait for save indication
    await page.waitForTimeout(1000);
}
