import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { unlink } from 'fs/promises';
import { join } from 'path';
import { NextRequest } from 'next/server';
import { eq, and, sql } from 'drizzle-orm';

// Require db and schema after dotenv is loaded
const { db } = require('../src/lib/db');
const { users, boards, boardCollaborators, comments, rateLimits } = require('../src/lib/schema');
const { checkRateLimit } = require('../src/lib/rate-limit');
const { getBoardAccess } = require('../src/lib/auth-checks');

// ---------------------------------------------------------------------------
// 0. Setup Mockable NextAuth for Route Handlers
// ---------------------------------------------------------------------------
const authPath = require.resolve('../src/auth');
let mockSession: { user?: { id: string; email?: string; name?: string } } | null = null;

function setMockSession(session: { user?: { id: string; email?: string; name?: string } } | null) {
    mockSession = session;
}

require.cache[authPath] = {
    id: authPath,
    filename: authPath,
    loaded: true,
    exports: {
        auth: async () => mockSession,
        handlers: {},
        signIn: async () => {},
        signOut: async () => {},
    },
} as any;

// Now require the route handlers (they will bind to our mocked auth)
const boardRoutes = require('../src/app/api/boards/[id]/route');
const collaboratorRoutes = require('../src/app/api/boards/[id]/collaborators/route');
const commentRoutes = require('../src/app/api/comments/route');
const uploadRoutes = require('../src/app/api/upload/route');

// ---------------------------------------------------------------------------
// Test Infrastructure
// ---------------------------------------------------------------------------
const RUN_ID = `test_ch2_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

interface TestCaseResult {
    part: string;
    name: string;
    passed: boolean;
    details: string;
    error?: string;
}

const results: TestCaseResult[] = [];
const uploadedFilesToCleanup: string[] = [];

function recordTest(part: string, name: string, passed: boolean, details: string, error?: string) {
    results.push({ part, name, passed, details, error });
    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} [${part}] ${name}`);
    console.log(`       Details: ${details}`);
    if (error) {
        console.error(`       Error: ${error}`);
    }
}

function createParams(id: string) {
    return {
        params: Promise.resolve({ id }),
    };
}

