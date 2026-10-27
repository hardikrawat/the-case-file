import { createClient, type Client } from '@libsql/client';
import bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
import { DETECTIVE_ALPHA, DETECTIVE_BETA, DETECTIVE_GAMMA, TEST_PERSONAS } from './auth';

// Ensure environment variables are loaded
dotenv.config({ path: '.env.local' });
dotenv.config();

let clientInstance: Client | null = null;

/**
 * Returns a direct LibSQL client connected to cloud Turso DB.
 * Fails fast if credentials are not found.
 */
export function getTursoClient(): Client {
    if (clientInstance) {
        return clientInstance;
    }

    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;

    if (!url) {
        throw new Error('Fatal: TURSO_DATABASE_URL is required for E2E test database connection.');
    }

    if (url.startsWith('libsql://') && !authToken) {
        throw new Error('Fatal: TURSO_AUTH_TOKEN is required when connecting to remote Turso DB.');
    }

    clientInstance = createClient({
        url,
        authToken,
    });

    return clientInstance;
}

/**
 * Close database client connection
 */
export async function closeDbClient(): Promise<void> {
    if (clientInstance) {
        clientInstance.close();
        clientInstance = null;
    }
}

/**
 * Seeds standard persistent test detective personas into cloud Turso DB.
 * Idempotently inserts or updates records in both `users` and `user_reputation` tables.
 */
export async function seedTestUsers(): Promise<void> {
    const db = getTursoClient();

    for (const persona of TEST_PERSONAS) {
        const passwordHash = await bcrypt.hash(persona.password, 10);

        // Check if user exists by ID or email
        const existing = await db.execute({
            sql: 'SELECT id, email FROM users WHERE id = ? OR email = ? LIMIT 1',
            args: [persona.id, persona.email],
        });

        if (existing.rows.length > 0) {
            // Update existing test user to ensure verified flag and credentials match
            await db.execute({
                sql: `UPDATE users 
                      SET name = ?, email = ?, password_hash = ?, email_verified_flag = 1 
                      WHERE id = ? OR email = ?`,
                args: [persona.name, persona.email, passwordHash, persona.id, persona.email],
            });
        } else {
            // Insert new test user
            await db.execute({
                sql: `INSERT INTO users (id, name, email, password_hash, email_verified_flag) 
                      VALUES (?, ?, ?, ?, 1)`,
                args: [persona.id, persona.name, persona.email, passwordHash],
            });
        }

        // Ensure user_reputation entry exists
        const rep = await db.execute({
            sql: 'SELECT user_id FROM user_reputation WHERE user_id = ? LIMIT 1',
            args: [persona.id],
        });

        if (rep.rows.length === 0) {
            await db.execute({
                sql: `INSERT INTO user_reputation (user_id, points, boards_created, contributions_accepted) 
                      VALUES (?, 0, 0, 0)`,
                args: [persona.id],
            });
        }
    }
}

/**
 * Safely cleans test data generated during E2E test runs.
 * ONLY removes rows with test prefixes or created by test detective personas.
 * NEVER deletes or alters non-test production data.
 */
