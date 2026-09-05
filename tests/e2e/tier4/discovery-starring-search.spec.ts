import { test, expect } from '@playwright/test';
import { DETECTIVE_ALPHA, DETECTIVE_BETA } from '../helpers/auth';
import {
    getTursoClient,
    seedTestUsers,
    cleanupTestData,
    createTestBoard,
    getTestBoard,
    closeDbClient,
} from '../helpers/db';
import { createApiClient } from '../helpers/api-client';

test.describe('Tier 4.2: Public Board Publishing, Community Discovery, Starring & Scoped Search', () => {
    let publicBoardId: string;
    let privateBoardId: string;
    const clientVance = createApiClient(undefined, DETECTIVE_ALPHA);
    const clientStone = createApiClient(undefined, DETECTIVE_BETA);
    const clientPublic = createApiClient(undefined, null);
    const db = getTursoClient();

    test.beforeAll(async () => {
        await seedTestUsers();

        // Vance creates an initially private case
        publicBoardId = await createTestBoard({
            userId: DETECTIVE_ALPHA.id,
            title: `[E2E-TEST] The Blackwood Manor Mystery ${Date.now()}`,
            isPublic: false,
            content: { nodes: [{ id: 'n1', type: 'sticky', data: { label: 'Clue 1' } }], edges: [] },
        });

        // Vance creates a strictly private secret case
        privateBoardId = await createTestBoard({
            userId: DETECTIVE_ALPHA.id,
            title: `[E2E-TEST] Blackwood Secret Wiretaps ${Date.now()}`,
            isPublic: false,
            content: { nodes: [{ id: 'n2', type: 'sticky', data: { label: 'Audio tape 4' } }], edges: [] },
        });
    });

    test.afterAll(async () => {
        await cleanupTestData();
        await closeDbClient();
    });

    test('Step 1: Case publication transitions board to public status in Turso DB', async () => {
        // Vance publishes the Blackwood Manor board
        const pubRes = await clientVance.put(`/api/boards/${publicBoardId}`, {
            isPublic: true,
        });
        expect(pubRes.status).toBe(200);

        // Verify in DB
        const board = await getTestBoard(publicBoardId);
        expect(board?.is_public).toBe(1);
    });

    test('Step 2: Public Discovery Feed lists published case for unauthenticated detectives', async ({
        page,
    }) => {
        // Public user visits /discover
        await page.goto('/discover');
        await page.waitForLoadState('networkidle');

        // Verify the public board title appears on the discover page
        const cardTitle = page.locator('text=The Blackwood Manor Mystery');
        await expect(cardTitle.first()).toBeVisible({ timeout: 15000 });
    });

    test('Step 3: Board starring counter increments and persists in database', async () => {
        // Star the board directly via DB counter
        await db.execute({
            sql: `UPDATE boards SET stars = stars + 1 WHERE id = ?`,
            args: [publicBoardId],
        });

        const starredBoard = await getTestBoard(publicBoardId);
        expect(Number(starredBoard?.stars)).toBeGreaterThanOrEqual(1);

        // Verify public board fetch includes updated star count
        const boardRes = await clientStone.get<{ id: string; stars?: number }>(
            `/api/boards/${publicBoardId}`
        );
        expect(boardRes.status).toBe(200);
        expect(Number(boardRes.data.stars)).toBeGreaterThanOrEqual(1);
    });

    test('Step 4: Scoped global search partitions public vs private records strictly', async () => {
        // 1. Unauthenticated or third-party search for "Blackwood"
        const publicSearch = await clientPublic.get<{
            boards: Array<{ id: string; title: string; isPublic: boolean }>;
        }>('/api/search', {
            params: { q: 'Blackwood' },
        });

        expect(publicSearch.status).toBe(200);
        const publicResults = publicSearch.data.boards;

        // Must find the public board
        const foundPublic = publicResults.find((b) => b.id === publicBoardId);
        expect(foundPublic).toBeDefined();

        // Must NOT find the private wiretaps board
        const foundPrivate = publicResults.find((b) => b.id === privateBoardId);
        expect(foundPrivate).toBeUndefined();

        // 2. Owner search (Vance) for "Blackwood"
        const ownerSearch = await clientVance.get<{
            boards: Array<{ id: string; title: string }>;
        }>('/api/search', {
            params: { q: 'Blackwood' },
        });

        expect(ownerSearch.status).toBe(200);
        const ownerResults = ownerSearch.data.boards;

        // Owner must see BOTH the public board and their own private board
        expect(ownerResults.find((b) => b.id === publicBoardId)).toBeDefined();
        expect(ownerResults.find((b) => b.id === privateBoardId)).toBeDefined();
    });

    test('Step 5: Soft-deleted boards are excluded from search results and discover feeds', async () => {
        // Vance soft-deletes the public case
        const deleteRes = await clientVance.delete(`/api/boards/${publicBoardId}`);
        expect(deleteRes.status).toBe(200);

        // Verify deletedAt is set in DB
        const deletedRecord = await getTestBoard(publicBoardId);
        expect(deletedRecord?.deleted_at).not.toBeNull();

        // Direct fetch returns 404
        const fetchRes = await clientPublic.get(`/api/boards/${publicBoardId}`);
        expect(fetchRes.status).toBe(404);

        // Search excludes soft-deleted board
        const searchAfterDel = await clientPublic.get<{
            boards: Array<{ id: string }>;
        }>('/api/search', {
            params: { q: 'Blackwood' },
        });
        expect(searchAfterDel.status).toBe(200);
        expect(searchAfterDel.data.boards.find((b) => b.id === publicBoardId)).toBeUndefined();
    });
});
