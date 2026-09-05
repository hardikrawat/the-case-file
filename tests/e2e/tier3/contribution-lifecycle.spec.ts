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

test.describe('Tier 3.4: Contribution Lifecycle: Suggestion, Visual Diff & Smart Merge', () => {
    let targetBoardId: string;
    let contributionId: string;
    const clientAlpha = createApiClient(undefined, DETECTIVE_ALPHA);
    const clientBeta = createApiClient(undefined, DETECTIVE_BETA);

    test.beforeAll(async () => {
        await seedTestUsers();

        // 1. Alpha creates target board with baseline nodes and edge
        targetBoardId = await createTestBoard({
            userId: DETECTIVE_ALPHA.id,
            title: `[E2E-TEST] Alibi Investigation ${Date.now()}`,
            isPublic: true,
            content: {
                nodes: [
                    {
                        id: 'node-base-1',
                        type: 'sticky',
                        position: { x: 100, y: 100 },
                        data: { label: 'Initial suspect: John Doe' },
                    },
                    {
                        id: 'node-base-2',
                        type: 'text',
                        position: { x: 350, y: 100 },
                        data: { label: 'Alibi: At cinema' },
                    },
                ],
                edges: [
                    {
                        id: 'e-base-1',
                        source: 'node-base-1',
                        target: 'node-base-2',
                        type: 'string',
                    },
                ],
            },
        });
    });

    test.afterAll(async () => {
        await cleanupTestData();
        await closeDbClient();
    });

    test('Detective Beta submits contribution proposal via POST /api/contributions', async () => {
        const proposalSnapshot = {
            nodes: [
                {
                    id: 'node-base-1',
                    type: 'sticky',
                    position: { x: 100, y: 100 },
                    data: { label: 'Initial suspect: John Doe' }, // Unchanged
                },
                {
                    id: 'node-base-2',
                    type: 'text',
                    position: { x: 350, y: 100 },
                    data: { label: 'Alibi DISPROVEN: Cinema ticket was forged' }, // Modified
                },
                {
                    id: 'node-contrib-3',
                    type: 'link',
                    position: { x: 600, y: 100 },
                    data: {
                        url: 'https://cctv-logs.city/cam-4',
                        title: 'CCTV Footage Bay 4',
                    }, // Added
                },
            ],
            edges: [
                {
                    id: 'e-base-1',
                    source: 'node-base-1',
                    target: 'node-base-2',
                    type: 'string',
                },
                {
                    id: 'e-contrib-2',
                    source: 'node-base-2',
                    target: 'node-contrib-3',
                    type: 'string',
                },
            ],
        };

        const postRes = await clientBeta.post<{ id: string }>('/api/contributions', {
            targetBoardId,
            message: 'Disproved John Doe alibi with CCTV link',
            snapshot: proposalSnapshot,
        });

        expect(postRes.status).toBe(201);
        expect(postRes.data.id).toBeDefined();
        contributionId = postRes.data.id;
    });

    test('verifies open contribution and visual diff categorization', async () => {
        const listRes = await clientAlpha.get<
            Array<{
                id: string;
                status: string;
                message: string;
                snapshot: {
                    nodes: Array<{ id: string; type: string; data: { label?: string } }>;
                    edges: Array<{ id: string }>;
                };
            }>
        >('/api/contributions', {
            params: { boardId: targetBoardId },
        });

        expect(listRes.status).toBe(200);
        expect(Array.isArray(listRes.data)).toBe(true);

        const contribution = listRes.data.find((c) => c.id === contributionId);
        expect(contribution).toBeDefined();
        expect(contribution?.status).toBe('open');
        expect(contribution?.message).toBe('Disproved John Doe alibi with CCTV link');

        // Verify Diff logic:
        const targetBoard = await getTestBoard(targetBoardId);
        const targetNodes = (targetBoard?.content as { nodes: Array<{ id: string; data: { label?: string } }> }).nodes;
        const snapshotNodes = contribution?.snapshot.nodes || [];

        // 1. node-base-1 is UNCHANGED
        const base1InTarget = targetNodes.find((n) => n.id === 'node-base-1');
        const base1InSnapshot = snapshotNodes.find((n) => n.id === 'node-base-1');
        expect(base1InTarget?.data.label).toBe(base1InSnapshot?.data.label);

        // 2. node-base-2 is MODIFIED
        const base2InTarget = targetNodes.find((n) => n.id === 'node-base-2');
        const base2InSnapshot = snapshotNodes.find((n) => n.id === 'node-base-2');
        expect(base2InTarget?.data.label).not.toBe(base2InSnapshot?.data.label);
        expect(base2InSnapshot?.data.label).toContain('Alibi DISPROVEN');

        // 3. node-contrib-3 is ADDED
        const contrib3InTarget = targetNodes.find((n) => n.id === 'node-contrib-3');
        const contrib3InSnapshot = snapshotNodes.find((n) => n.id === 'node-contrib-3');
        expect(contrib3InTarget).toBeUndefined();
        expect(contrib3InSnapshot).toBeDefined();
    });

    test('unauthorized user cannot merge contribution (403 Forbidden)', async () => {
        // Detective Beta is the contributor, not the board owner
        const mergeRes = await clientBeta.post(`/api/contributions/${contributionId}/merge`);
        expect(mergeRes.status).toBe(403);
    });

    test('board owner executes smart merge successfully', async () => {
        const mergeRes = await clientAlpha.post<{ success: boolean; mergedNodesCount: number }>(
            `/api/contributions/${contributionId}/merge`
        );
        expect(mergeRes.status).toBe(200);
        expect(mergeRes.data.success).toBe(true);
        expect(mergeRes.data.mergedNodesCount).toBe(3);
    });

    test('verifies merged board state and updated contribution status', async () => {
        // Direct DB inspection of target board
        const updatedBoard = await getTestBoard(targetBoardId);
        const content = updatedBoard?.content as {
            nodes: Array<{ id: string; type: string; data: { label?: string; title?: string } }>;
            edges: Array<{ id: string; source: string; target: string }>;
        };

        expect(content.nodes.length).toBe(3);
        expect(content.edges.length).toBe(2);

        // Verify modified node content
        const modifiedNode = content.nodes.find((n) => n.id === 'node-base-2');
        expect(modifiedNode?.data.label).toBe('Alibi DISPROVEN: Cinema ticket was forged');

        // Verify added node
        const addedNode = content.nodes.find((n) => n.id === 'node-contrib-3');
        expect(addedNode).toBeDefined();

        // Verify contribution status is 'merged'
        const listRes = await clientAlpha.get<Array<{ id: string; status: string }>>('/api/contributions', {
            params: { boardId: targetBoardId },
        });
        const mergedContribution = listRes.data.find((c) => c.id === contributionId);
        expect(mergedContribution?.status).toBe('merged');
    });

    test('prevents duplicate merge on already merged contribution (400 Bad Request)', async () => {
        const duplicateRes = await clientAlpha.post(`/api/contributions/${contributionId}/merge`);
        expect(duplicateRes.status).toBe(400);
    });

    test('browser UI reflects pending suggestions and opens ContributionModal', async ({ page, context }) => {
        await authenticateContext(context, DETECTIVE_ALPHA);
        await page.goto(`/board/${targetBoardId}`);
        await page.waitForSelector('.react-flow', { state: 'visible', timeout: 20000 });

        const reviewBtn = page.locator('button[aria-label="Review Suggestions"]');
        await expect(reviewBtn).toBeVisible({ timeout: 15000 });
        await reviewBtn.click();

        // Verify contribution review modal opens
        const modalHeading = page.locator('text=Review Suggestions, text=Contribution, text=Suggestions').first();
        await expect(modalHeading).toBeVisible({ timeout: 10000 });
    });
});