export async function cleanupTestData(): Promise<void> {
    const db = getTursoClient();
    const testUserIds = [DETECTIVE_ALPHA.id, DETECTIVE_BETA.id, DETECTIVE_GAMMA.id];

    // 1. Locate all test boards created during tests
    const testBoards = await db.execute({
        sql: `SELECT id FROM boards 
              WHERE id LIKE 'e2e_%' 
                 OR id LIKE 'test_%' 
                 OR title LIKE '%[E2E-TEST]%' 
                 OR title LIKE 'E2E %' 
                 OR userId IN (?, ?, ?)`,
        args: testUserIds,
    });

    const boardIds = testBoards.rows.map((r) => String(r.id));

    if (boardIds.length > 0) {
        // Build SQL IN clause safely
        const placeholders = boardIds.map(() => '?').join(',');

        // Cascading deletion of board-linked artifacts
        await db.execute({
            sql: `DELETE FROM comments WHERE board_id IN (${placeholders})`,
            args: boardIds,
        });

        await db.execute({
            sql: `DELETE FROM board_collaborators WHERE board_id IN (${placeholders})`,
            args: boardIds,
        });

        await db.execute({
            sql: `DELETE FROM board_versions WHERE board_id IN (${placeholders})`,
            args: boardIds,
        });

        await db.execute({
            sql: `DELETE FROM contributions WHERE boardId IN (${placeholders})`,
            args: boardIds,
        });

        await db.execute({
            sql: `DELETE FROM boards WHERE id IN (${placeholders})`,
            args: boardIds,
        });
    }

    // 2. Clean orphaned test comments and contributions created by test users
    await db.execute({
        sql: `DELETE FROM comments WHERE user_id IN (?, ?, ?)`,
        args: testUserIds,
    });

    await db.execute({
        sql: `DELETE FROM contributions WHERE userId IN (?, ?, ?)`,
        args: testUserIds,
    });

    await db.execute({
        sql: `DELETE FROM notifications WHERE recipient_id IN (?, ?, ?) OR actor_id IN (?, ?, ?)`,
        args: [...testUserIds, ...testUserIds],
    });

    // 3. Reset reputation stats for standard test personas to clean baseline
    await db.execute({
        sql: `UPDATE user_reputation 
              SET points = 0, boards_created = 0, contributions_accepted = 0 
              WHERE user_id IN (?, ?, ?)`,
        args: testUserIds,
    });

    // 4. Delete ephemeral users created in specific tests (e.g. @test-ephemeral.com)
    await db.execute({
        sql: `DELETE FROM users WHERE email LIKE '%@test-ephemeral.com' OR email LIKE '%@test-temp.com'`,
        args: [],
    });
}

export interface CreateBoardOptions {
    id?: string;
    userId: string;
    title: string;
    isPublic?: boolean;
    content?: Record<string, unknown>;
    parentId?: string | null;
    version?: number;
}

/**
 * Creates a test board directly in Turso DB with the 'e2e_' prefix.
 */
export async function createTestBoard(options: CreateBoardOptions): Promise<string> {
    const db = getTursoClient();
    const boardId = options.id || `e2e_board_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const isPublic = options.isPublic ? 1 : 0;
    const contentStr = JSON.stringify(options.content || { nodes: [], edges: [] });
    const parentId = options.parentId || null;
    const version = options.version ?? 1;

    await db.execute({
        sql: `INSERT INTO boards (id, userId, title, is_public, content, parentId, version) 
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [boardId, options.userId, options.title, isPublic, contentStr, parentId, version],
    });

    // Track board creation in user_reputation
    await db.execute({
        sql: `UPDATE user_reputation 
              SET boards_created = boards_created + 1 
              WHERE user_id = ?`,
        args: [options.userId],
    });

    return boardId;
}

export interface TestBoardRecord {
    id: string;
    userId: string;
    title: string;
    is_public: number;
    content: {
        nodes: unknown[];
        edges: unknown[];
        [key: string]: unknown;
    };
    parentId: string | null;
    version: number;
    deleted_at: number | null;
    created_at?: number;
    updated_at?: number;
    [key: string]: unknown;
}

/**
 * Fetches a board record by ID directly from Turso DB.
 */
export async function getTestBoard(boardId: string): Promise<TestBoardRecord | null> {
    const db = getTursoClient();
    const res = await db.execute({
        sql: `SELECT * FROM boards WHERE id = ? LIMIT 1`,
        args: [boardId],
    });

    if (res.rows.length === 0) return null;
    const row = res.rows[0] as unknown as Record<string, unknown>;
    return {
        ...row,
        id: String(row.id),
        userId: String(row.userId),
        title: String(row.title),
        is_public: Number(row.is_public),
        parentId: row.parentId ? String(row.parentId) : null,
        version: Number(row.version || 1),
        deleted_at: row.deleted_at ? Number(row.deleted_at) : null,
        content: typeof row.content === 'string' ? JSON.parse(row.content) : (row.content as Record<string, unknown>),
    };
}

/**
 * Fetches user reputation details directly from Turso DB.
 */
export async function getUserReputation(userId: string) {
    const db = getTursoClient();
    const res = await db.execute({
        sql: `SELECT points, boards_created, contributions_accepted FROM user_reputation WHERE user_id = ? LIMIT 1`,
        args: [userId],
    });

    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
        points: Number(row.points || 0),
        boardsCreated: Number(row.boards_created || 0),
        contributionsAccepted: Number(row.contributions_accepted || 0),
    };
}
