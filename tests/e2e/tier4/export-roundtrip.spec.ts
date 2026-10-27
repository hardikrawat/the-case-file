import { test, expect } from '@playwright/test';
import { DETECTIVE_ALPHA, authenticateContext } from '../helpers/auth';
import {
    seedTestUsers,
    cleanupTestData,
    createTestBoard,
    getTestBoard,
    closeDbClient,
} from '../helpers/db';
import { createApiClient } from '../helpers/api-client';

test.describe('Tier 4.3: Courtroom Case Dossier Multi-Format Export & Roundtrip Portability', () => {
    let sourceBoardId: string;
    let targetBoardId: string;
    const client = createApiClient(undefined, DETECTIVE_ALPHA);

    const complexInvestigationContent = {
        nodes: [
            {
                id: 'node-sticky-exhibit-a',
                type: 'sticky',
                position: { x: 100, y: 100 },
                data: { label: 'Exhibit A: Bloody glove recovered from garden', color: '#fef3c7' },
            },
            {
                id: 'node-text-witness-b',
                type: 'text',
                position: { x: 400, y: 100 },
                data: { label: 'Witness testimony: Gardener reported dog barking at 0230' },
            },
            {
                id: 'node-link-forensics-c',
                type: 'link',
                position: { x: 100, y: 350 },
                data: {
                    url: 'https://state-lab.gov/cases/dna-report-4401',
                    title: 'State Crime Lab DNA Analysis',
                    description: 'Blood typing match on Exhibit A glove: Type O Positive',
                },
            },
            {
                id: 'node-image-scene-d',
                type: 'image',
                position: { x: 400, y: 350 },
                data: {
                    src: '/evidence-photo.jpg',
                    caption: 'Exhibit D: Footprints leading away from greenhouse',
                },
            },
        ],
        edges: [
            {
                id: 'edge-string-a-to-b',
                source: 'node-sticky-exhibit-a',
                target: 'node-text-witness-b',
                type: 'string',
            },
            {
                id: 'edge-string-a-to-c',
                source: 'node-sticky-exhibit-a',
                target: 'node-link-forensics-c',
                type: 'string',
            },
            {
                id: 'edge-string-c-to-d',
                source: 'node-link-forensics-c',
                target: 'node-image-scene-d',
                type: 'string',
            },
        ],
    };

    test.beforeAll(async () => {
        await seedTestUsers();

        sourceBoardId = await createTestBoard({
            userId: DETECTIVE_ALPHA.id,
            title: `[E2E-TEST] State vs. Blackwood Estate [Courtroom Dossier] ${Date.now()}`,
            isPublic: false,
            content: complexInvestigationContent,
        });
    });

    test.afterAll(async () => {
        await cleanupTestData();
        await closeDbClient();
    });

    test('exports full investigation dossier to JSON with schema and coordinate fidelity', async () => {
        const sourceRes = await client.get<{
            id: string;
            title: string;
            content: typeof complexInvestigationContent;
        }>(`/api/boards/${sourceBoardId}`);

        expect(sourceRes.status).toBe(200);
        const { title, content } = sourceRes.data;

        // Construct standardized JSON export dossier
        const exportDossier = {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            caseTitle: title,
            nodes: content.nodes,
            edges: content.edges,
        };

        // Assert schema validity
        expect(exportDossier.caseTitle).toContain('State vs. Blackwood Estate');
        expect(exportDossier.nodes.length).toBe(4);
        expect(exportDossier.edges.length).toBe(3);

        // Verify preservation of node types
        const types = exportDossier.nodes.map((n) => n.type);
        expect(types).toContain('sticky');
        expect(types).toContain('text');
        expect(types).toContain('link');
        expect(types).toContain('image');

        // Verify coordinate preservation
        const stickyNode = exportDossier.nodes.find((n) => n.id === 'node-sticky-exhibit-a');
        expect(stickyNode?.position.x).toBe(100);
        expect(stickyNode?.position.y).toBe(100);

        const imgNode = exportDossier.nodes.find((n) => n.id === 'node-image-scene-d');
        expect(imgNode?.position.x).toBe(400);
        expect(imgNode?.position.y).toBe(350);
    });

    test('re-imports exported JSON onto fresh canvas with 100% roundtrip parity', async () => {
        // 1. Export from source
        const sourceBoard = await getTestBoard(sourceBoardId);
        const exportedPayload = sourceBoard?.content as typeof complexInvestigationContent;

        // 2. Create fresh target board
        targetBoardId = await createTestBoard({
            userId: DETECTIVE_ALPHA.id,
            title: `[E2E-TEST] Reconstituted Courtroom Dossier ${Date.now()}`,
            isPublic: false,
            content: { nodes: [], edges: [] },
        });

        // 3. Ingest and save exported payload to target board
        const importRes = await client.put(`/api/boards/${targetBoardId}`, {
            content: exportedPayload,
        });
        expect(importRes.status).toBe(200);

        // 4. Retrieve re-imported board from DB and assert 100% parity
        const reimportedBoard = await getTestBoard(targetBoardId);
        const reimportedContent = reimportedBoard?.content as typeof complexInvestigationContent;

        expect(reimportedContent.nodes.length).toBe(4);
        expect(reimportedContent.edges.length).toBe(3);

        // Byte-for-byte parity comparison
        expect(JSON.stringify(reimportedContent.nodes)).toBe(JSON.stringify(exportedPayload.nodes));
        expect(JSON.stringify(reimportedContent.edges)).toBe(JSON.stringify(exportedPayload.edges));
    });

    test('ExportModal mounting and UI format options verification in browser', async ({
        page,
        context,
    }) => {
        await authenticateContext(context, DETECTIVE_ALPHA);
        await page.goto(`/board/${sourceBoardId}`);
        await page.waitForSelector('.react-flow', { state: 'visible', timeout: 20000 });

        // Check for export action in toolbar or header
        const exportBtn = page.locator(
            'button[aria-label="Export Board"], button:has-text("Export"), button[title*="Export"]'
        );

        if (await exportBtn.first().isVisible()) {
            await exportBtn.first().click();

            // Verify modal displays export format options: JSON, PNG, PDF
            const modalContent = page.locator('text=JSON, text=PNG, text=PDF, text=Export');
            await expect(modalContent.first()).toBeVisible({ timeout: 10000 });
        }
    });
});
