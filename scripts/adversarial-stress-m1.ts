import { execSync } from 'child_process';
import * as dotenv from 'dotenv';
import { eq, sql } from 'drizzle-orm';

dotenv.config({ path: '.env.local' });

async function runFailFastTests() {
    console.log('====================================================');
    console.log('PART 1: EMPIRICAL FAIL-FAST BEHAVIOR STRESS TESTS');
    console.log('====================================================\n');

    const testCases = [
        {
            name: 'TURSO_DATABASE_URL is undefined (unset)',
            env: { ...process.env, TURSO_DATABASE_URL: undefined, TURSO_AUTH_TOKEN: undefined },
            deleteKeys: ['TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN'],
            expectedError: '[CRITICAL] TURSO_DATABASE_URL is missing. In-memory SQLite fallback (:memory:) is strictly prohibited.'
        },
        {
            name: 'TURSO_DATABASE_URL is empty string ("")',
            env: { ...process.env, TURSO_DATABASE_URL: '', TURSO_AUTH_TOKEN: '' },
            expectedError: '[CRITICAL] TURSO_DATABASE_URL is missing. In-memory SQLite fallback (:memory:) is strictly prohibited.'
        },
        {
            name: 'TURSO_DATABASE_URL is ":memory:"',
            env: { ...process.env, TURSO_DATABASE_URL: ':memory:', TURSO_AUTH_TOKEN: '' },
            expectedError: '[CRITICAL] In-memory SQLite database (:memory:) is strictly prohibited.'
        },
        {
            name: 'TURSO_DATABASE_URL is whitespace ("   ")',
            env: { ...process.env, TURSO_DATABASE_URL: '   ', TURSO_AUTH_TOKEN: '' },
            expectedError: '[CRITICAL] TURSO_DATABASE_URL is missing. In-memory SQLite fallback (:memory:) is strictly prohibited.'
        },
        {
            name: 'TURSO_DATABASE_URL="libsql://something" & TURSO_AUTH_TOKEN unset',
            env: { ...process.env, TURSO_DATABASE_URL: 'libsql://something', TURSO_AUTH_TOKEN: undefined },
            deleteKeys: ['TURSO_AUTH_TOKEN'],
            expectedError: '[CRITICAL] TURSO_AUTH_TOKEN is required to connect to remote Turso DB at libsql://something.'
        },
        {
            name: 'TURSO_DATABASE_URL="libsql://something" & TURSO_AUTH_TOKEN=""',
            env: { ...process.env, TURSO_DATABASE_URL: 'libsql://something', TURSO_AUTH_TOKEN: '' },
            expectedError: '[CRITICAL] TURSO_AUTH_TOKEN is required to connect to remote Turso DB at libsql://something.'
        },
        {
            name: 'TURSO_DATABASE_URL="libsql://something" & TURSO_AUTH_TOKEN="   "',
            env: { ...process.env, TURSO_DATABASE_URL: 'libsql://something', TURSO_AUTH_TOKEN: '   ' },
            expectedError: '[CRITICAL] TURSO_AUTH_TOKEN is required to connect to remote Turso DB at libsql://something.'
        },
        {
            name: 'TURSO_DATABASE_URL="https://something" & TURSO_AUTH_TOKEN=""',
            env: { ...process.env, TURSO_DATABASE_URL: 'https://something', TURSO_AUTH_TOKEN: '' },
            expectedError: '[CRITICAL] TURSO_AUTH_TOKEN is required to connect to remote Turso DB at https://something.'
        },
        {
            name: 'TURSO_DATABASE_URL="wss://something" & TURSO_AUTH_TOKEN=""',
            env: { ...process.env, TURSO_DATABASE_URL: 'wss://something', TURSO_AUTH_TOKEN: '' },
            expectedError: '[CRITICAL] TURSO_AUTH_TOKEN is required to connect to remote Turso DB at wss://something.'
        }
    ];

    let passedFailFast = 0;
    let failedFailFast = 0;

    for (const tc of testCases) {
        process.stdout.write(`Testing: ${tc.name} ... `);
        const spawnEnv: Record<string, string | undefined> = { ...process.env, ...tc.env };
        if (tc.deleteKeys) {
            for (const k of tc.deleteKeys) {
                delete spawnEnv[k];
            }
        }

        try {
            execSync('npx tsx -e "import(\'./src/lib/db\')"', {
                env: spawnEnv as NodeJS.ProcessEnv,
                stdio: ['pipe', 'pipe', 'pipe']
            });
            console.log('❌ FAILED (Command unexpectedly succeeded without error!)');
            failedFailFast++;
        } catch (err: any) {
            const stderr = err.stderr ? err.stderr.toString() : '';
            const stdout = err.stdout ? err.stdout.toString() : '';
            const combinedOutput = stdout + '\n' + stderr;

            if (combinedOutput.includes(tc.expectedError)) {
                console.log('✅ PASSED (Fatal error thrown as expected)');
                passedFailFast++;
            } else {
                console.log('❌ FAILED (Unexpected error output)');
                console.log('  Expected to contain:', tc.expectedError);
                console.log('  Actual output:', combinedOutput);
                failedFailFast++;
            }
        }
    }

    console.log(`\nFail-Fast Summary: ${passedFailFast}/${testCases.length} passed, ${failedFailFast} failed.\n`);
    return { passedFailFast, failedFailFast, total: testCases.length };
}

