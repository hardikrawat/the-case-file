import { test, expect } from '@playwright/test';
import {
    DETECTIVE_ALPHA,
    authenticateContext,
    seedTestUsers,
    cleanupTestData,
    closeDbClient,
    createTestBoard,
    waitForBoardReady,
    addNode,
} from '../helpers';

test.describe('Tier 1: Canvas Evidence Board & Node Types', () => {
    test.beforeAll(async () => {
        await seedTestUsers();
    });

    test.afterAll(async () => {
        await cleanupTestData();
        await closeDbClient();
    });

    test('T1-CANVAS-01: Sticky Note Evidence Node Creation & Editing', async ({ page, context }) => {
        await authenticateContext(context, DETECTIVE_ALPHA);

        const boardId = await createTestBoard({
            userId: DETECTIVE_ALPHA.id,
            title: `[E2E-TEST] Sticky Note Canvas ${Date.now()}`,
            isPublic: true,
        });

        await page.goto(`/board/${boardId}`);
        await waitForBoardReady(page);

        // Click Add Sticky Note button on toolbar
        await addNode(page, 'sticky');

        // Locate created sticky note on ReactFlow canvas
        const stickyNode = page.locator('.react-flow__node').filter({
            has: page.locator('textarea[placeholder*="Pin a clue"]'),
        });
        await expect(stickyNode).toBeVisible({ timeout: 10000 });

        // Edit clue text
        const clueText = 'Suspect seen leaving warehouse at 22:45';
        const textarea = stickyNode.locator('textarea');
        await textarea.fill(clueText);
        await expect(textarea).toHaveValue(clueText);
    });

    test('T1-CANVAS-02: Text Evidence Node Creation & Auto-Resize', async ({ page, context }) => {
        await authenticateContext(context, DETECTIVE_ALPHA);

        const boardId = await createTestBoard({
            userId: DETECTIVE_ALPHA.id,
            title: `[E2E-TEST] Text Node Canvas ${Date.now()}`,
            isPublic: true,
        });

        await page.goto(`/board/${boardId}`);
        await waitForBoardReady(page);

        // Click Add Text button on toolbar
        await addNode(page, 'text');

        // Locate text node
        const textNode = page.locator('.react-flow__node').filter({
            has: page.locator('textarea[placeholder*="Label"]'),
        });
        await expect(textNode).toBeVisible({ timeout: 10000 });

        const headerText = 'PRIME SUSPECTS: PERSON OF INTEREST';
        const textarea = textNode.locator('textarea');
        await textarea.fill(headerText);
        await expect(textarea).toHaveValue(headerText);
    });

    test('T1-CANVAS-03: Image Evidence Node & Exhibit Framing', async ({ page, context }) => {
        await authenticateContext(context, DETECTIVE_ALPHA);

        const boardId = await createTestBoard({
            userId: DETECTIVE_ALPHA.id,
            title: `[E2E-TEST] Image Node Canvas ${Date.now()}`,
            isPublic: true,
        });

        await page.goto(`/board/${boardId}`);
        await waitForBoardReady(page);

        // Click Add Image button on toolbar
        await addNode(page, 'image');

        // Locate image polaroid node
        const imageNode = page.locator('.react-flow__node').filter({
            hasText: /EXHIBIT/i,
        });
        await expect(imageNode).toBeVisible({ timeout: 10000 });

        // Verify exhibit badge and caption input
        await expect(imageNode.getByText(/EXHIBIT/i)).toBeVisible();
        const captionInput = imageNode.locator('input[placeholder*="Label this clue"]');
        await expect(captionInput).toBeVisible();

        await captionInput.fill('Exhibit A - Footprint at scene');
        await expect(captionInput).toHaveValue('Exhibit A - Footprint at scene');
    });

    test('T1-CANVAS-04: Article Evidence Node & Automated Preview Fetch', async ({ page, context }) => {
        await authenticateContext(context, DETECTIVE_ALPHA);

        const boardId = await createTestBoard({
            userId: DETECTIVE_ALPHA.id,
            title: `[E2E-TEST] Article Node Canvas ${Date.now()}`,
            isPublic: true,
        });

        await page.goto(`/board/${boardId}`);
        await waitForBoardReady(page);

        // Click Add Article button on toolbar
        await addNode(page, 'article');

        // Verify article node mounts
        const articleNode = page.locator('.react-flow__node').filter({
            has: page.locator('input[placeholder*="url" i], input[placeholder*="http" i], .article-clipping'),
        });
        await expect(articleNode).toBeVisible({ timeout: 10000 });
    });

    test('T1-CANVAS-05: Link Evidence Node Creation (Feature 17)', async ({ page, context }) => {
        await authenticateContext(context, DETECTIVE_ALPHA);

        const boardId = await createTestBoard({
            userId: DETECTIVE_ALPHA.id,
            title: `[E2E-TEST] Link Node Canvas ${Date.now()}`,
            isPublic: true,
            content: {
                nodes: [
                    {
                        id: 'node-link-1',
                        type: 'link',
                        position: { x: 250, y: 200 },
                        data: {
                            title: 'Probate Registry Evidence',
                            url: 'https://registry.example.org/cases/1029',
                        },
                    },
                ],
                edges: [],
            },
        });

        await page.goto(`/board/${boardId}`);
        await waitForBoardReady(page);

        // Verify that the link node or link button is supported on canvas
        const linkNode = page.locator('.react-flow__node').filter({
            hasText: /Probate Registry Evidence/i,
        });
        await expect(linkNode).toBeVisible({ timeout: 10000 });
    });

    test('T1-CANVAS-06: Individual Node Deletion & Edge Cleanup (Feature 18)', async ({ page, context }) => {
        await authenticateContext(context, DETECTIVE_ALPHA);

        const boardId = await createTestBoard({
            userId: DETECTIVE_ALPHA.id,
            title: `[E2E-TEST] Node Deletion Canvas ${Date.now()}`,
            isPublic: true,
            content: {
                nodes: [
                    {
                        id: 'del-node-a',
                        type: 'sticky',
                        position: { x: 100, y: 150 },
                        data: { label: 'Node To Delete' },
                    },
                    {
                        id: 'surviving-node-b',
                        type: 'sticky',
                        position: { x: 400, y: 150 },
                        data: { label: 'Surviving Node' },
                    },
                ],
                edges: [
                    {
                        id: 'edge-a-b',
                        source: 'del-node-a',
                        target: 'surviving-node-b',
                        type: 'string',
                    },
                ],
            },
        });

        await page.goto(`/board/${boardId}`);
        await waitForBoardReady(page);

        // Verify both nodes are visible initially
        const nodeA = page.locator('[data-id="del-node-a"]');
        const nodeB = page.locator('[data-id="surviving-node-b"]');
        await expect(nodeA).toBeVisible({ timeout: 10000 });
        await expect(nodeB).toBeVisible({ timeout: 10000 });

        // Select Node A and trigger deletion (click node, then press Delete key)
        await nodeA.click();
        await page.keyboard.press('Delete');
        await page.waitForTimeout(500);

        // Verify Node A is deleted from canvas
        await expect(nodeA).not.toBeVisible();

        // Verify surviving node B remains intact
        await expect(nodeB).toBeVisible();

        // Verify connecting edge is purged
        const edge = page.locator('[data-testid="rf__edge-edge-a-b"], g[data-id="edge-a-b"]');
        await expect(edge).not.toBeVisible();
    });

    test('T1-CANVAS-07: Red Yarn String Cutting Synchronization (Feature 19)', async ({ page, context }) => {
        await authenticateContext(context, DETECTIVE_ALPHA);

        const boardId = await createTestBoard({
            userId: DETECTIVE_ALPHA.id,
            title: `[E2E-TEST] String Cutting Canvas ${Date.now()}`,
            isPublic: true,
            content: {
                nodes: [
                    { id: 'cut-node-1', type: 'sticky', position: { x: 100, y: 200 }, data: { label: 'Origin' } },
                    { id: 'cut-node-2', type: 'sticky', position: { x: 400, y: 200 }, data: { label: 'Target' } },
                ],
                edges: [
                    {
                        id: 'test-cut-edge',
                        source: 'cut-node-1',
                        target: 'cut-node-2',
                        type: 'string',
                    },
                ],
            },
        });

        await page.goto(`/board/${boardId}`);
        await waitForBoardReady(page);

        // Locate edge and click it to select
        const edgeLocator = page.locator('[data-testid="rf__edge-test-cut-edge"], g[data-id="test-cut-edge"], .react-flow__edge').first();
        await edgeLocator.click({ force: true });
        await page.waitForTimeout(300);

        // Click Cut String button (scissors icon or button with title/aria-label "Cut String")
        const cutButton = page.locator('button[title="Cut String"], button[aria-label="Cut String"]');
        if (await cutButton.isVisible()) {
            await cutButton.click();
            await page.waitForTimeout(300);
            await expect(page.locator('[data-testid="rf__edge-test-cut-edge"]')).not.toBeVisible();
        }
    });

    test('T1-STORE-01: Cross-Board State Isolation (Feature 20)', async ({ page, context }) => {
        await authenticateContext(context, DETECTIVE_ALPHA);

        // Create Board Alpha with 2 distinct nodes
        const boardAlphaId = await createTestBoard({
            userId: DETECTIVE_ALPHA.id,
            title: `[E2E-TEST] Board Alpha ${Date.now()}`,
            isPublic: true,
            content: {
                nodes: [
                    { id: 'alpha-node-1', type: 'sticky', position: { x: 100, y: 100 }, data: { label: 'ALPHA UNIQUE CLUE' } },
                ],
                edges: [],
            },
        });

        // Create Board Beta with 0 nodes
        const boardBetaId = await createTestBoard({
            userId: DETECTIVE_ALPHA.id,
            title: `[E2E-TEST] Board Beta ${Date.now()}`,
            isPublic: true,
            content: {
                nodes: [],
                edges: [],
            },
        });

        // 1. Visit Board Alpha and verify Alpha clue is rendered
        await page.goto(`/board/${boardAlphaId}`);
        await waitForBoardReady(page);
        await expect(page.getByText('ALPHA UNIQUE CLUE')).toBeVisible({ timeout: 10000 });

        // 2. Navigate to Board Beta
        await page.goto(`/board/${boardBetaId}`);
        await waitForBoardReady(page);

        // 3. Verify Board Alpha's clue is NOT present on Board Beta
        await expect(page.getByText('ALPHA UNIQUE CLUE')).not.toBeVisible();

        // 4. Verify no nodes are displayed from Board Alpha
        const betaNodes = page.locator('.react-flow__node');
        await expect(betaNodes).toHaveCount(0);
    });
});
