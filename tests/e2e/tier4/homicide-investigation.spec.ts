import { test, expect } from '@playwright/test';
import {
    DETECTIVE_ALPHA,
    DETECTIVE_BETA,
    DETECTIVE_GAMMA,
    authenticateContext,
} from '../helpers/auth';
import {
    getTursoClient,
    seedTestUsers,
    cleanupTestData,
    createTestBoard,
    getTestBoard,
    closeDbClient,
} from '../helpers/db';
import { createApiClient } from '../helpers/api-client';

test.describe('Tier 4.1: "The Blackwood Manor Mystery" Multi-Detective Workflow', () => {
    let boardId: string;
    const clientVance = createApiClient(undefined, DETECTIVE_ALPHA); // Lead Investigator (Owner)
    const clientAris = createApiClient(undefined, DETECTIVE_BETA); // Forensics Specialist (Editor)
    const clientMills = createApiClient(undefined, DETECTIVE_GAMMA); // Rookie Scribe (Viewer)
    const db = getTursoClient();

    test.beforeAll(async () => {
        await seedTestUsers();
    });

    test.afterAll(async () => {
        await cleanupTestData();
        await closeDbClient();
    });

    test('Act 1: Lead Investigator Vance creates crime scene investigation board', async () => {
        boardId = await createTestBoard({
            userId: DETECTIVE_ALPHA.id,
            title: `[E2E-TEST] The Blackwood Manor Mystery ${Date.now()}`,
            isPublic: false,
            content: {
                nodes: [
                    {
                        id: 'node-victim-1',
                        type: 'image',
                        position: { x: 100, y: 150 },
                        data: {
                            src: '/placeholder-body.jpg',
                            caption: 'Lord Blackwood found at 0600 in library',
                        },
                    },
                    {
                        id: 'node-scene-2',
                        type: 'sticky',
                        position: { x: 350, y: 150 },
                        data: {
                            label: 'No signs of forced entry. Window latch unfastened.',
                            color: '#fef3c7',
                        },
                    },
                ],
                edges: [],
            },
        });

        expect(boardId).toBeDefined();

        const board = await getTestBoard(boardId);
        expect(board?.title).toContain('The Blackwood Manor Mystery');
        expect(board?.is_public).toBe(0);
        expect(board?.userId).toBe(DETECTIVE_ALPHA.id);
    });

    test('Act 2: Forming the Task Force — Vance invites Forensics Specialist and Rookie Scribe', async () => {
        // Invite Dr. Aris as Editor
        const arisInvite = await clientVance.post(`/api/boards/${boardId}/collaborators`, {
            userId: DETECTIVE_BETA.id,
            role: 'editor',
        });
        expect(arisInvite.status).toBe(201);

        // Invite Officer Mills as Viewer
        const millsInvite = await clientVance.post(`/api/boards/${boardId}/collaborators`, {
            userId: DETECTIVE_GAMMA.id,
            role: 'viewer',
        });
        expect(millsInvite.status).toBe(201);

        // Verify task force in DB
        const collabRows = await db.execute({
            sql: `SELECT userId, role FROM board_collaborators WHERE board_id = ? ORDER BY role`,
            args: [boardId],
        });
        expect(collabRows.rows.length).toBe(2);
    });

    test('Act 3: Forensics Specialist Dr. Aris logs in and maps toxicology clues to prime suspect', async () => {
        // Fetch current board
        const fetchRes = await clientAris.get<{
            content: { nodes: Array<{ id: string }>; edges: Array<{ id: string }> };
        }>(`/api/boards/${boardId}`);
        expect(fetchRes.status).toBe(200);

        const currentNodes = fetchRes.data.content.nodes;

        // Dr. Aris adds toxicology evidence and nephew suspect
        const toxicologyNode = {
            id: 'node-toxicology-3',
            type: 'sticky',
            position: { x: 600, y: 150 },
            data: {
                label: 'Toxicology report: Trace belladonna alkaloids in brandy snifter',
                color: '#fee2e2',
            },
        };

        const nephewNode = {
            id: 'node-nephew-4',
            type: 'text',
            position: { x: 600, y: 350 },
            data: {
                label: "Lord Blackwood's Nephew (Sole Beneficiary of Estate)",
            },
        };

        const poisonYarnString = {
            id: 'edge-poison-link',
            source: 'node-toxicology-3',
            target: 'node-nephew-4',
            type: 'string',
        };

        const updateRes = await clientAris.put(`/api/boards/${boardId}`, {
            content: {
                nodes: [...currentNodes, toxicologyNode, nephewNode],
                edges: [poisonYarnString],
            },
        });
        expect(updateRes.status).toBe(200);

        // Verify 4 nodes and 1 string in DB
        const dbRecord = await getTestBoard(boardId);
        const nodes = (dbRecord?.content as { nodes: unknown[]; edges: unknown[] }).nodes;
        const edges = (dbRecord?.content as { nodes: unknown[]; edges: unknown[] }).edges;
        expect(nodes.length).toBe(4);
        expect(edges.length).toBe(1);
    });

    test('Act 4: Rookie Scribe Officer Mills is restricted from tampering, but contributes forensic notes via comments', async () => {
        // 1. Mills tries to overwrite board nodes -> 403 Forbidden
        const tamperRes = await clientMills.put(`/api/boards/${boardId}`, {
            content: { nodes: [], edges: [] },
        });
        expect(tamperRes.status).toBe(403);

        // 2. Mills contributes observation via comments on toxicology node
        const commentRes = await clientMills.post<{ id: string; content: string }>('/api/comments', {
            boardId,
            nodeId: 'node-toxicology-3',
            content: 'Pharmacy records show Nephew purchased belladonna tincture last Tuesday under an alias.',
        });
        expect(commentRes.status).toBe(201);
        expect(commentRes.data.content).toContain('purchased belladonna tincture');

        // 3. Vance retrieves comment feed
        const commentListRes = await clientVance.get<Array<{ id: string; content: string; userId: string }>>(
            '/api/comments',
            {
                params: { boardId, nodeId: 'node-toxicology-3' },
            }
        );
        expect(commentListRes.status).toBe(200);
        const millsComment = commentListRes.data.find((c) => c.userId === DETECTIVE_GAMMA.id);
        expect(millsComment).toBeDefined();
        expect(millsComment?.content).toContain('under an alias');
    });

    test('Act 5: Vance attaches probate link evidence and seals the investigation', async () => {
        const boardBefore = await getTestBoard(boardId);
        const contentBefore = boardBefore?.content as {
            nodes: Array<{ id: string }>;
            edges: Array<{ id: string }>;
        };

        const willLinkNode = {
            id: 'node-will-5',
            type: 'link',
            position: { x: 350, y: 350 },
            data: {
                url: 'https://city-archives.org/deeds/blackwood-will',
                title: 'Last Will and Testament of Lord Blackwood',
                description: 'Full estate bequeathed to nephew upon untimely demise.',
            },
        };

        const motiveString = {
            id: 'edge-motive-link',
            source: 'node-will-5',
            target: 'node-nephew-4',
            type: 'string',
        };

        const finalUpdate = await clientVance.put(`/api/boards/${boardId}`, {
            content: {
                nodes: [...contentBefore.nodes, willLinkNode],
                edges: [...contentBefore.edges, motiveString],
            },
        });
        expect(finalUpdate.status).toBe(200);

        // Final DB State Assertions
        const finalBoard = await getTestBoard(boardId);
        const finalContent = finalBoard?.content as { nodes: unknown[]; edges: unknown[] };

        expect(finalContent.nodes.length).toBe(5);
        expect(finalContent.edges.length).toBe(2);
        expect(finalBoard?.is_public).toBe(0);

        // Verify comments in DB
        const commentsInDb = await db.execute({
            sql: `SELECT id FROM comments WHERE board_id = ?`,
            args: [boardId],
        });
        expect(commentsInDb.rows.length).toBe(1);
    });

    test('Act 6: Browser UI verification of permissions: Mills (Viewer) vs Vance (Owner)', async ({
        page,
        context,
    }) => {
        // 1. Mills as viewer: Save button must not be visible
        await authenticateContext(context, DETECTIVE_GAMMA);
        await page.goto(`/board/${boardId}`);
        await page.waitForSelector('.react-flow', { state: 'visible', timeout: 20000 });

        const millsSave = page.locator('button:has-text("Save")');
        await expect(millsSave).toBeHidden();

        // 2. Vance as owner: Full editing environment
        await authenticateContext(context, DETECTIVE_ALPHA);
        await page.goto(`/board/${boardId}`);
        await page.waitForSelector('.react-flow', { state: 'visible', timeout: 20000 });

        const vanceSave = page.locator('button:has-text("Save")');
        await expect(vanceSave).toBeVisible({ timeout: 10000 });
    });
});
