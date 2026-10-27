import { test, expect } from '@playwright/test';
import { DETECTIVE_ALPHA, DETECTIVE_BETA, DETECTIVE_GAMMA } from '../helpers/auth';
import {
    seedTestUsers,
    cleanupTestData,
    createTestBoard,
    getTestBoard,
    closeDbClient,
} from '../helpers/db';
import { createApiClient } from '../helpers/api-client';

test.describe('Tier 3.5: Contribution Rejection & Immutability Flow', () => {
    let targetBoardId: string;
    let contributionId: string;
    const clientOwner = createApiClient(undefined, DETECTIVE_ALPHA);
    const clientContributor = createApiClient(undefined, DETECTIVE_BETA);
    const clientIntruder = createApiClient(undefined, DETECTIVE_GAMMA);

    const initialContent = {
        nodes: [
            {
                id: 'node-pristine-1',
                type: 'sticky',
                position: { x: 100, y: 100 },
                data: { label: 'Verified autopsy finding: Blunt force trauma' },
            },
        ],
        edges: [],
    };

    test.beforeAll(async () => {
        await seedTestUsers();

        // Target board created by Detective Alpha
        targetBoardId = await createTestBoard({
            userId: DETECTIVE_ALPHA.id,
            title: `[E2E-TEST] Homicide Autopsy Dossier ${Date.now()}`,
            isPublic: true,
            content: initialContent,
        });
    });

    test.afterAll(async () => {
        await cleanupTestData();
        await closeDbClient();
    });

    test('contributor submits spam/conflicting proposal', async () => {
        const spamSnapshot = {
            nodes: [
                {
                    id: 'node-spam-1',
                    type: 'sticky',
                    position: { x: 200, y: 200 },
                    data: { label: 'SPAM / Incoherent hypothesis: Alien abduction' },
                },
            ],
            edges: [],
        };

        const postRes = await clientContributor.post<{ id: string }>('/api/contributions', {
            targetBoardId,
            message: 'Extraterrestrial intervention hypothesis',
            snapshot: spamSnapshot,
        });

        expect(postRes.status).toBe(201);
        expect(postRes.data.id).toBeDefined();
        contributionId = postRes.data.id;
    });

    test('non-owner cannot reject contribution (403 Forbidden)', async () => {
        // Contributor attempts to reject
        const contributorRejectRes = await clientContributor.post(
            `/api/contributions/${contributionId}/reject`
        );
        expect(contributorRejectRes.status).toBe(403);

        // Third-party intruder attempts to reject
        const intruderRejectRes = await clientIntruder.post(
            `/api/contributions/${contributionId}/reject`
        );
        expect(intruderRejectRes.status).toBe(403);
    });

    test('board owner successfully rejects contribution', async () => {
        const rejectRes = await clientOwner.post<{ success: boolean }>(
            `/api/contributions/${contributionId}/reject`
        );
        expect(rejectRes.status).toBe(200);
        expect(rejectRes.data.success).toBe(true);
    });

    test('contribution status transitions to rejected and board content remains untouched', async () => {
        // 1. Verify contribution status in DB / API
        const listRes = await clientOwner.get<Array<{ id: string; status: string }>>(
            '/api/contributions',
            {
                params: { boardId: targetBoardId },
            }
        );
        const rejectedContrib = listRes.data.find((c) => c.id === contributionId);
        expect(rejectedContrib).toBeDefined();
        expect(rejectedContrib?.status).toBe('rejected');

        // 2. Verify target board content is 100% identical to pre-submission state
        const currentBoard = await getTestBoard(targetBoardId);
        const currentContent = currentBoard?.content as { nodes: Array<{ id: string; data: { label: string } }>; edges: unknown[] };

        expect(currentContent.nodes.length).toBe(1);
        expect(currentContent.nodes[0].id).toBe('node-pristine-1');
        expect(currentContent.nodes[0].data.label).toBe('Verified autopsy finding: Blunt force trauma');
        expect(currentContent.edges.length).toBe(0);
    });

    test('prevent duplicate rejection or merge on rejected contribution (400 Bad Request)', async () => {
        // Re-rejecting returns 400 because status is no longer 'open'
        const reRejectRes = await clientOwner.post(`/api/contributions/${contributionId}/reject`);
        expect(reRejectRes.status).toBe(400);

        // Status remains 'rejected'
        const listRes = await clientOwner.get<Array<{ id: string; status: string }>>(
            '/api/contributions',
            {
                params: { boardId: targetBoardId },
            }
        );
        const contrib = listRes.data.find((c) => c.id === contributionId);
        expect(contrib?.status).toBe('rejected');
    });
});
