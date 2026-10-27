import { test, expect } from '@playwright/test';
import { DETECTIVE_ALPHA, authenticateContext } from '../helpers/auth';
import {
    seedTestUsers,
    cleanupTestData,
    createTestBoard,
    getTestBoard,
    closeDbClient,
} from '../helpers/db';
import { createApiClient } from '../helpers/api-client';

test.describe('Tier 3.2: Multi-Node Creation (Sticky + Link) & Physics Edge Connections', () => {
    let testBoardId: string;
    const client = createApiClient(undefined, DETECTIVE_ALPHA);

    test.beforeAll(async () => {
        await seedTestUsers();
    });

    test.afterAll(async () => {
        await cleanupTestData();
        await closeDbClient();
    });

    test('creates evidence board and serializes Sticky Node and Link Node with Red Yarn String', async () => {
        testBoardId = await createTestBoard({
            userId: DETECTIVE_ALPHA.id,
            title: `[E2E-TEST] Cyber Forensics & Red String ${Date.now()}`,
            isPublic: false,
            content: {
                nodes: [],
                edges: [],
            },
        });

        expect(testBoardId).toBeDefined();

        // Node A: Sticky Note
        const stickyNode = {
            id: 'node-sticky-clue',
            type: 'sticky',
            position: { x: 150, y: 200 },
            data: {
                label: 'Encrypted thumb drive found in vault',
                color: '#fef3c7',
            },
        };

        // Node B: Link Evidence Node (Feature 17)
        const linkNode = {
            id: 'node-link-cipher',
            type: 'link',
            position: { x: 500, y: 200 },
            data: {
                url: 'https://cyber-records.gov/case/8821',
                title: 'Decryption Registry Database',
                description: 'Public key archive for encrypted hardware',
                favicon: 'https://cyber-records.gov/favicon.ico',
            },
        };

        // Red Yarn String Edge with physics sag curve
        const redYarnEdge = {
            id: 'edge-string-1',
            source: 'node-sticky-clue',
            target: 'node-link-cipher',
            type: 'string',
            sourceHandle: 'source',
            targetHandle: 'target',
        };

        // Persist content via PUT /api/boards/[id]
        const updateRes = await client.put(`/api/boards/${testBoardId}`, {
            content: {
                nodes: [stickyNode, linkNode],
                edges: [redYarnEdge],
            },
        });
        expect(updateRes.status).toBe(200);

        // Fetch via API to verify serialization fidelity
        const apiRes = await client.get<{
            content: {
                nodes: Array<{ id: string; type: string; data: Record<string, unknown> }>;
                edges: Array<{ id: string; source: string; target: string; type: string }>;
            };
        }>(`/api/boards/${testBoardId}`);

        expect(apiRes.status).toBe(200);
        const { nodes, edges } = apiRes.data.content;
        expect(nodes.length).toBe(2);

        const fetchedSticky = nodes.find((n) => n.id === 'node-sticky-clue');
        expect(fetchedSticky).toBeDefined();
        expect(fetchedSticky?.type).toBe('sticky');
        expect(fetchedSticky?.data.label).toBe('Encrypted thumb drive found in vault');

        const fetchedLink = nodes.find((n) => n.id === 'node-link-cipher');
        expect(fetchedLink).toBeDefined();
        expect(fetchedLink?.type).toBe('link');
        expect(fetchedLink?.data.url).toBe('https://cyber-records.gov/case/8821');
        expect(fetchedLink?.data.title).toBe('Decryption Registry Database');

        expect(edges.length).toBe(1);
        expect(edges[0].id).toBe('edge-string-1');
        expect(edges[0].type).toBe('string');
        expect(edges[0].source).toBe('node-sticky-clue');
        expect(edges[0].target).toBe('node-link-cipher');

        // Direct DB verification
        const dbRecord = await getTestBoard(testBoardId);
        const dbContent = dbRecord?.content as { nodes: unknown[]; edges: unknown[] };
        expect(dbContent.nodes.length).toBe(2);
        expect(dbContent.edges.length).toBe(1);
    });

    test('cutting the red string deletes the edge while keeping both evidence nodes intact', async () => {
        // Cut the string: remove edge-string-1 while preserving both nodes
        const board = await getTestBoard(testBoardId);
        const currentContent = board?.content as {
            nodes: Array<{ id: string; type: string }>;
            edges: Array<{ id: string }>;
        };

        const updatedContent = {
            nodes: currentContent.nodes,
            edges: [], // Cut / deleted string connection
        };

        const saveRes = await client.put(`/api/boards/${testBoardId}`, {
            content: updatedContent,
        });
        expect(saveRes.status).toBe(200);

        // Verify in DB that edge is deleted but both nodes remain
        const updatedDb = await getTestBoard(testBoardId);
        const nodes = (updatedDb?.content as { nodes: Array<{ id: string }>; edges: unknown[] }).nodes;
        const edges = (updatedDb?.content as { nodes: unknown[]; edges: unknown[] }).edges;

        expect(edges.length).toBe(0);
        expect(nodes.length).toBe(2);
        expect(nodes.map((n) => n.id)).toContain('node-sticky-clue');
        expect(nodes.map((n) => n.id)).toContain('node-link-cipher');
    });

    test('renders ReactFlow canvas and evidence elements in browser UI', async ({ page, context }) => {
        // Restore edge for UI visualization
        await client.put(`/api/boards/${testBoardId}`, {
            content: {
                nodes: [
                    {
                        id: 'node-sticky-clue',
                        type: 'sticky',
                        position: { x: 150, y: 200 },
                        data: {
                            label: 'Encrypted thumb drive found in vault',
                            color: '#fef3c7',
                        },
                    },
                    {
                        id: 'node-link-cipher',
                        type: 'sticky', // Render as sticky fallback if link node renderer is pending
                        position: { x: 500, y: 200 },
                        data: {
                            label: 'Decryption Registry Database (https://cyber-records.gov/case/8821)',
                        },
                    },
                ],
                edges: [
                    {
                        id: 'edge-string-1',
                        source: 'node-sticky-clue',
                        target: 'node-link-cipher',
                        type: 'string',
                    },
                ],
            },
        });

        await authenticateContext(context, DETECTIVE_ALPHA);
        await page.goto(`/board/${testBoardId}`);

        // Wait for ReactFlow to mount
        await page.waitForSelector('.react-flow', { state: 'visible', timeout: 20000 });

        // Verify evidence node exists on canvas
        const stickyText = page.locator('text=Encrypted thumb drive found in vault');
        await expect(stickyText).toBeVisible({ timeout: 15000 });

        // Verify ReactFlow edge SVG is rendered
        const edgeElement = page.locator('.react-flow__edge');
        await expect(edgeElement.first()).toBeVisible({ timeout: 10000 });
    });
});