async function runLiveDbConstraintTests() {
    console.log('====================================================');
    console.log('PART 2: EMPIRICAL LIVE TURSO DB CONSTRAINT TESTS');
    console.log('====================================================\n');

    // Dynamic import to ensure .env.local has already been loaded into process.env
    const { db } = await import('../src/lib/db');
    const { users, boards, boardCollaborators, comments } = await import('../src/lib/schema');

    // Fetch an existing user for foreign keys
    const existingUsers = await db.select().from(users).limit(2);
    if (existingUsers.length < 2) {
        throw new Error('Need at least 2 users in DB to perform constraint tests.');
    }
    const testUser1 = existingUsers[0];
    const testUser2 = existingUsers[1];

    console.log(`Using Test User 1: ${testUser1.id} (${testUser1.email})`);
    console.log(`Using Test User 2: ${testUser2.id} (${testUser2.email})\n`);

    const timestamp = Date.now();
    const testBoardId = `test_challenger_board_${timestamp}`;
    const testComment1Id = `test_challenger_c1_${timestamp}`;
    const testComment2Id = `test_challenger_c2_${timestamp}`;
    const testCollab1Id = `test_challenger_collab1_${timestamp}`;
    const testCollab2Id = `test_challenger_collab2_${timestamp}`;

    let passedConstraints = 0;
    let failedConstraints = 0;

    try {
        // --- 2.1 Test boards.version default and increment behavior ---
        console.log('--- Test 2.1: boards.version default value and increment behavior ---');
        console.log(`Creating test board ${testBoardId} without specifying version...`);
        await db.insert(boards).values({
            id: testBoardId,
            userId: testUser1.id,
            title: `Challenger Board ${timestamp}`,
            isPublic: false
        });

        const [createdBoard] = await db.select().from(boards).where(eq(boards.id, testBoardId));
        console.log(`Default board.version: ${createdBoard.version} (type: ${typeof createdBoard.version})`);

        if (createdBoard.version === 1) {
            console.log('✅ Default boards.version === 1 verified.');
            passedConstraints++;
        } else {
            console.log(`❌ Default boards.version expected 1, got ${createdBoard.version}`);
            failedConstraints++;
        }

        console.log('Incrementing board.version by 1...');
        await db
            .update(boards)
            .set({ version: sql`${boards.version} + 1` })
            .where(eq(boards.id, testBoardId));

        const [updatedBoard1] = await db.select().from(boards).where(eq(boards.id, testBoardId));
        console.log(`Incremented board.version: ${updatedBoard1.version}`);

        if (updatedBoard1.version === 2) {
            console.log('✅ Incremented boards.version === 2 verified.');
            passedConstraints++;
        } else {
            console.log(`❌ Incremented boards.version expected 2, got ${updatedBoard1.version}`);
            failedConstraints++;
        }

        console.log('Incrementing board.version again...');
        await db
            .update(boards)
            .set({ version: sql`${boards.version} + 1` })
            .where(eq(boards.id, testBoardId));

        const [updatedBoard2] = await db.select().from(boards).where(eq(boards.id, testBoardId));
        console.log(`Second increment board.version: ${updatedBoard2.version}`);

        if (updatedBoard2.version === 3) {
            console.log('✅ Second increment boards.version === 3 verified.');
            passedConstraints++;
        } else {
            console.log(`❌ Second increment boards.version expected 3, got ${updatedBoard2.version}`);
            failedConstraints++;
        }

        // --- 2.2 Test boardCollaborators unique index enforcement ---
        console.log('\n--- Test 2.2: boardCollaborators unique index (boardId, userId) enforcement ---');
        console.log(`Inserting first collaborator: (boardId: ${testBoardId}, userId: ${testUser2.id}, role: 'viewer')...`);
        await db.insert(boardCollaborators).values({
            id: testCollab1Id,
            boardId: testBoardId,
            userId: testUser2.id,
            role: 'viewer'
        });
        console.log('First collaborator inserted successfully.');

        console.log(`Attempting duplicate insert: (boardId: ${testBoardId}, userId: ${testUser2.id}, role: 'editor')...`);
        let duplicateCaught = false;
        let caughtErrorMsg = '';

        try {
            await db.insert(boardCollaborators).values({
                id: testCollab2Id,
                boardId: testBoardId,
                userId: testUser2.id,
                role: 'editor'
            });
            console.log('❌ FAILED: Duplicate insert succeeded when it should have violated unique index!');
            failedConstraints++;
        } catch (err: any) {
            duplicateCaught = true;
            caughtErrorMsg = err.message || String(err);
            console.log(`Caught expected error: ${caughtErrorMsg}`);

            if (caughtErrorMsg.includes('UNIQUE constraint failed') || caughtErrorMsg.includes('SQLITE_CONSTRAINT')) {
                console.log('✅ Unique index enforcement verified: SQLite UNIQUE constraint error thrown.');
                passedConstraints++;
            } else {
                console.log('⚠️ Error thrown was not an explicit UNIQUE constraint error: ' + caughtErrorMsg);
                failedConstraints++;
            }
        }

        // --- 2.3 Test comments.isAnonymous default boolean value ---
        console.log('\n--- Test 2.3: comments.isAnonymous default boolean value ---');
        console.log(`Inserting comment 1 without specifying isAnonymous...`);
        await db.insert(comments).values({
            id: testComment1Id,
            boardId: testBoardId,
            userId: testUser1.id,
            content: 'Testing default isAnonymous'
        });

        const [createdComment1] = await db.select().from(comments).where(eq(comments.id, testComment1Id));
        console.log(`Comment 1 isAnonymous: ${createdComment1.isAnonymous} (type: ${typeof createdComment1.isAnonymous})`);

        if (createdComment1.isAnonymous === false) {
            console.log('✅ Default comments.isAnonymous === false verified.');
            passedConstraints++;
        } else {
            console.log(`❌ Expected comments.isAnonymous === false, got ${createdComment1.isAnonymous}`);
            failedConstraints++;
        }

        console.log(`Inserting comment 2 explicitly with isAnonymous = true...`);
        await db.insert(comments).values({
            id: testComment2Id,
            boardId: testBoardId,
            userId: testUser1.id,
            content: 'Testing explicit isAnonymous = true',
            isAnonymous: true
        });

        const [createdComment2] = await db.select().from(comments).where(eq(comments.id, testComment2Id));
        console.log(`Comment 2 isAnonymous: ${createdComment2.isAnonymous} (type: ${typeof createdComment2.isAnonymous})`);

        if (createdComment2.isAnonymous === true) {
            console.log('✅ Explicit comments.isAnonymous === true verified.');
            passedConstraints++;
        } else {
            console.log(`❌ Expected comments.isAnonymous === true, got ${createdComment2.isAnonymous}`);
            failedConstraints++;
        }

    } finally {
        console.log('\n--- Cleanup ---');
        console.log('Removing test rows from comments, board_collaborators, and boards...');
        try {
            await db.delete(comments).where(eq(comments.boardId, testBoardId));
            await db.delete(boardCollaborators).where(eq(boardCollaborators.boardId, testBoardId));
            await db.delete(boards).where(eq(boards.id, testBoardId));
            console.log('✅ Cleanup complete.');
        } catch (cleanupErr) {
            console.error('⚠️ Cleanup error:', cleanupErr);
        }
    }

    console.log(`\nLive DB Constraints Summary: ${passedConstraints} passed, ${failedConstraints} failed.\n`);
    return { passedConstraints, failedConstraints };
}

async function main() {
    const p1 = await runFailFastTests();
    const p2 = await runLiveDbConstraintTests();

    console.log('====================================================');
    console.log('FINAL CHALLENGER VERIFICATION RESULT');
    console.log('====================================================');
    console.log(`Part 1 (Fail-Fast): ${p1.passedFailFast}/${p1.total} passed`);
    console.log(`Part 2 (Constraints): ${p2.passedConstraints} passed, ${p2.failedConstraints} failed`);

    if (p1.failedFailFast === 0 && p2.failedConstraints === 0) {
        console.log('\nVERDICT: ALL TESTS PASSED EMPIRICALLY (APPROVE)\n');
        process.exit(0);
    } else {
        console.log('\nVERDICT: FAILURES DETECTED (REQUEST_CHANGES)\n');
        process.exit(1);
    }
}

main().catch((err) => {
    console.error('Fatal error in stress test runner:', err);
    process.exit(1);
});
