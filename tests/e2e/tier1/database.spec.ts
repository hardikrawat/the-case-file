import { test, expect } from '@playwright/test';
import {
    DETECTIVE_ALPHA,
    DETECTIVE_BETA,
    seedTestUsers,
    cleanupTestData,
    closeDbClient,
    getTursoClient,
    createTestBoard,
    createApiClient,
} from '../helpers';

test.describe('Tier 1: Turso DB Cloud Persistence & Schema Integrity', () => {
    const api = createApiClient();

    test.beforeAll(async () => {
        await seedTestUsers();
    });

    test.afterAll(async () => {
        await cleanupTestData();
        await closeDbClient();
    });

    test('T1-DB-01: Fail-Fast Remote Database Connection', async () => {
        const url = process.env.TURSO_DATABASE_URL;
        const authToken = process.env.TURSO_AUTH_TOKEN;

        // Verify environment variables are configured for remote cloud Turso DB
        expect(url).toBeDefined();
        expect(url).not.toBe('');
        expect(url).not.toBe(':memory:');
        expect(url?.startsWith('libsql://') || url?.startsWith('https://')).toBe(true);

        if (url?.startsWith('libsql://')) {
            expect(authToken).toBeDefined();
            expect(authToken?.length).toBeGreaterThan(20);
        }

        // Live connection verification: execute real query against remote Turso instance
        const db = getTursoClient();
        const res = await db.execute('SELECT 1 as connected');
        expect(res.rows.length).toBe(1);
        expect(Number(res.rows[0].connected)).toBe(1);
    });

    test('T1-DB-02: Cloud Table Schema & Constraint Verification', async () => {
        const db = getTursoClient();

        // Query all tables from SQLite metadata
        const tablesRes = await db.execute(
            `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;`
        );
        const tableNames = tablesRes.rows.map((r) => String(r.name));

        // Required schema tables
        const requiredTables = [
            'users',
            'accounts',
            'sessions',
            'boards',
            'contributions',
            'comments',
            'board_versions',
            'board_collaborators',
            'user_reputation',
            'rate_limits',
        ];

        for (const tableName of requiredTables) {
            expect(tableNames, `Table ${tableName} must exist in Turso DB`).toContain(tableName);
        }

        // Verify columns and constraints on boards table
        const boardColsRes = await db.execute(`PRAGMA table_info(boards);`);
        const colNames = boardColsRes.rows.map((r) => String(r.name));
        expect(colNames).toContain('id');
        expect(colNames).toContain('userId');
        expect(colNames).toContain('title');
        expect(colNames).toContain('is_public');
        expect(colNames).toContain('content');
        expect(colNames).toContain('deleted_at');
        expect(colNames).toContain('version');
    });

    test('T1-DB-03: Soft-Delete Support in DELETE /api/boards/[id]', async () => {
        // Create test board owned by DETECTIVE_ALPHA
        const boardId = await createTestBoard({
            userId: DETECTIVE_ALPHA.id,
            title: `[E2E-TEST] Board for Soft-Delete ${Date.now()}`,
            isPublic: false,
        });

        // Perform DELETE request via API client
        const delRes = await api.delete<{ success: boolean; message?: string }>(
            `/api/boards/${boardId}`,
            { user: DETECTIVE_ALPHA }
        );

        expect(delRes.status).toBe(200);

        // Verification in database: record STILL exists, but deleted_at is set
        const db = getTursoClient();
        const res = await db.execute({
            sql: 'SELECT id, deleted_at FROM boards WHERE id = ? LIMIT 1',
            args: [boardId],
        });

        expect(res.rows.length).toBe(1);
        expect(res.rows[0].deleted_at).not.toBeNull();
    });

    test('T1-DB-04: Soft-Deleted Boards Excluded from User List Queries', async () => {
        // Create 2 test boards for DETECTIVE_BETA: one active, one to be soft-deleted
        const activeBoardId = await createTestBoard({
            userId: DETECTIVE_BETA.id,
            title: `[E2E-TEST] Active Board ${Date.now()}`,
            isPublic: false,
        });

        const deletedBoardId = await createTestBoard({
            userId: DETECTIVE_BETA.id,
            title: `[E2E-TEST] Deleted Board ${Date.now()}`,
            isPublic: false,
        });

        // Soft delete the second board
        await api.delete(`/api/boards/${deletedBoardId}`, { user: DETECTIVE_BETA });

        // Query user boards list via API
        const listRes = await api.get<Array<{ id: string; title: string }>>(
            '/api/boards',
            { user: DETECTIVE_BETA }
        );

        expect(listRes.status).toBe(200);
        expect(Array.isArray(listRes.data)).toBe(true);

        const fetchedIds = listRes.data.map((b) => b.id);
        expect(fetchedIds).toContain(activeBoardId);
        expect(fetchedIds).not.toContain(deletedBoardId);
    });

    test('T1-DB-05: Soft-Deleted Boards Inaccessible Directly', async () => {
        const boardId = await createTestBoard({
            userId: DETECTIVE_ALPHA.id,
            title: `[E2E-TEST] Direct Access Probe ${Date.now()}`,
            isPublic: true,
        });

        // Soft-delete the board
        await api.delete(`/api/boards/${boardId}`, { user: DETECTIVE_ALPHA });

        // Attempting to GET soft-deleted board directly returns 404
        const getRes = await api.get(`/api/boards/${boardId}`, { user: DETECTIVE_ALPHA });
        expect(getRes.status).toBe(404);

        // Attempting to PUT soft-deleted board returns 404
        const putRes = await api.put(
            `/api/boards/${boardId}`,
            { content: { nodes: [], edges: [] } },
            { user: DETECTIVE_ALPHA }
        );
        expect(putRes.status).toBe(404);
    });
});
