import { test, expect } from '@playwright/test';
import {
    DETECTIVE_ALPHA,
    DETECTIVE_BETA,
    DETECTIVE_GAMMA,
    type TestUserPersona,
    authenticateContext,
} from '../helpers/auth';
import {
    seedTestUsers,
    cleanupTestData,
    createTestBoard,
    closeDbClient,
} from '../helpers/db';
import { createApiClient } from '../helpers/api-client';

const DETECTIVE_INTRUDER: TestUserPersona = {
    id: 'e2e-user-intruder',
    email: 'intruder@testcasefile.dev',
    name: 'Detective Intruder',
    password: 'IntruderPass123!',
};

test.describe('Tier 3.3: Collaborator Invitation, Role Management & Granular RBAC', () => {
    let privateBoardId: string;
    const clientOwner = createApiClient(undefined, DETECTIVE_ALPHA);
    const clientEditor = createApiClient(undefined, DETECTIVE_BETA);
    const clientViewer = createApiClient(undefined, DETECTIVE_GAMMA);
    const clientIntruder = createApiClient(undefined, DETECTIVE_INTRUDER);
    const clientUnauthenticated = createApiClient(undefined, null);

    test.beforeAll(async () => {
        await seedTestUsers();

        // Create a strictly private board owned by Detective Alpha
        privateBoardId = await createTestBoard({
            userId: DETECTIVE_ALPHA.id,
            title: `[E2E-TEST] Classified Internal Affairs Dossier ${Date.now()}`,
            isPublic: false,
            content: {
                nodes: [
                    {
                        id: 'node-sec-1',
                        type: 'sticky',
                        data: { label: 'Classified informant testimony' },
                    },
                ],
                edges: [],
            },
        });
    });

    test.afterAll(async () => {
        await cleanupTestData();
        await closeDbClient();
    });

    test('Owner invites Editor and Viewer via POST /api/boards/[id]/collaborators', async () => {
        // Owner adds Beta as Editor
        const addEditorRes = await clientOwner.post(`/api/boards/${privateBoardId}/collaborators`, {
            userId: DETECTIVE_BETA.id,
            role: 'editor',
        });
        expect(addEditorRes.status).toBe(201);

        // Owner adds Gamma as Viewer
        const addViewerRes = await clientOwner.post(`/api/boards/${privateBoardId}/collaborators`, {
            userId: DETECTIVE_GAMMA.id,
            role: 'viewer',
        });
        expect(addViewerRes.status).toBe(201);

        // Duplicate collaborator rejection
        const dupRes = await clientOwner.post(`/api/boards/${privateBoardId}/collaborators`, {
            userId: DETECTIVE_BETA.id,
            role: 'editor',
        });
        expect(dupRes.status).toBe(400);
    });

    test('Non-Owner cannot add collaborators (403 Forbidden)', async () => {
        // Editor attempts to add collaborator
        const editorAddRes = await clientEditor.post(`/api/boards/${privateBoardId}/collaborators`, {
            userId: DETECTIVE_INTRUDER.id,
            role: 'viewer',
        });
        expect(editorAddRes.status).toBe(403);

        // Viewer attempts to add collaborator
        const viewerAddRes = await clientViewer.post(`/api/boards/${privateBoardId}/collaborators`, {
            userId: DETECTIVE_INTRUDER.id,
            role: 'viewer',
        });
        expect(viewerAddRes.status).toBe(403);

        // Intruder attempts to add collaborator
        const intruderAddRes = await clientIntruder.post(`/api/boards/${privateBoardId}/collaborators`, {
            userId: DETECTIVE_INTRUDER.id,
            role: 'viewer',
        });
        expect(intruderAddRes.status).toBe(403);
    });

    test('Read Access Matrix on Private Board (GET /api/boards/[id])', async () => {
        // 1. Owner can read
        const ownerRes = await clientOwner.get(`/api/boards/${privateBoardId}`);
        expect(ownerRes.status).toBe(200);

        // 2. Editor can read
        const editorRes = await clientEditor.get(`/api/boards/${privateBoardId}`);
        expect(editorRes.status).toBe(200);

        // 3. Viewer can read
        const viewerRes = await clientViewer.get(`/api/boards/${privateBoardId}`);
        expect(viewerRes.status).toBe(200);

        // 4. Non-collaborator Intruder receives 403
        const intruderRes = await clientIntruder.get(`/api/boards/${privateBoardId}`);
        expect(intruderRes.status).toBe(403);

        // 5. Unauthenticated caller receives 401
        const unauthRes = await clientUnauthenticated.get(`/api/boards/${privateBoardId}`);
        expect(unauthRes.status).toBe(401);
    });

    test('Edit Access Matrix (PUT /api/boards/[id])', async () => {
        const updatePayload = {
            content: {
                nodes: [
                    {
                        id: 'node-sec-1',
                        type: 'sticky',
                        data: { label: 'Classified informant testimony (updated)' },
                    },
                ],
                edges: [],
            },
        };

        // 1. Editor can edit
        const editorEditRes = await clientEditor.put(`/api/boards/${privateBoardId}`, updatePayload);
        expect(editorEditRes.status).toBe(200);

        // 2. Owner can edit
        const ownerEditRes = await clientOwner.put(`/api/boards/${privateBoardId}`, updatePayload);
        expect(ownerEditRes.status).toBe(200);

        // 3. Viewer receives 403
        const viewerEditRes = await clientViewer.put(`/api/boards/${privateBoardId}`, updatePayload);
        expect(viewerEditRes.status).toBe(403);

        // 4. Intruder receives 403
        const intruderEditRes = await clientIntruder.put(`/api/boards/${privateBoardId}`, updatePayload);
        expect(intruderEditRes.status).toBe(403);

        // 5. Unauthenticated receives 401
        const unauthEditRes = await clientUnauthenticated.put(`/api/boards/${privateBoardId}`, updatePayload);
        expect(unauthEditRes.status).toBe(401);
    });

    test('Version Snapshot Creation Matrix (POST /api/boards/[id]/versions)', async () => {
        const versionPayload = {
            content: {
                nodes: [{ id: 'n1', type: 'sticky', data: { label: 'Snapshot test' } }],
                edges: [],
            },
        };

        // 1. Owner can create version
        const ownerVerRes = await clientOwner.post(`/api/boards/${privateBoardId}/versions`, versionPayload);
        expect(ownerVerRes.status).toBe(201);

        // 2. Editor can create version
        const editorVerRes = await clientEditor.post(`/api/boards/${privateBoardId}/versions`, versionPayload);
        expect(editorVerRes.status).toBe(201);

        // 3. Viewer cannot create version (403)
        const viewerVerRes = await clientViewer.post(`/api/boards/${privateBoardId}/versions`, versionPayload);
        expect(viewerVerRes.status).toBe(403);

        // 4. Intruder cannot create version (403)
        const intruderVerRes = await clientIntruder.post(`/api/boards/${privateBoardId}/versions`, versionPayload);
        expect(intruderVerRes.status).toBe(403);

        // 5. Unauthenticated receives 401
        const unauthVerRes = await clientUnauthenticated.post(`/api/boards/${privateBoardId}/versions`, versionPayload);
        expect(unauthVerRes.status).toBe(401);
    });

    test('Delete Board Matrix: Only Owner can delete (DELETE /api/boards/[id])', async () => {
        // 1. Viewer cannot delete
        const viewerDelRes = await clientViewer.delete(`/api/boards/${privateBoardId}`);
        expect(viewerDelRes.status).toBe(403);

        // 2. Editor cannot delete
        const editorDelRes = await clientEditor.delete(`/api/boards/${privateBoardId}`);
        expect(editorDelRes.status).toBe(403);

        // 3. Intruder cannot delete
        const intruderDelRes = await clientIntruder.delete(`/api/boards/${privateBoardId}`);
        expect(intruderDelRes.status).toBe(403);

        // 4. Unauthenticated cannot delete
        const unauthDelRes = await clientUnauthenticated.delete(`/api/boards/${privateBoardId}`);
        expect(unauthDelRes.status).toBe(401);
    });

    test('Viewer UI correctly restricts editing controls on canvas', async ({ page, context }) => {
        await authenticateContext(context, DETECTIVE_GAMMA);
        await page.goto(`/board/${privateBoardId}`);
        await page.waitForSelector('.react-flow', { state: 'visible', timeout: 20000 });

        // Save button should not be available or enabled for viewer
        const saveBtn = page.locator('button:has-text("Save")');
        await expect(saveBtn).toBeHidden();
    });
});