function createJsonRequest(url: string, method: string, body?: any) {
    return new NextRequest(url, {
        method,
        headers: {
            'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
    });
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Main Test Suite
// ---------------------------------------------------------------------------
async function main() {
    console.log('================================================================');
    console.log('  EMPIRICAL CHALLENGER 2: Rate Limiting, IDOR & Upload Security');
    console.log(`  Run ID: ${RUN_ID}`);
    console.log('  Live Turso DB Connection active');
    console.log('================================================================\n');

    // Fixture identifiers
    const ownerId = `${RUN_ID}_user_owner`;
    const editorId = `${RUN_ID}_user_editor`;
    const viewerId = `${RUN_ID}_user_viewer`;
    const strangerId = `${RUN_ID}_user_stranger`;
    const newCollabId = `${RUN_ID}_user_newcollab`;

    const privateBoardId = `${RUN_ID}_board_private`;
    const publicBoardId = `${RUN_ID}_board_public`;
    const softDeletedBoardId = `${RUN_ID}_board_deleted`;
    const boardToDeleteId = `${RUN_ID}_board_to_delete`;

    try {
        // -----------------------------------------------------------------------
        // PART 1: ATOMIC RATE LIMITING STRESS TESTS
        // -----------------------------------------------------------------------
        console.log('----------------------------------------------------------------');
        console.log('PART 1: ATOMIC RATE LIMITING STRESS TESTS (Live Turso DB)');
        console.log('----------------------------------------------------------------');

        // Test 1.1: Concurrent burst (25 simultaneous calls with cap of 5)
        {
            const burstKey = `${RUN_ID}:burst:ip1`;
            const maxAllowed = 5;
            const burstSize = 25;
            const windowMs = 60000;

            console.log(`Executing concurrent burst: ${burstSize} parallel requests with cap=${maxAllowed}...`);

            const promises = Array.from({ length: burstSize }, () =>
                checkRateLimit(burstKey, maxAllowed, windowMs)
            );

            const outcomes = await Promise.all(promises);
            const successes = outcomes.filter((o) => o.success).length;
            const blocked = outcomes.filter((o) => !o.success).length;

            const dbRecord = await db.select()
                .from(rateLimits)
                .where(eq(rateLimits.key, burstKey))
                .limit(1);

            const currentDbCount = dbRecord[0]?.count ?? 0;

            const passBurst = successes === maxAllowed && blocked === (burstSize - maxAllowed) && currentDbCount === burstSize;

            recordTest(
                'RATE-LIMIT',
                `Atomic burst of ${burstSize} requests with limit ${maxAllowed}`,
                passBurst,
                `Successes: ${successes} (expected ${maxAllowed}), Blocked: ${blocked} (expected ${burstSize - maxAllowed}), Final DB Count: ${currentDbCount} (expected ${burstSize})`
            );
        }

        // Test 1.2: Second burst on already-exhausted key
        {
            const burstKey = `${RUN_ID}:burst:ip1`;
            const additionalRequests = 10;
            const maxAllowed = 5;

            const followUpPromises = Array.from({ length: additionalRequests }, () =>
                checkRateLimit(burstKey, maxAllowed, 60000)
            );

            const followUpOutcomes = await Promise.all(followUpPromises);
            const followUpSuccesses = followUpOutcomes.filter((o) => o.success).length;
            const followUpBlocked = followUpOutcomes.filter((o) => !o.success).length;

            const dbRecord = await db.select()
                .from(rateLimits)
                .where(eq(rateLimits.key, burstKey))
                .limit(1);

            const currentDbCount = dbRecord[0]?.count ?? 0;
            const passSecondBurst = followUpSuccesses === 0 && followUpBlocked === additionalRequests && currentDbCount === 35;

            recordTest(
                'RATE-LIMIT',
                `Follow-up burst on exhausted key rejects 100% of requests`,
                passSecondBurst,
                `Successes: ${followUpSuccesses} (expected 0), Blocked: ${followUpBlocked} (expected ${additionalRequests}), Final DB Count: ${currentDbCount} (expected 35)`
            );
        }

        // Test 1.3: Atomic expiration reset behavior
        {
            const resetKey = `${RUN_ID}:reset:test`;
            const shortWindowMs = 800; // 800ms
            const limit = 2;

            // Consume limit
            const r1 = await checkRateLimit(resetKey, limit, shortWindowMs);
            const r2 = await checkRateLimit(resetKey, limit, shortWindowMs);
            const r3 = await checkRateLimit(resetKey, limit, shortWindowMs);

            const initialCapPass = r1.success && r2.success && !r3.success;

            console.log(`Sleeping 1100ms to allow expiration window (${shortWindowMs}ms) to elapse...`);
            await sleep(1100);

            // Post-expiration request should reset count to 1 and succeed
            const r4 = await checkRateLimit(resetKey, limit, shortWindowMs);

            const dbRecord = await db.select()
                .from(rateLimits)
                .where(eq(rateLimits.key, resetKey))
                .limit(1);

            const countAfterReset = dbRecord[0]?.count ?? -1;
            const resetPass = initialCapPass && r4.success && countAfterReset === 1;

            recordTest(
                'RATE-LIMIT',
                'Atomic expiration reset: count resets to 1 after window elapses',
                resetPass,
                `Initial [r1=${r1.success}, r2=${r2.success}, r3=${r3.success}], After sleep: r4=${r4.success}, DB Count=${countAfterReset} (expected 1)`
            );
        }

        // Test 1.4: High-volume stress (50 parallel requests, cap 10, check for 0 database locking errors)
        {
            const highVolumeKey = `${RUN_ID}:highvol:ip2`;
            const maxReq = 10;
            const totalCalls = 50;

            let errorCount = 0;
            const promises = Array.from({ length: totalCalls }, () =>
                checkRateLimit(highVolumeKey, maxReq, 60000).catch((err) => {
                    errorCount++;
                    return { success: false, reset: 0 };
                })
            );

            const outcomes = await Promise.all(promises);
            const succ = outcomes.filter((o) => o.success).length;
            const fail = outcomes.filter((o) => !o.success).length;

            const dbRecord = await db.select()
                .from(rateLimits)
                .where(eq(rateLimits.key, highVolumeKey))
                .limit(1);

            const finalCount = dbRecord[0]?.count ?? 0;
            const passHighVol = errorCount === 0 && succ === maxReq && fail === (totalCalls - maxReq) && finalCount === totalCalls;

            recordTest(
                'RATE-LIMIT',
                `High concurrency (${totalCalls} simultaneous requests): 0 lock errors, exact count`,
                passHighVol,
                `Errors: ${errorCount} (expected 0), Succeeded: ${succ} (expected ${maxReq}), Blocked: ${fail}, DB Count: ${finalCount} (expected ${totalCalls})`
            );
        }

        // -----------------------------------------------------------------------
        // PROVISION FIXTURES FOR IDOR & ACCESS MATRIX
        // -----------------------------------------------------------------------
        console.log('\n----------------------------------------------------------------');
        console.log('PROVISIONING FIXTURES FOR IDOR & ACCESS MATRIX IN TURSO DB');
        console.log('----------------------------------------------------------------');

        await (db.insert(users) as any).values([
            { id: ownerId, name: 'Owner Detective', email: `${ownerId}@example.com` },
            { id: editorId, name: 'Editor Detective', email: `${editorId}@example.com` },
            { id: viewerId, name: 'Viewer Detective', email: `${viewerId}@example.com` },
            { id: strangerId, name: 'Stranger Detective', email: `${strangerId}@example.com` },
            { id: newCollabId, name: 'New Collab Detective', email: `${newCollabId}@example.com` },
        ]);

        const now = new Date();
        const deletionDate = new Date(Date.now() - 60000);

        await (db.insert(boards) as any).values([
            {
                id: privateBoardId,
                userId: ownerId,
                title: 'Confidential Case',
                isPublic: false,
                content: { notes: 'Secret evidence' },
                version: 1,
                deletedAt: null,
            },
            {
                id: publicBoardId,
                userId: ownerId,
                title: 'Public Open Case',
                isPublic: true,
                content: { notes: 'Public evidence' },
                version: 1,
                deletedAt: null,
            },
            {
                id: softDeletedBoardId,
                userId: ownerId,
                title: 'Soft Deleted Case',
                isPublic: false,
                content: { notes: 'Deleted evidence' },
                version: 1,
                deletedAt: deletionDate,
            },
            {
                id: boardToDeleteId,
                userId: ownerId,
                title: 'Board Target For Delete API Test',
                isPublic: false,
                content: { notes: 'To be deleted by DELETE endpoint' },
                version: 1,
                deletedAt: null,
            },
        ]);

        await db.insert(boardCollaborators).values([
            { id: `${RUN_ID}_c1`, boardId: privateBoardId, userId: editorId, role: 'editor', addedAt: now },
            { id: `${RUN_ID}_c2`, boardId: privateBoardId, userId: viewerId, role: 'viewer', addedAt: now },
            { id: `${RUN_ID}_c3`, boardId: softDeletedBoardId, userId: viewerId, role: 'viewer', addedAt: now },
            { id: `${RUN_ID}_c4`, boardId: boardToDeleteId, userId: editorId, role: 'editor', addedAt: now },
            { id: `${RUN_ID}_c5`, boardId: boardToDeleteId, userId: viewerId, role: 'viewer', addedAt: now },
        ]);

        console.log('✅ Test fixtures successfully provisioned in Turso DB.\n');

        // -----------------------------------------------------------------------
        // PART 2: IDOR & AUTHORIZATION ACCESS MATRIX ATTACK
        // -----------------------------------------------------------------------
        console.log('----------------------------------------------------------------');
        console.log('PART 2A: getBoardAccess DIRECT MATRIX ATTACK');
        console.log('----------------------------------------------------------------');

        // Test 2A.1: Non-collaborator on private board
        {
            const access = await getBoardAccess(privateBoardId, strangerId);
            const pass = !access.canView && !access.canEdit && !access.isOwner;
            recordTest(
                'IDOR-HELPER',
                'Non-collaborator on private board is denied all permissions',
                pass,
                `canView=${access.canView} (exp false), canEdit=${access.canEdit} (exp false), isOwner=${access.isOwner} (exp false)`
            );
        }

        // Test 2A.2: Soft-deleted board denies ALL permissions even to owner
        {
            const ownerAccess = await getBoardAccess(softDeletedBoardId, ownerId);
            const passOwner = ownerAccess.board === null && !ownerAccess.canView && !ownerAccess.canEdit && !ownerAccess.isOwner;
            recordTest(
                'IDOR-HELPER',
                'Soft-deleted board returns null board & denies all permissions to owner',
                passOwner,
                `board=${ownerAccess.board} (exp null), canView=${ownerAccess.canView}, canEdit=${ownerAccess.canEdit}, isOwner=${ownerAccess.isOwner}`
            );

            const viewerAccess = await getBoardAccess(softDeletedBoardId, viewerId);
            const passViewer = viewerAccess.board === null && !viewerAccess.canView && !viewerAccess.canEdit && !viewerAccess.isOwner;
            recordTest(
                'IDOR-HELPER',
                'Soft-deleted board returns null board & denies all permissions to viewer collaborator',
                passViewer,
                `board=${viewerAccess.board} (exp null), canView=${viewerAccess.canView}, canEdit=${viewerAccess.canEdit}, isOwner=${viewerAccess.isOwner}`
            );

            const unauthAccess = await getBoardAccess(softDeletedBoardId, undefined);
            const passUnauth = unauthAccess.board === null && !unauthAccess.canView && !unauthAccess.canEdit && !unauthAccess.isOwner;
            recordTest(
                'IDOR-HELPER',
                'Soft-deleted board returns null board & denies all permissions to unauthenticated caller',
                passUnauth,
                `board=${unauthAccess.board} (exp null), canView=${unauthAccess.canView}, canEdit=${unauthAccess.canEdit}, isOwner=${unauthAccess.isOwner}`
            );
        }

        // Test 2A.3: Viewer collaborator permissions
        {
            const access = await getBoardAccess(privateBoardId, viewerId);
            const pass = access.canView === true && access.canEdit === false && access.isOwner === false;
            recordTest(
                'IDOR-HELPER',
                'Viewer collaborator has canView: true, canEdit: false, isOwner: false',
                pass,
                `canView=${access.canView} (exp true), canEdit=${access.canEdit} (exp false), isOwner=${access.isOwner} (exp false)`
            );
        }

        // Test 2A.4: Editor collaborator permissions
        {
            const access = await getBoardAccess(privateBoardId, editorId);
            const pass = access.canView === true && access.canEdit === true && access.isOwner === false;
            recordTest(
                'IDOR-HELPER',
                'Editor collaborator has canView: true, canEdit: true, isOwner: false',
                pass,
                `canView=${access.canView} (exp true), canEdit=${access.canEdit} (exp true), isOwner=${access.isOwner} (exp false)`
            );
        }

        // Test 2A.5: Owner permissions
        {
            const access = await getBoardAccess(privateBoardId, ownerId);
            const pass = access.canView === true && access.canEdit === true && access.isOwner === true;
            recordTest(
                'IDOR-HELPER',
                'Board owner has canView: true, canEdit: true, isOwner: true',
                pass,
                `canView=${access.canView} (exp true), canEdit=${access.canEdit} (exp true), isOwner=${access.isOwner} (exp true)`
            );
        }

        // Test 2A.6: Public board accessible to stranger / unauth
        {
            const strangerAccess = await getBoardAccess(publicBoardId, strangerId);
            const passStranger = strangerAccess.canView === true && strangerAccess.canEdit === false && strangerAccess.isOwner === false;
            recordTest(
                'IDOR-HELPER',
                'Stranger can view public board but cannot edit or own',
                passStranger,
                `canView=${strangerAccess.canView} (exp true), canEdit=${strangerAccess.canEdit} (exp false), isOwner=${strangerAccess.isOwner} (exp false)`
            );

            const unauthAccess = await getBoardAccess(publicBoardId, undefined);
            const passUnauth = unauthAccess.canView === true && unauthAccess.canEdit === false && unauthAccess.isOwner === false;
            recordTest(
                'IDOR-HELPER',
                'Unauthenticated caller can view public board but cannot edit or own',
                passUnauth,
                `canView=${unauthAccess.canView} (exp true), canEdit=${unauthAccess.canEdit} (exp false), isOwner=${unauthAccess.isOwner} (exp false)`
            );
        }

        console.log('\n----------------------------------------------------------------');
        console.log('PART 2B: ROUTE HANDLER AUTHORIZATION & IDOR ATTACK');
        console.log('----------------------------------------------------------------');

        // Test 2B.1: GET /api/boards/[id]
        {
            // Stranger on private board -> 403
            setMockSession({ user: { id: strangerId } });
            const reqStranger = createJsonRequest(`http://localhost:3000/api/boards/${privateBoardId}`, 'GET');
            const resStranger = await boardRoutes.GET(reqStranger, createParams(privateBoardId));
            recordTest(
                'ROUTE-BOARDS-GET',
                'Stranger GET /api/boards/[id] on private board returns 403 Forbidden',
                resStranger.status === 403,
                `Status: ${resStranger.status} (expected 403)`
            );

            // Unauthenticated on private board -> 401
            setMockSession(null);
            const reqUnauth = createJsonRequest(`http://localhost:3000/api/boards/${privateBoardId}`, 'GET');
            const resUnauth = await boardRoutes.GET(reqUnauth, createParams(privateBoardId));
            recordTest(
                'ROUTE-BOARDS-GET',
                'Unauthenticated GET /api/boards/[id] on private board returns 401 Unauthorized',
                resUnauth.status === 401,
                `Status: ${resUnauth.status} (expected 401)`
            );

            // Owner on soft-deleted board -> 404
            setMockSession({ user: { id: ownerId } });
            const reqDel = createJsonRequest(`http://localhost:3000/api/boards/${softDeletedBoardId}`, 'GET');
            const resDel = await boardRoutes.GET(reqDel, createParams(softDeletedBoardId));
            recordTest(
                'ROUTE-BOARDS-GET',
                'Owner GET /api/boards/[id] on soft-deleted board returns 404 Not Found',
                resDel.status === 404,
                `Status: ${resDel.status} (expected 404)`
            );

            // Viewer on private board -> 200
            setMockSession({ user: { id: viewerId } });
            const reqViewer = createJsonRequest(`http://localhost:3000/api/boards/${privateBoardId}`, 'GET');
            const resViewer = await boardRoutes.GET(reqViewer, createParams(privateBoardId));
            recordTest(
                'ROUTE-BOARDS-GET',
                'Viewer GET /api/boards/[id] on private board returns 200 OK',
                resViewer.status === 200,
                `Status: ${resViewer.status} (expected 200)`
            );
        }

        // Test 2B.2: PUT /api/boards/[id]
        {
            // Viewer attempting to edit content -> 403 Forbidden
            setMockSession({ user: { id: viewerId } });
            const reqViewerEdit = createJsonRequest(
                `http://localhost:3000/api/boards/${privateBoardId}`,
                'PUT',
                { content: { updated: 'by viewer' } }
            );
            const resViewerEdit = await boardRoutes.PUT(reqViewerEdit, createParams(privateBoardId));
            const viewerJson = await resViewerEdit.json();
            recordTest(
                'ROUTE-BOARDS-PUT',
                'Viewer PUT /api/boards/[id] is rejected with 403 Forbidden',
                resViewerEdit.status === 403 && viewerJson.error?.includes('permission'),
                `Status: ${resViewerEdit.status} (expected 403), Error: ${viewerJson.error}`
            );

            // Editor attempting owner-only action: change isPublic -> 403 Forbidden
            setMockSession({ user: { id: editorId } });
            const reqEditorPublic = createJsonRequest(
                `http://localhost:3000/api/boards/${privateBoardId}`,
                'PUT',
                { isPublic: true }
            );
            const resEditorPublic = await boardRoutes.PUT(reqEditorPublic, createParams(privateBoardId));
            const editorPublicJson = await resEditorPublic.json();
            recordTest(
                'ROUTE-BOARDS-PUT',
                'Editor PUT /api/boards/[id] attempting isPublic change is rejected with 403 Forbidden',
                resEditorPublic.status === 403 && editorPublicJson.error?.includes('Only board owner can change visibility'),
                `Status: ${resEditorPublic.status} (expected 403), Error: ${editorPublicJson.error}`
            );

            // Editor editing regular content -> 200 OK
            const reqEditorContent = createJsonRequest(
                `http://localhost:3000/api/boards/${privateBoardId}`,
                'PUT',
                { content: { updated: 'legit editor edit' } }
            );
            const resEditorContent = await boardRoutes.PUT(reqEditorContent, createParams(privateBoardId));
            recordTest(
                'ROUTE-BOARDS-PUT',
                'Editor PUT /api/boards/[id] editing allowed content succeeds with 200 OK',
                resEditorContent.status === 200,
                `Status: ${resEditorContent.status} (expected 200)`
            );

            // Owner attempting edit on soft-deleted board -> 404 Not Found
            setMockSession({ user: { id: ownerId } });
            const reqOwnerDelEdit = createJsonRequest(
                `http://localhost:3000/api/boards/${softDeletedBoardId}`,
                'PUT',
                { content: { updated: 'owner trying to edit deleted board' } }
            );
            const resOwnerDelEdit = await boardRoutes.PUT(reqOwnerDelEdit, createParams(softDeletedBoardId));
            recordTest(
                'ROUTE-BOARDS-PUT',
                'Owner PUT /api/boards/[id] on soft-deleted board returns 404 Not Found',
                resOwnerDelEdit.status === 404,
                `Status: ${resOwnerDelEdit.status} (expected 404)`
            );
        }

        // Test 2B.3: DELETE /api/boards/[id]
        {
            // Viewer attempting to delete board -> 403 Forbidden
            setMockSession({ user: { id: viewerId } });
            const reqViewerDel = createJsonRequest(`http://localhost:3000/api/boards/${boardToDeleteId}`, 'DELETE');
            const resViewerDel = await boardRoutes.DELETE(reqViewerDel, createParams(boardToDeleteId));
            const viewerDelJson = await resViewerDel.json();
            recordTest(
                'ROUTE-BOARDS-DELETE',
                'Viewer DELETE /api/boards/[id] is rejected with 403 Forbidden',
                resViewerDel.status === 403 && viewerDelJson.error?.includes('Only the board owner can delete this board'),
                `Status: ${resViewerDel.status} (expected 403), Error: ${viewerDelJson.error}`
            );

            // Editor attempting to delete board -> 403 Forbidden
            setMockSession({ user: { id: editorId } });
            const reqEditorDel = createJsonRequest(`http://localhost:3000/api/boards/${boardToDeleteId}`, 'DELETE');
            const resEditorDel = await boardRoutes.DELETE(reqEditorDel, createParams(boardToDeleteId));
            const editorDelJson = await resEditorDel.json();
            recordTest(
                'ROUTE-BOARDS-DELETE',
                'Editor DELETE /api/boards/[id] is rejected with 403 Forbidden',
                resEditorDel.status === 403 && editorDelJson.error?.includes('Only the board owner can delete this board'),
                `Status: ${resEditorDel.status} (expected 403), Error: ${editorDelJson.error}`
            );

            // Stranger attempting to delete board -> 403 Forbidden
            setMockSession({ user: { id: strangerId } });
            const reqStrangerDel = createJsonRequest(`http://localhost:3000/api/boards/${boardToDeleteId}`, 'DELETE');
            const resStrangerDel = await boardRoutes.DELETE(reqStrangerDel, createParams(boardToDeleteId));
            recordTest(
                'ROUTE-BOARDS-DELETE',
                'Stranger DELETE /api/boards/[id] is rejected with 403 Forbidden',
                resStrangerDel.status === 403,
                `Status: ${resStrangerDel.status} (expected 403)`
            );

            // Owner attempting to delete already soft-deleted board -> 404 Not Found
            setMockSession({ user: { id: ownerId } });
            const reqOwnerDelAlready = createJsonRequest(`http://localhost:3000/api/boards/${softDeletedBoardId}`, 'DELETE');
            const resOwnerDelAlready = await boardRoutes.DELETE(reqOwnerDelAlready, createParams(softDeletedBoardId));
            recordTest(
                'ROUTE-BOARDS-DELETE',
                'Owner DELETE /api/boards/[id] on already soft-deleted board returns 404 Not Found',
                resOwnerDelAlready.status === 404,
                `Status: ${resOwnerDelAlready.status} (expected 404)`
            );

            // Owner deleting active board -> 200 OK and updates deletedAt in live DB
            const reqOwnerDelete = createJsonRequest(`http://localhost:3000/api/boards/${boardToDeleteId}`, 'DELETE');
            const resOwnerDelete = await boardRoutes.DELETE(reqOwnerDelete, createParams(boardToDeleteId));
            const ownerDeleteJson = await resOwnerDelete.json();

            // Verify live DB
            const dbCheck = await db.select()
                .from(boards)
                .where(eq(boards.id, boardToDeleteId))
                .limit(1);

            const isDeletedInDb = dbCheck[0]?.deletedAt !== null;
            const passOwnerDel = resOwnerDelete.status === 200 && ownerDeleteJson.success === true && isDeletedInDb;

            recordTest(
                'ROUTE-BOARDS-DELETE',
                'Owner DELETE /api/boards/[id] soft-deletes board successfully (deletedAt populated in DB)',
                passOwnerDel,
                `Status: ${resOwnerDelete.status}, Success: ${ownerDeleteJson.success}, deletedAt in DB: ${dbCheck[0]?.deletedAt}`
            );
        }

        // Test 2B.4: Collaborators API Authorization
        {
            // Stranger attempting to GET collaborators of private board -> 403 Forbidden
            setMockSession({ user: { id: strangerId } });
            const reqStrangerCollab = createJsonRequest(
                `http://localhost:3000/api/boards/${privateBoardId}/collaborators`,
                'GET'
            );
            const resStrangerCollab = await collaboratorRoutes.GET(reqStrangerCollab, createParams(privateBoardId));
            recordTest(
                'ROUTE-COLLAB',
                'Stranger GET /api/boards/[id]/collaborators on private board returns 403 Forbidden',
                resStrangerCollab.status === 403,
                `Status: ${resStrangerCollab.status} (expected 403)`
            );

            // Editor attempting to POST a collaborator -> 403 Forbidden
            setMockSession({ user: { id: editorId } });
            const reqEditorAddCollab = createJsonRequest(
                `http://localhost:3000/api/boards/${privateBoardId}/collaborators`,
                'POST',
                { userId: newCollabId, role: 'viewer' }
            );
            const resEditorAddCollab = await collaboratorRoutes.POST(reqEditorAddCollab, createParams(privateBoardId));
            const editorAddCollabJson = await resEditorAddCollab.json();
            recordTest(
                'ROUTE-COLLAB',
                'Editor POST /api/boards/[id]/collaborators is rejected with 403 Forbidden',
                resEditorAddCollab.status === 403 && editorAddCollabJson.error?.includes('Only board owner can add collaborators'),
                `Status: ${resEditorAddCollab.status} (expected 403), Error: ${editorAddCollabJson.error}`
            );

            // Owner adding a collaborator -> 201 Created
            setMockSession({ user: { id: ownerId } });
            const reqOwnerAddCollab = createJsonRequest(
                `http://localhost:3000/api/boards/${privateBoardId}/collaborators`,
                'POST',
                { userId: newCollabId, role: 'viewer' }
            );
            const resOwnerAddCollab = await collaboratorRoutes.POST(reqOwnerAddCollab, createParams(privateBoardId));
            recordTest(
                'ROUTE-COLLAB',
                'Owner POST /api/boards/[id]/collaborators succeeds with 201 Created',
                resOwnerAddCollab.status === 201,
                `Status: ${resOwnerAddCollab.status} (expected 201)`
            );
        }

        // Test 2B.5: Comments API Authorization
        {
            // Stranger attempting to GET comments on private board -> 403 Forbidden
            setMockSession({ user: { id: strangerId } });
            const reqStrangerComments = createJsonRequest(
                `http://localhost:3000/api/comments?boardId=${privateBoardId}`,
                'GET'
            );
            const resStrangerComments = await commentRoutes.GET(reqStrangerComments);
            recordTest(
                'ROUTE-COMMENTS',
                'Stranger GET /api/comments on private board returns 403 Forbidden',
                resStrangerComments.status === 403,
                `Status: ${resStrangerComments.status} (expected 403)`
            );

            // Stranger attempting to POST comment on private board -> 403 Forbidden
            const reqStrangerPostComment = createJsonRequest(
                'http://localhost:3000/api/comments',
                'POST',
                { boardId: privateBoardId, content: 'Unauthorized intruder comment' }
            );
            const resStrangerPostComment = await commentRoutes.POST(reqStrangerPostComment);
            recordTest(
                'ROUTE-COMMENTS',
                'Stranger POST /api/comments on private board returns 403 Forbidden',
                resStrangerPostComment.status === 403,
                `Status: ${resStrangerPostComment.status} (expected 403)`
            );

            // Viewer posting comment on private board -> 201 Created
            setMockSession({ user: { id: viewerId } });
            const reqViewerPostComment = createJsonRequest(
                'http://localhost:3000/api/comments',
                'POST',
                { boardId: privateBoardId, content: 'Legitimate viewer collaborator comment' }
            );
            const resViewerPostComment = await commentRoutes.POST(reqViewerPostComment);
            recordTest(
                'ROUTE-COMMENTS',
                'Viewer collaborator POST /api/comments on private board succeeds with 201 Created',
                resViewerPostComment.status === 201,
                `Status: ${resViewerPostComment.status} (expected 201)`
            );

            // Any user trying to POST comment on soft-deleted board -> 404 Not Found
            setMockSession({ user: { id: ownerId } });
            const reqOwnerDelComment = createJsonRequest(
                'http://localhost:3000/api/comments',
                'POST',
                { boardId: softDeletedBoardId, content: 'Comment on deleted board' }
            );
            const resOwnerDelComment = await commentRoutes.POST(reqOwnerDelComment);
            recordTest(
                'ROUTE-COMMENTS',
                'Owner POST /api/comments on soft-deleted board returns 404 Not Found',
                resOwnerDelComment.status === 404,
                `Status: ${resOwnerDelComment.status} (expected 404)`
            );
        }

        // -----------------------------------------------------------------------
        // PART 3: FILE UPLOAD SECURITY ATTACK (POST /api/upload)
        // -----------------------------------------------------------------------
        console.log('\n----------------------------------------------------------------');
        console.log('PART 3: FILE UPLOAD SECURITY ATTACK (POST /api/upload)');
        console.log('----------------------------------------------------------------');

        const uploadUserId = `${RUN_ID}_uploader`;
        setMockSession({ user: { id: uploadUserId } });

        const createUploadReq = (file: File | null) => {
            const formData = new FormData();
            if (file) formData.append('file', file);
            return new NextRequest('http://localhost:3000/api/upload', {
                method: 'POST',
                body: formData,
            });
        };

        // Test 3.1: PHP executable disguised as PNG
        {
            const phpPayload = Buffer.from('<?php echo "EXPLOIT_SUCCESS"; system($_GET["cmd"]); ?>');
            const file = new File([phpPayload], 'test.php.png', { type: 'image/png' });
            const req = createUploadReq(file);
            const res = await uploadRoutes.POST(req);
            const json = await res.json();
            const pass = res.status === 400 && json.error?.includes('Invalid file content');
            recordTest(
                'UPLOAD-ATTACK',
                'PHP script disguised as image/png (test.php.png) rejected with 400',
                pass,
                `Status: ${res.status} (expected 400), Error: ${json.error}`
            );
        }

        // Test 3.2: HTML Stored XSS disguised as image
        {
            const htmlPayload = Buffer.from('<html><head><script>alert("XSS")</script></head><body>evil</body></html>');
            const file = new File([htmlPayload], 'innocent_picture.png', { type: 'image/png' });
            const req = createUploadReq(file);
            const res = await uploadRoutes.POST(req);
            const json = await res.json();
            const pass = res.status === 400 && json.error?.includes('Invalid file content');
            recordTest(
                'UPLOAD-ATTACK',
                'HTML/JS payload disguised as image/png rejected with 400',
                pass,
                `Status: ${res.status} (expected 400), Error: ${json.error}`
            );
        }

        // Test 3.3: Shell script disguised as JPEG
        {
            const shPayload = Buffer.from('#!/bin/bash\ncat /etc/passwd\n');
            const file = new File([shPayload], 'avatar.jpg', { type: 'image/jpeg' });
            const req = createUploadReq(file);
            const res = await uploadRoutes.POST(req);
            const json = await res.json();
            const pass = res.status === 400 && json.error?.includes('Invalid file content');
            recordTest(
                'UPLOAD-ATTACK',
                'Bash shell script disguised as image/jpeg rejected with 400',
                pass,
                `Status: ${res.status} (expected 400), Error: ${json.error}`
            );
        }

        // Test 3.4: Corrupted / non-image magic bytes
        {
            // Truncated buffer (<12 bytes)
            const shortBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00]);
            const fileShort = new File([shortBuffer], 'truncated.png', { type: 'image/png' });
            const resShort = await uploadRoutes.POST(createUploadReq(fileShort));
            const jsonShort = await resShort.json();
            recordTest(
                'UPLOAD-ATTACK',
                'Truncated buffer (<12 bytes) rejected with 400',
                resShort.status === 400 && jsonShort.error?.includes('Invalid file content'),
                `Status: ${resShort.status} (expected 400), Error: ${jsonShort.error}`
            );

            // PDF document masquerading as JPEG
            const pdfBuffer = Buffer.from('%PDF-1.4\n%âãÏÓ\n1 0 obj\n<<>>\nendobj');
            const filePdf = new File([pdfBuffer], 'fake.jpg', { type: 'image/jpeg' });
            const resPdf = await uploadRoutes.POST(createUploadReq(filePdf));
            const jsonPdf = await resPdf.json();
            recordTest(
                'UPLOAD-ATTACK',
                'PDF file with spoofed image/jpeg header rejected with 400',
                resPdf.status === 400 && jsonPdf.error?.includes('Invalid file content'),
                `Status: ${resPdf.status} (expected 400), Error: ${jsonPdf.error}`
            );

            // ELF binary executable header
            const elfBuffer = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00]);
            const fileElf = new File([elfBuffer], 'binary.png', { type: 'image/png' });
            const resElf = await uploadRoutes.POST(createUploadReq(fileElf));
            const jsonElf = await resElf.json();
            recordTest(
                'UPLOAD-ATTACK',
                'Linux ELF binary with spoofed image/png header rejected with 400',
                resElf.status === 400 && jsonElf.error?.includes('Invalid file content'),
                `Status: ${resElf.status} (expected 400), Error: ${jsonElf.error}`
            );
        }

        // Test 3.5: Oversized file payload (>5MB)
        {
            // 5MB + 2048 bytes
            const oversizedBuffer = Buffer.alloc(5 * 1024 * 1024 + 2048);
            // Prefix with valid JPEG magic bytes so magic byte check doesn't shadow size check
            oversizedBuffer[0] = 0xff;
            oversizedBuffer[1] = 0xd8;
            oversizedBuffer[2] = 0xff;
            oversizedBuffer[3] = 0xe0;

            const fileOversized = new File([oversizedBuffer], 'giant.jpg', { type: 'image/jpeg' });
            const resOversized = await uploadRoutes.POST(createUploadReq(fileOversized));
            const jsonOversized = await resOversized.json();
            const pass = resOversized.status === 400 && jsonOversized.error?.includes('File too large');
            recordTest(
                'UPLOAD-ATTACK',
                'Oversized payload (>5MB) rejected with 400 ("File too large")',
                pass,
                `Status: ${resOversized.status} (expected 400), Error: ${jsonOversized.error}`
            );
        }

        // Test 3.6: Strict extension mapping & path traversal neutralization
        {
            // Genuine PNG magic bytes
            const validPngBytes = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d];
            const pngBuffer = Buffer.from(validPngBytes);

            // Attacker attempts path traversal and double extension: ../../../shell.php.jpg with Content-Type application/x-php
            const maliciousFile = new File([pngBuffer], '../../../../var/www/shell.php.jpg', { type: 'application/x-php' });
            const res = await uploadRoutes.POST(createUploadReq(maliciousFile));
            const json = await res.json();

            if (json.filename) {
                uploadedFilesToCleanup.push(json.filename);
            }

            const is200 = res.status === 200;
            const hasCuidPng = typeof json.filename === 'string' && json.filename.endsWith('.png') && !json.filename.includes('..') && !json.filename.includes('shell');
            const hasStrictType = json.type === 'image/png';
            const pass = is200 && hasCuidPng && hasStrictType;

            recordTest(
                'UPLOAD-DEFENSE',
                'Path traversal & double extension neutralized: strictly rewritten to <cuid>.png',
                pass,
                `Status: ${res.status}, Type: ${json.type} (expected image/png), Generated Filename: ${json.filename}`
            );
        }

        // Test 3.7: Valid JPEG file with spoofed MIME type & extension
        {
            const validJpegBytes = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01];
            const jpegBuffer = Buffer.from(validJpegBytes);

            const file = new File([jpegBuffer], 'document.pdf', { type: 'application/pdf' });
            const res = await uploadRoutes.POST(createUploadReq(file));
            const json = await res.json();

            if (json.filename) {
                uploadedFilesToCleanup.push(json.filename);
            }

            const pass = res.status === 200 && json.type === 'image/jpeg' && json.filename.endsWith('.jpg');
            recordTest(
                'UPLOAD-DEFENSE',
                'Valid JPEG with spoofed .pdf client name strictly mapped to .jpg',
                pass,
                `Status: ${res.status}, Type: ${json.type} (expected image/jpeg), Generated Filename: ${json.filename}`
            );
        }

        // Test 3.8: Valid GIF file
        {
            const gifBuffer = Buffer.from('GIF89a\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;');
            const file = new File([gifBuffer], 'graphic.svg', { type: 'image/svg+xml' });
            const res = await uploadRoutes.POST(createUploadReq(file));
            const json = await res.json();

            if (json.filename) {
                uploadedFilesToCleanup.push(json.filename);
            }

            const pass = res.status === 200 && json.type === 'image/gif' && json.filename.endsWith('.gif');
            recordTest(
                'UPLOAD-DEFENSE',
                'Valid GIF with spoofed SVG name strictly mapped to .gif',
                pass,
                `Status: ${res.status}, Type: ${json.type} (expected image/gif), Generated Filename: ${json.filename}`
            );
        }

        // Test 3.9: Valid WebP file
        {
            const webpBuffer = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x1a, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x4c]);
            const file = new File([webpBuffer], 'test.bmp', { type: 'image/bmp' });
            const res = await uploadRoutes.POST(createUploadReq(file));
            const json = await res.json();

            if (json.filename) {
                uploadedFilesToCleanup.push(json.filename);
            }

            const pass = res.status === 200 && json.type === 'image/webp' && json.filename.endsWith('.webp');
            recordTest(
                'UPLOAD-DEFENSE',
                'Valid WebP with spoofed BMP name strictly mapped to .webp',
                pass,
                `Status: ${res.status}, Type: ${json.type} (expected image/webp), Generated Filename: ${json.filename}`
            );
        }

        // Test 3.10: Unauthenticated upload attempt
        {
            setMockSession(null);
            const validPngBytes = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d];
            const file = new File([Buffer.from(validPngBytes)], 'test.png', { type: 'image/png' });
            const res = await uploadRoutes.POST(createUploadReq(file));
            recordTest(
                'UPLOAD-ATTACK',
                'Unauthenticated upload attempt returns 401 Unauthorized',
                res.status === 401,
                `Status: ${res.status} (expected 401)`
            );
        }

    } finally {
        // -----------------------------------------------------------------------
        // CLEANUP FIXTURES & TEMPORARY ARTIFACTS
        // -----------------------------------------------------------------------
        console.log('\n----------------------------------------------------------------');
        console.log('CLEANING UP TEST FIXTURES & ARTIFACTS');
        console.log('----------------------------------------------------------------');

        try {
            // Cleanup comments
            await db.delete(comments)
                .where(sql`${comments.boardId} LIKE ${`${RUN_ID}%`}`);

            // Cleanup collaborators
            await db.delete(boardCollaborators)
                .where(sql`${boardCollaborators.boardId} LIKE ${`${RUN_ID}%`}`);

            // Cleanup boards
            await db.delete(boards)
                .where(sql`${boards.id} LIKE ${`${RUN_ID}%`}`);

            // Cleanup users
            await db.delete(users)
                .where(sql`${users.id} LIKE ${`${RUN_ID}%`}`);

            // Cleanup rate limits
            await db.delete(rateLimits)
                .where(sql`${rateLimits.key} LIKE ${`${RUN_ID}%`}`);

            console.log('✅ Cleaned up test database fixtures.');
        } catch (cleanupErr: any) {
            console.error('⚠️ DB Cleanup warning:', cleanupErr.message);
        }

        // Cleanup uploaded files
        for (const filename of uploadedFilesToCleanup) {
            try {
                const p = join(process.cwd(), 'public', 'uploads', filename);
                await unlink(p);
                console.log(`✅ Cleaned up uploaded test file: ${filename}`);
            } catch (fileErr: any) {
                console.warn(`⚠️ File cleanup warning for ${filename}:`, fileErr.message);
            }
        }
    }

    // ---------------------------------------------------------------------------
    // VERDICT SUMMARY
    // ---------------------------------------------------------------------------
    console.log('\n================================================================');
    console.log('           EMPIRICAL CHALLENGER 2 VERDICT SUMMARY');
    console.log('================================================================');

    const total = results.length;
    const passed = results.filter((r) => r.passed).length;
    const failed = results.filter((r) => !r.passed).length;

    console.log(`Total Empirical Tests Executed: ${total}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);

    if (failed > 0) {
        console.error('\n❌ VERDICT: EMPIRICAL CHALLENGE FAILED');
        console.error('Failed tests:');
        for (const r of results.filter((r) => !r.passed)) {
            console.error(` - [${r.part}] ${r.name}: ${r.details}`);
        }
        process.exit(1);
    } else {
        console.log('\n✅ VERDICT: ALL EMPIRICAL CHALLENGES PASSED WITH ZERO VULNERABILITIES');
        console.log('All rate limiting concurrency guarantees, IDOR access matrix checks,');
        console.log('and file upload security validations are verified against live Turso DB.');
        process.exit(0);
    }
}

main().catch((err) => {
    console.error('CRITICAL UNHANDLED ERROR IN EMPIRICAL CHALLENGER:', err);
    process.exit(1);
});
