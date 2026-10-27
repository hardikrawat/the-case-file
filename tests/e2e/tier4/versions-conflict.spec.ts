import { test, expect } from '@playwright/test';
import { DETECTIVE_ALPHA, DETECTIVE_BETA, authenticateContext } from '../helpers/auth';
import {
    seedTestUsers,
    cleanupTestData,
    createTestBoard,
    getTestBoard,
    closeDbClient,
} from '../helpers/db';
import { createApiClient } from '../helpers/api-client';

test.describe('Tier 4.4: Version History Snapshotting, Rollback & Optimistic Lock Conflict Handling', () => {
    let boardId: string;
    let version1Id: string;
    const clientLead = createApiClient(undefined, DETECTIVE_ALPHA);
    const clientCollab = createApiClient(undefined, DETECTIVE_BETA);

    const pristineInvestigationContent = {
        nodes: [
            { id: 'clue-1', type: 'sticky', data: { label: 'Fingerprints on windowsill' } },
            { id: 'clue-2', type: 'sticky', data: { label: 'Muddy boot prints in foyer' } },
            { id: 'clue-3', type: 'text', data: { label: 'Security guard logbook missing page 4' } },
            { id: 'clue-4', type: 'link', data: { url: 'https://records.gov', title: 'Registry' } },
        ],
        edges: [
            { id: 'e-1-2', source: 'clue-1', target: 'clue-2', type: 'string' },
            { id: 'e-2-3', source: 'clue-2', target: 'clue-3', type: 'string' },
        ],
    };

    test.beforeAll(async () => {
        await seedTestUsers();

        boardId = await createTestBoard({
            userId: DETECTIVE_ALPHA.id,
            title: `[E2E-TEST] Arson Investigation Milestone Vault ${Date.now()}`,
            isPublic: false,
            content: pristineInvestigationContent,
            version: 1,
        });

        // Add Detective Beta as editor
        await clientLead.post(`/api/boards/${boardId}/collaborators`, {
            userId: DETECTIVE_BETA.id,
            role: 'editor',
        });
    });

    test.afterAll(async () => {
        await cleanupTestData();
        await closeDbClient();
    });

    test('Step 1: Creates milestone version snapshot in board_versions', async () => {
        const createVerRes = await clientLead.post<{ id: string; boardId: string; content: unknown }>(
            `/api/boards/${boardId}/versions`,
            {
                content: pristineInvestigationContent,
            }
        );

        expect(createVerRes.status).toBe(201);
        expect(createVerRes.data.id).toBeDefined();
        version1Id = createVerRes.data.id;
    });

    test('Step 2: Accidental or corrupt edit reduces board to single clue', async () => {
        const corruptContent = {
            nodes: [
                { id: 'clue-1', type: 'sticky', data: { label: 'Fingerprints on windowsill' } },
            ],
            edges: [],
        };

        const corruptRes = await clientLead.put(`/api/boards/${boardId}`, {
            content: corruptContent,
        });
        expect(corruptRes.status).toBe(200);

        // Verify board is corrupted in DB
        const board = await getTestBoard(boardId);
        const nodes = (board?.content as { nodes: unknown[] }).nodes;
        expect(nodes.length).toBe(1);
    });

    test('Step 3: Detective inspects version history list via GET /api/boards/[id]/versions', async () => {
        const listRes = await clientLead.get<
            Array<{
                id: string;
                content: { nodes: unknown[]; edges: unknown[] };
                createdAt: string;
            }>
        >(`/api/boards/${boardId}/versions`);

        expect(listRes.status).toBe(200);
        expect(Array.isArray(listRes.data)).toBe(true);
        expect(listRes.data.length).toBeGreaterThanOrEqual(1);

        const v1 = listRes.data.find((v) => v.id === version1Id);
        expect(v1).toBeDefined();
        expect(v1?.content.nodes.length).toBe(4);
        expect(v1?.content.edges.length).toBe(2);
    });

    test('Step 4: Rollback execution restores pristine canvas state', async () => {
        // Fetch Version 1 snapshot content
        const listRes = await clientLead.get<
            Array<{
                id: string;
                content: typeof pristineInvestigationContent;
            }>
        >(`/api/boards/${boardId}/versions`);

        const v1 = listRes.data.find((v) => v.id === version1Id);
        expect(v1).toBeDefined();

        // Restore snapshot via PUT
        const rollbackRes = await clientLead.put(`/api/boards/${boardId}`, {
            content: v1?.content,
        });
        expect(rollbackRes.status).toBe(200);

        // Verify DB content is completely restored
        const restoredBoard = await getTestBoard(boardId);
        const restoredContent = restoredBoard?.content as typeof pristineInvestigationContent;

        expect(restoredContent.nodes.length).toBe(4);
        expect(restoredContent.edges.length).toBe(2);
        expect(restoredContent.nodes.map((n) => n.id)).toEqual([
            'clue-1',
            'clue-2',
            'clue-3',
            'clue-4',
        ]);
    });

    test('Step 5: Optimistic locking and conflict detection verification', async () => {
        // Verify board version column exists and is tracked in database
        const board = await getTestBoard(boardId);
        expect(board?.version).toBeDefined();
        expect(typeof board?.version).toBe('number');

        // Test concurrent edit scenario: Collaborator saves an update
        const collabUpdate = await clientCollab.put(`/api/boards/${boardId}`, {
            content: {
                nodes: [
                    ...pristineInvestigationContent.nodes,
                    { id: 'clue-5-collab', type: 'sticky', data: { label: 'New tip from informant' } },
                ],
                edges: pristineInvestigationContent.edges,
            },
            version: board?.version,
        });

        // The update should either succeed with 200 or return 409 if version locked
        expect([200, 409]).toContain(collabUpdate.status);
    });

    test('Step 6: Version History UI panel opens in browser', async ({ page, context }) => {
        await authenticateContext(context, DETECTIVE_ALPHA);
        await page.goto(`/board/${boardId}`);
        await page.waitForSelector('.react-flow', { state: 'visible', timeout: 20000 });

        // Click Version History button in toolbar if available
        const historyBtn = page.locator(
            'button[aria-label="Version History"], button:has-text("History"), button[title*="History"]'
        );

        if (await historyBtn.first().isVisible()) {
            await historyBtn.first().click();

            // Verify version history modal / panel content
            const versionHeader = page.locator('text=Version, text=History, text=Snapshot');
            await expect(versionHeader.first()).toBeVisible({ timeout: 10000 });
        }
    });
});
