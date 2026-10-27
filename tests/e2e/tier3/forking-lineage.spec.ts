import { test, expect } from '@playwright/test';
import {
    DETECTIVE_ALPHA,
    DETECTIVE_BETA,
    authenticateContext,
} from '../helpers/auth';
import {
    seedTestUsers,
    cleanupTestData,
    createTestBoard,
    getTestBoard,
    closeDbClient,
} from '../helpers/db';
import { createApiClient } from '../helpers/api-client';

test.describe('Tier 3.1: Case Forking, Lineage Tracking & State Isolation', () => {
    let parentBoardId: string;
    let forkedBoardId: string;
    const clientAlpha = createApiClient(undefined, DETECTIVE_ALPHA);
    const clientBeta = createApiClient(undefined, DETECTIVE_BETA);

    test.beforeAll(async () => {
        await seedTestUsers();
    });

    test.afterAll(async () => {
        await cleanupTestData();
        await closeDbClient();
    });

    test('creates master investigation board with null parentId', async () => {
        const title = `[E2E-TEST] Unsolved Warehouse Arson ${Date.now()}`;
        parentBoardId = await createTestBoard({
            userId: DETECTIVE_ALPHA.id,
            title,
            isPublic: true,
            content: {
                nodes: [
                    {
                        id: 'node-origin-1',
                        type: 'sticky',
                        position: { x: 100, y: 100 },
                        data: { label: 'Point of origin: Bay 4' },
                    },
                ],
                edges: [],
            },
        });

        expect(parentBoardId).toBeDefined();

        // Verify via API as Detective Beta
        const res = await clientBeta.get<{ id: string; parentId: string | null; title: string; isPublic: boolean }>(
            `/api/boards/${parentBoardId}`
        );
        expect(res.status).toBe(200);
        expect(res.data.id).toBe(parentBoardId);
        expect(res.data.parentId).toBeNull();
        expect(res.data.title).toBe(title);

        // Verify via DB
        const dbRecord = await getTestBoard(parentBoardId);
        expect(dbRecord).not.toBeNull();
        expect(dbRecord?.parentId).toBeNull();
        expect(dbRecord?.userId).toBe(DETECTIVE_ALPHA.id);
    });

    test('Detective Beta forks master board, establishing parentId lineage', async () => {
        const forkTitle = `[E2E-TEST] Copy of Unsolved Warehouse Arson ${Date.now()}`;
        const forkPayload = {
            title: forkTitle,
            isPublic: false,
            parentId: parentBoardId,
            content: {
                nodes: [
                    {
                        id: 'node-origin-1',
                        type: 'sticky',
                        position: { x: 100, y: 100 },
                        data: { label: 'Point of origin: Bay 4' },
                    },
                ],
                edges: [],
            },
        };

        const forkRes = await clientBeta.post<{ id: string }>('/api/boards', forkPayload);
        expect(forkRes.status).toBe(201);
        expect(forkRes.data.id).toBeDefined();
        forkedBoardId = forkRes.data.id;

        // Verify forked board lineage in DB
        const forkedRecord = await getTestBoard(forkedBoardId);
        expect(forkedRecord).not.toBeNull();
        expect(forkedRecord?.parentId).toBe(parentBoardId);
        expect(forkedRecord?.userId).toBe(DETECTIVE_BETA.id);
        expect(forkedRecord?.is_public).toBe(0);
    });

    test('Detective Beta modifies forked board with independent evidence and red string edge', async () => {
        const updatedContent = {
            nodes: [
                {
                    id: 'node-origin-1',
                    type: 'sticky',
                    position: { x: 100, y: 100 },
                    data: { label: 'Point of origin: Bay 4' },
                },
                {
                    id: 'node-suspect-2',
                    type: 'sticky',
                    position: { x: 350, y: 100 },
                    data: { label: 'Suspect vehicle spotted near Bay 4: Red sedan' },
                },
            ],
            edges: [
                {
                    id: 'edge-1-2',
                    source: 'node-origin-1',
                    target: 'node-suspect-2',
                    type: 'string',
                },
            ],
        };

        const updateRes = await clientBeta.put(`/api/boards/${forkedBoardId}`, {
            content: updatedContent,
        });
        expect(updateRes.status).toBe(200);

        // Verify forked board now has 2 nodes and 1 edge
        const forkedRecord = await getTestBoard(forkedBoardId);
        const forkedNodes = (forkedRecord?.content as { nodes: unknown[]; edges: unknown[] }).nodes;
        const forkedEdges = (forkedRecord?.content as { nodes: unknown[]; edges: unknown[] }).edges;
        expect(forkedNodes.length).toBe(2);
        expect(forkedEdges.length).toBe(1);
    });

    test('master board state remains completely isolated and untouched', async () => {
        // Query master board via API as Detective Alpha
        const masterRes = await clientAlpha.get<{
            id: string;
            content: { nodes: unknown[]; edges: unknown[] };
        }>(`/api/boards/${parentBoardId}`);
        expect(masterRes.status).toBe(200);
        expect(masterRes.data.content.nodes.length).toBe(1);
        expect(masterRes.data.content.edges.length).toBe(0);

        // Direct DB verification
        const parentRecord = await getTestBoard(parentBoardId);
        const parentNodes = (parentRecord?.content as { nodes: unknown[]; edges: unknown[] }).nodes;
        const parentEdges = (parentRecord?.content as { nodes: unknown[]; edges: unknown[] }).edges;
        expect(parentNodes.length).toBe(1);
        expect(parentEdges.length).toBe(0);
        expect(parentRecord?.parentId).toBeNull();
    });

    test('browser UI reflects forking lineage: "Suggest Changes" on fork and "Review Suggestions" on master', async ({
        page,
        context,
    }) => {
        // 1. Beta visits forked board -> Should see "Suggest Changes"
        await authenticateContext(context, DETECTIVE_BETA);
        await page.goto(`/board/${forkedBoardId}`);
        await page.waitForSelector('.react-flow', { state: 'visible', timeout: 20000 });

        const suggestBtn = page.locator('button[aria-label="Suggest Changes"]');
        await expect(suggestBtn).toBeVisible({ timeout: 15000 });

        // 2. Alpha visits parent board -> Should see "Review Suggestions" and NOT "Suggest Changes"
        await authenticateContext(context, DETECTIVE_ALPHA);
        await page.goto(`/board/${parentBoardId}`);
        await page.waitForSelector('.react-flow', { state: 'visible', timeout: 20000 });

        const reviewBtn = page.locator('button[aria-label="Review Suggestions"]');
        await expect(reviewBtn).toBeVisible({ timeout: 15000 });

        const suggestBtnAlpha = page.locator('button[aria-label="Suggest Changes"]');
        await expect(suggestBtnAlpha).toBeHidden();
    });

    test('dashboard cards display "Fork" badge for forked investigations', async ({ page, context }) => {
        await authenticateContext(context, DETECTIVE_BETA);
        await page.goto('/cases');
        await page.waitForLoadState('networkidle');

        // Look for the Fork badge on the forked board card
        const forkBadge = page.locator('text=Fork');
        await expect(forkBadge.first()).toBeVisible({ timeout: 15000 });
    });
});
