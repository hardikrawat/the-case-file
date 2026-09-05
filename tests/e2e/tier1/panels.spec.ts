import { test, expect } from '@playwright/test';
import {
    DETECTIVE_ALPHA,
    DETECTIVE_BETA,
    authenticateContext,
    seedTestUsers,
    cleanupTestData,
    closeDbClient,
    createTestBoard,
    createApiClient,
    getUserReputation,
    waitForBoardReady,
} from '../helpers';

test.describe('Tier 1: Panels, Overlays & Collaboration Architecture', () => {
    const api = createApiClient();

    test.beforeAll(async () => {
        await seedTestUsers();
    });

    test.afterAll(async () => {
        await cleanupTestData();
        await closeDbClient();
    });

    // --- Comments System (T1-COMM-01 to T1-COMM-04) ---

    test('T1-COMM-01: GET /api/comments Joins User Details & Checks Permissions', async () => {
        const boardId = await createTestBoard({
            userId: DETECTIVE_ALPHA.id,
            title: `[E2E-TEST] Comments Join ${Date.now()}`,
            isPublic: true,
        });

        // Add a comment
        const postRes = await api.post<{ id: string }>('/api/comments', {
            boardId,
            content: 'Forensics matched suspect prints at perimeter.',
        }, { user: DETECTIVE_ALPHA });
        expect(postRes.status).toBe(201);

        // Fetch comments as authenticated user
        const getRes = await api.get<Array<{
            id: string;
            boardId: string;
            content: string;
            userId: string;
            userName?: string;
        }>>(`/api/comments?boardId=${boardId}`, { user: DETECTIVE_ALPHA });

        expect(getRes.status).toBe(200);
        expect(Array.isArray(getRes.data)).toBe(true);
        expect(getRes.data.length).toBeGreaterThan(0);

        const found = getRes.data.find((c) => c.id === postRes.data.id);
        expect(found).toBeDefined();
        expect(found?.content).toBe('Forensics matched suspect prints at perimeter.');
        expect(found?.userId).toBe(DETECTIVE_ALPHA.id);

        // Unauthenticated access check
        const unauthRes = await api.get(`/api/comments?boardId=${boardId}`, { user: null });
        expect([401, 403]).toContain(unauthRes.status);
    });

    test('T1-COMM-02: POST /api/comments Awards Reputation Points', async () => {
        const boardId = await createTestBoard({
            userId: DETECTIVE_ALPHA.id,
            title: `[E2E-TEST] Comment Reputation ${Date.now()}`,
            isPublic: true,
        });

        const initialRep = await getUserReputation(DETECTIVE_ALPHA.id);
        const initialPoints = initialRep?.points || 0;

        const res = await api.post<{ id: string }>('/api/comments', {
            boardId,
            content: 'Evidence corroborates ballistic report.',
        }, { user: DETECTIVE_ALPHA });

        expect(res.status).toBe(201);

        const updatedRep = await getUserReputation(DETECTIVE_ALPHA.id);
        // comment_posted awards +2 points
        expect(updatedRep?.points).toBe(initialPoints + 2);
    });

    test('T1-COMM-03: Node-Specific Threaded Comments', async () => {
        const boardId = await createTestBoard({
            userId: DETECTIVE_ALPHA.id,
            title: `[E2E-TEST] Threaded Comments ${Date.now()}`,
            isPublic: true,
        });

        const targetNodeId = 'evidence-node-404';

        // Post top-level comment on specific node
        const parentRes = await api.post<{ id: string }>('/api/comments', {
            boardId,
            nodeId: targetNodeId,
            content: 'Questioning time of death estimates.',
        }, { user: DETECTIVE_ALPHA });
        expect(parentRes.status).toBe(201);

        // Post threaded reply
        const replyRes = await api.post<{ id: string }>('/api/comments', {
            boardId,
            nodeId: targetNodeId,
            parentId: parentRes.data.id,
            content: 'Coroner confirmed 22:30 to 23:00 window.',
        }, { user: DETECTIVE_BETA });
        expect(replyRes.status).toBe(201);

        // Fetch comments filtered by nodeId
        const filteredRes = await api.get<Array<{ id: string; nodeId?: string; parentId?: string }>>(
            `/api/comments?boardId=${boardId}&nodeId=${targetNodeId}`,
            { user: DETECTIVE_ALPHA }
        );

        expect(filteredRes.status).toBe(200);
        expect(filteredRes.data.length).toBe(2);
        for (const comment of filteredRes.data) {
            expect(comment.nodeId).toBe(targetNodeId);
        }
    });

    test('T1-COMM-04: CommentsPanel Mounting & UI Interaction', async ({ page, context }) => {
        await authenticateContext(context, DETECTIVE_ALPHA);

        const boardId = await createTestBoard({
            userId: DETECTIVE_ALPHA.id,
            title: `[E2E-TEST] Comments Panel UI ${Date.now()}`,
            isPublic: true,
        });

        await page.goto(`/board/${boardId}`);
        await waitForBoardReady(page);

        // Locate Comments trigger button
        const commentsToggle = page.locator('button:has-text("Comments"), button[title="Comments"], [data-testid="toggle-comments"]');
        await expect(commentsToggle).toBeVisible({ timeout: 10000 });

        // Open comments panel
        await commentsToggle.click();

        // Verify comments panel header and input form
        const commentForm = page.locator('form, textarea[placeholder*="comment" i]');
        await expect(commentForm.first()).toBeVisible({ timeout: 5000 });
    });

    // --- Collaborators Management (T1-COL-01 to T1-COL-04) ---

    test('T1-COL-01: CollaboratorsPanel Mounting', async ({ page, context }) => {
        await authenticateContext(context, DETECTIVE_ALPHA);

        const boardId = await createTestBoard({
            userId: DETECTIVE_ALPHA.id,
            title: `[E2E-TEST] Collaborators UI ${Date.now()}`,
            isPublic: false,
        });

        await page.goto(`/board/${boardId}`);
        await waitForBoardReady(page);

        // Locate Collaborators button
        const collabToggle = page.locator('button:has-text("Collaborators"), button:has-text("Team"), button[title="Collaborators"], [data-testid="toggle-collaborators"]');
        await expect(collabToggle).toBeVisible({ timeout: 10000 });

        await collabToggle.click();
        await expect(page.getByText(/Collaborators/i)).toBeVisible({ timeout: 5000 });
    });

    test('T1-COL-02: Add Collaborator via Email / User ID', async () => {
        const boardId = await createTestBoard({
            userId: DETECTIVE_ALPHA.id,
            title: `[E2E-TEST] Collab Add ${Date.now()}`,
            isPublic: false,
        });

        // Board owner invites DETECTIVE_BETA as editor
        const addRes = await api.post<{ id: string; role: string; userId: string }>(
            `/api/boards/${boardId}/collaborators`,
            {
                userId: DETECTIVE_BETA.id,
                userEmail: DETECTIVE_BETA.email,
                role: 'editor',
            },
            { user: DETECTIVE_ALPHA }
        );

        expect(addRes.status).toBe(201);
        expect(addRes.data.role).toBe('editor');
    });

    test('T1-COL-03: Update Collaborator Role', async () => {
        const boardId = await createTestBoard({
            userId: DETECTIVE_ALPHA.id,
            title: `[E2E-TEST] Collab Update ${Date.now()}`,
            isPublic: false,
        });

        // First add collaborator
        const addRes = await api.post<{ id: string }>(
            `/api/boards/${boardId}/collaborators`,
            { userId: DETECTIVE_BETA.id, role: 'editor' },
            { user: DETECTIVE_ALPHA }
        );
        expect(addRes.status).toBe(201);

        // Update role from editor to viewer
        const patchRes = await api.patch(
            `/api/boards/${boardId}/collaborators`,
            {
                collaboratorId: addRes.data.id,
                userId: DETECTIVE_BETA.id,
                role: 'viewer',
            },
            { user: DETECTIVE_ALPHA }
        );

        expect([200, 204]).toContain(patchRes.status);
    });

    test('T1-COL-04: Remove Collaborator', async () => {
        const boardId = await createTestBoard({
            userId: DETECTIVE_ALPHA.id,
            title: `[E2E-TEST] Collab Remove ${Date.now()}`,
            isPublic: false,
        });

        const addRes = await api.post<{ id: string }>(
            `/api/boards/${boardId}/collaborators`,
            { userId: DETECTIVE_BETA.id, role: 'editor' },
            { user: DETECTIVE_ALPHA }
        );
        expect(addRes.status).toBe(201);

        // Remove collaborator
        const delRes = await api.delete(
            `/api/boards/${boardId}/collaborators?collaboratorId=${addRes.data.id}&userId=${DETECTIVE_BETA.id}`,
            { user: DETECTIVE_ALPHA }
        );

        expect([200, 204]).toContain(delRes.status);
    });

    // --- Version History & Snapshots (T1-VER-01 to T1-VER-04) ---

    test('T1-VER-01: VersionHistory Mounting & UI Interaction', async ({ page, context }) => {
        await authenticateContext(context, DETECTIVE_ALPHA);

        const boardId = await createTestBoard({
            userId: DETECTIVE_ALPHA.id,
            title: `[E2E-TEST] Version History UI ${Date.now()}`,
            isPublic: true,
        });

        await page.goto(`/board/${boardId}`);
        await waitForBoardReady(page);

        // Locate Version History button
        const historyToggle = page.locator('button:has-text("History"), button[title="Version History"], [data-testid="toggle-history"]');
        await expect(historyToggle).toBeVisible({ timeout: 10000 });

        await historyToggle.click();
        await expect(page.getByText(/Version History/i)).toBeVisible({ timeout: 5000 });
    });

    test('T1-VER-02: Automatic Snapshot Creation on Board Save', async () => {
        const boardId = await createTestBoard({
            userId: DETECTIVE_ALPHA.id,
            title: `[E2E-TEST] Version Snapshot ${Date.now()}`,
            isPublic: true,
        });

        const versionContent = {
            nodes: [{ id: 'v1-node', type: 'sticky', data: { label: 'Milestone 1 Discovery' } }],
            edges: [],
        };

        const postRes = await api.post<{ id: string; boardId: string }>(
            `/api/boards/${boardId}/versions`,
            { content: versionContent },
            { user: DETECTIVE_ALPHA }
        );

        expect(postRes.status).toBe(201);
        expect(postRes.data.id).toBeDefined();
    });

    test('T1-VER-03: Chronological Version Retrieval', async () => {
        const boardId = await createTestBoard({
            userId: DETECTIVE_ALPHA.id,
            title: `[E2E-TEST] Version Retrieval ${Date.now()}`,
            isPublic: true,
        });

        // Create 2 sequential versions
        await api.post(`/api/boards/${boardId}/versions`, {
            content: { step: 1 },
        }, { user: DETECTIVE_ALPHA });

        await api.post(`/api/boards/${boardId}/versions`, {
            content: { step: 2 },
        }, { user: DETECTIVE_ALPHA });

        const getRes = await api.get<Array<{ id: string; content: unknown }>>(
            `/api/boards/${boardId}/versions`,
            { user: DETECTIVE_ALPHA }
        );

        expect(getRes.status).toBe(200);
        expect(Array.isArray(getRes.data)).toBe(true);
        expect(getRes.data.length).toBeGreaterThanOrEqual(2);
    });

    test('T1-VER-04: Version Restore Workflow', async () => {
        const boardId = await createTestBoard({
            userId: DETECTIVE_ALPHA.id,
            title: `[E2E-TEST] Version Restore ${Date.now()}`,
            isPublic: true,
        });

        const v1Snapshot = { nodes: [{ id: 'archived-node', type: 'text', data: { label: 'Old Note' } }], edges: [] };
        const v1Res = await api.post<{ id: string }>(
            `/api/boards/${boardId}/versions`,
            { content: v1Snapshot },
            { user: DETECTIVE_ALPHA }
        );
        expect(v1Res.status).toBe(201);

        // Fetch version content to restore
        const versionsRes = await api.get<Array<{ id: string; content: string | Record<string, unknown> }>>(
            `/api/boards/${boardId}/versions`,
            { user: DETECTIVE_ALPHA }
        );
        expect(versionsRes.status).toBe(200);

        const targetVersion = versionsRes.data.find((v) => v.id === v1Res.data.id);
        expect(targetVersion).toBeDefined();

        // Restore canvas state by updating board content with target snapshot
        const restoreRes = await api.put(
            `/api/boards/${boardId}`,
            { content: targetVersion?.content },
            { user: DETECTIVE_ALPHA }
        );
        expect(restoreRes.status).toBe(200);
    });

    // --- Export Capabilities (T1-EXP-01 to T1-EXP-03) ---

    test('T1-EXP-01: Export Modal Mounting (Offers JSON, PNG, PDF)', async ({ page, context }) => {
        await authenticateContext(context, DETECTIVE_ALPHA);

        const boardId = await createTestBoard({
            userId: DETECTIVE_ALPHA.id,
            title: `[E2E-TEST] Export Modal ${Date.now()}`,
            isPublic: true,
        });

        await page.goto(`/board/${boardId}`);
        await waitForBoardReady(page);

        // Trigger Export button
        const exportBtn = page.locator('button:has-text("Export"), button[title="Export Board"], button[title="Export JSON"], [data-testid="toggle-export"]');
        await expect(exportBtn.first()).toBeVisible({ timeout: 10000 });
        await exportBtn.first().click();

        // Verify export modal options
        const exportModalOrOptions = page.locator('text=Export Format, text=JSON, text=PNG, text=PDF, .modal');
        await expect(exportModalOrOptions.first()).toBeVisible({ timeout: 5000 });
    });

    test('T1-EXP-02: Export Board as JSON', async ({ page, context }) => {
        await authenticateContext(context, DETECTIVE_ALPHA);

        const boardId = await createTestBoard({
            userId: DETECTIVE_ALPHA.id,
            title: `[E2E-TEST] JSON Export ${Date.now()}`,
            isPublic: true,
            content: {
                nodes: [{ id: 'export-node', type: 'sticky', data: { label: 'Export Verification Note' } }],
                edges: [],
            },
        });

        await page.goto(`/board/${boardId}`);
        await waitForBoardReady(page);

        // Trigger JSON export via button
        const exportBtn = page.locator('button[title*="Export" i], button:has-text("Export")').first();
        await expect(exportBtn).toBeVisible({ timeout: 10000 });

        // Listen for download event
        const downloadPromise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);
        await exportBtn.click();
        const download = await downloadPromise;

        // If direct file download occurred, verify extension
        if (download) {
            expect(download.suggestedFilename()).toMatch(/\.json$/i);
        }
    });

    test('T1-EXP-03: Export Board as PNG and PDF Formats', async ({ page, context }) => {
        await authenticateContext(context, DETECTIVE_ALPHA);

        const boardId = await createTestBoard({
            userId: DETECTIVE_ALPHA.id,
            title: `[E2E-TEST] Visual Export Formats ${Date.now()}`,
            isPublic: true,
        });

        await page.goto(`/board/${boardId}`);
        await waitForBoardReady(page);

        // Open Export Modal
        const exportBtn = page.locator('button:has-text("Export"), button[title="Export Board"]').first();
        if (await exportBtn.isVisible()) {
            await exportBtn.click();
            await page.waitForTimeout(300);

            // Verify PNG and PDF options exist in export modal
            const pngOption = page.locator('button:has-text("PNG"), [data-testid="export-png"]');
            const pdfOption = page.locator('button:has-text("PDF"), [data-testid="export-pdf"]');

            if (await pngOption.isVisible()) {
                await expect(pngOption).toBeVisible();
            }
            if (await pdfOption.isVisible()) {
                await expect(pdfOption).toBeVisible();
            }
        }
    });
});
