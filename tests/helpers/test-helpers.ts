import { Page } from '@playwright/test';

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
    // Mock GET single board - use wildcard pattern to catch any URL format
    await page.route(`**/api/boards/${board.id}**`, async route => {
        if (route.request().method() === 'GET') {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(board)
            });
        } else if (route.request().method() === 'PUT') {
            await route.fulfill({ status: 200, json: { success: true } });
        } else {
            await route.continue();
        }
    });

    // Mock GET all boards (dashboard)
    await page.route('**/api/boards**', async route => {
        if (route.request().method() === 'GET' && !route.request().url().includes(`/api/boards/${board.id}`)) {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify([board])
            });
        } else if (route.request().method() === 'POST') {
            // Mock board creation
            const { id, ...boardWithoutId } = board;
            await route.fulfill({
                status: 201,
                contentType: 'application/json',
                body: JSON.stringify({ id: 'new-board-id', ...boardWithoutId })
            });
        } else {
            await route.continue();
        }
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

        // Wait for network to be idle
        await page.waitForLoadState('networkidle', { timeout });

        // Wait for React to hydrate
        await page.waitForSelector('.react-flow', { timeout: 10000 }).catch(() => {
            // If ReactFlow doesn't load, that's okay for some pages
        });

        // Additional wait for any async operations
        await page.waitForTimeout(500);
    } catch (error) {
        console.warn('Page ready wait timeout:', error);
        // Continue anyway
    }
}

/**
 * Navigate to board and wait for it to be ready
 * CRITICAL: Call mockBoardAPI BEFORE this function
 */
export async function navigateToBoard(page: Page, boardId: string) {
    // Navigate to the board
    const response = page.goto(`/board/${boardId}`);

    // Wait for the response
    await response;

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
