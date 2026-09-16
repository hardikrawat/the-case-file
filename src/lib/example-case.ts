import { db } from '@/lib/db';
import { boards } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';

export const EXAMPLE_CASE_TITLE = 'Case #042: The Midnight Gallery Heist';

export function getExampleCaseContent() {
    return {
        nodes: [
            // Row 1: The Breach & Masterpiece
            {
                id: 'clue-incident',
                type: 'text',
                position: { x: 60, y: 60 },
                data: {
                    label: 'INCIDENT REPORT: The Florentine Shadow\nCase #042: Grand Larceny\nDate: Oct 14, 01:15 AM\nLocation: Blackwood Private Gallery, East Wing\n\nPriceless Renaissance oil painting removed from frame. Vault door unlocked via electronic override. Laser alarm system was powered off from the security desk at 01:08 AM. No forced entry detected at exterior entrances until rear fire exit at 01:25 AM.',
                },
            },
            {
                id: 'evidence-masterpiece',
                type: 'image',
                position: { x: 440, y: 60 },
                data: {
                    src: '/evidence/florentine-shadow.svg',
                    caption: 'EXHIBIT A: "The Florentine Shadow" (Matteo da Milano, 1512) - STOLEN ITEM',
                },
            },
            {
                id: 'article-chronicle',
                type: 'article',
                position: { x: 760, y: 60 },
                data: {
                    title: 'THE DAILY CHRONICLE: $12M Masterpiece Vanishes In Midnight Heist',
                    url: 'https://daily-chronicle.news/archive/blackwood-gallery-heist',
                    description: 'Police suspect an inside job after the legendary 16th-century painting was cleanly extracted from its climate-controlled vault without triggering alarms.',
                    date: 'Oct 15, 2024',
                    image: '/evidence/newspaper-heist.svg',
                },
            },
            {
                id: 'clue-keycard',
                type: 'sticky',
                position: { x: 1120, y: 60 },
                data: {
                    color: '#fef08a',
                    label: 'KEYCARD ACCESS LOG (Oct 14):\n\n• 01:05 AM — Card #08 (Guard Vance: Entered East Wing)\n• 01:08 AM — Security Terminal: Laser grid disabled\n• 01:12 AM — Card #14 (Dr. Ross: Vault Access)\n• 01:25 AM — Fire Exit #3 Forced Open',
                },
            },

            // Row 2: Surveillance & Prime Suspects
            {
                id: 'evidence-cctv',
                type: 'image',
                position: { x: 60, y: 560 },
                data: {
                    src: '/evidence/cctv-vault.svg',
                    caption: 'EXHIBIT B: Cam-04 still at 01:08 AM. Guard uniform at security console during laser override.',
                },
            },
            {
                id: 'suspect-vance',
                type: 'sticky',
                position: { x: 400, y: 560 },
                data: {
                    color: '#fca5a5',
                    label: 'SUSPECT 1: Marcus Vance\nRole: Lead Night Guard\n\n• Swiped into East Wing at 01:05 AM\n• Claims he was patrolling Basement B\n• Hallway 3 CCTV disabled 01:00-01:22 AM\n• Motive: Severe gambling debt ($85,000) with loan sharks',
                },
            },
            {
                id: 'suspect-ross',
                type: 'sticky',
                position: { x: 720, y: 560 },
                data: {
                    color: '#bfdbfe',
                    label: 'SUSPECT 2: Dr. Eleanor Ross\nRole: Head Curator\n\n• Her personal Card #14 opened the vault at 01:12 AM\n• Vocal opponent of museum board overseas auction\n• Alibi: Drinking at The Gilded Drake 3.2 miles away (verified by bar staff)',
                },
            },
            {
                id: 'link-interpol',
                type: 'link',
                position: { x: 1040, y: 560 },
                data: {
                    url: 'https://interpol.int/art-theft-database/record-49210',
                    title: 'INTERPOL: Global Stolen Works of Art Alert #49210',
                    description: 'Active Red Notice for "The Florentine Shadow". Port authority and border crossings alerted for illicit cross-border smuggling attempt.',
                    image: '/evidence/interpol-art-theft.svg',
                    favicon: '/globe.svg',
                },
            },

            // Row 3: Forensics & Contradictions
            {
                id: 'evidence-fabric',
                type: 'sticky',
                position: { x: 60, y: 1020 },
                data: {
                    color: '#bbf7d0',
                    label: 'PHYSICAL EVIDENCE: Torn Fabric\n\nRecovered from rear Fire Exit #3 door latch.\nLab analysis: Navy blue wool with gold synthetic trim.\nMatches standard-issue Blackwood Security winter uniform.',
                },
            },
            {
                id: 'intel-wire',
                type: 'text',
                position: { x: 380, y: 1020 },
                data: {
                    label: 'FINANCIAL INTELLIGENCE: Wire Transfer #ZUR-9941\n\n$50,000 deposited into an offshore shell account registered to "M. V. Logistics" (alias tied to Vance) on Oct 12, exactly 48 hours prior to the heist.',
                },
            },
            {
                id: 'contradiction-alibi',
                type: 'text',
                position: { x: 780, y: 1020 },
                data: {
                    label: 'CRITICAL ALIBI CONTRADICTION:\n\nCurator Ross provided a verified credit card receipt timestamped 01:18 AM at The Gilded Drake.\nHer Card #14 swiped at the gallery vault at 01:12 AM.\nDriving time between locations in torrential rain is 14+ minutes.\nConclusion: Ross could NOT have swiped Card #14. Her card was cloned or taken from her desk before midnight!',
                },
            },
            {
                id: 'clue-locksmith',
                type: 'sticky',
                position: { x: 1220, y: 1020 },
                data: {
                    color: '#e9d5ff',
                    label: 'FORENSIC LOCKSMITH REPORT:\n\nElectronic keycard reader shows micro-scratches consistent with a magnetic skimmer/cloning device deployed between 18:00 and 21:00 on Oct 13.',
                },
            },
        ],
        edges: [
            {
                id: 'edge-incident-masterpiece',
                source: 'clue-incident',
                target: 'evidence-masterpiece',
                type: 'string',
                animated: false,
                data: { label: 'target of heist' },
                style: { stroke: '#ef4444', strokeWidth: 3 },
            },
            {
                id: 'edge-incident-chronicle',
                source: 'clue-incident',
                target: 'article-chronicle',
                type: 'string',
                animated: false,
                data: { label: 'breaking news leak' },
                style: { stroke: '#f59e0b', strokeWidth: 2 },
            },
            {
                id: 'edge-incident-keycard',
                source: 'clue-incident',
                target: 'clue-keycard',
                type: 'string',
                animated: false,
                data: { label: 'electronic override logs' },
                style: { stroke: '#ef4444', strokeWidth: 2 },
            },
            {
                id: 'edge-masterpiece-interpol',
                source: 'evidence-masterpiece',
                target: 'link-interpol',
                type: 'string',
                animated: false,
                data: { label: 'interpol red notice alert' },
                style: { stroke: '#3b82f6', strokeWidth: 2 },
            },
            {
                id: 'edge-keycard-cctv',
                source: 'clue-keycard',
                target: 'evidence-cctv',
                type: 'string',
                animated: false,
                data: { label: 'timestamp match 01:08 AM' },
                style: { stroke: '#ef4444', strokeWidth: 3 },
            },
            {
                id: 'edge-cctv-vance',
                source: 'evidence-cctv',
                target: 'suspect-vance',
                type: 'string',
                animated: false,
                data: { label: 'uniform match on camera' },
                style: { stroke: '#ef4444', strokeWidth: 3 },
            },
            {
                id: 'edge-keycard-vance',
                source: 'clue-keycard',
                target: 'suspect-vance',
                type: 'string',
                animated: false,
                data: { label: 'swiped into wing 01:05 AM' },
                style: { stroke: '#ef4444', strokeWidth: 2 },
            },
            {
                id: 'edge-keycard-ross',
                source: 'clue-keycard',
                target: 'suspect-ross',
                type: 'string',
                animated: false,
                data: { label: 'Card #14 swiped at vault' },
                style: { stroke: '#3b82f6', strokeWidth: 2 },
            },
            {
                id: 'edge-vance-wire',
                source: 'suspect-vance',
                target: 'intel-wire',
                type: 'string',
                animated: false,
                data: { label: '$50k bribe payment' },
                style: { stroke: '#ef4444', strokeWidth: 3 },
            },
            {
                id: 'edge-vance-fabric',
                source: 'suspect-vance',
                target: 'evidence-fabric',
                type: 'string',
                animated: false,
                data: { label: 'wool fiber match at exit #3' },
                style: { stroke: '#10b981', strokeWidth: 3 },
            },
            {
                id: 'edge-ross-contradiction',
                source: 'suspect-ross',
                target: 'contradiction-alibi',
                type: 'string',
                animated: false,
                data: { label: 'receipt proves card cloned' },
                style: { stroke: '#3b82f6', strokeWidth: 3 },
            },
            {
                id: 'edge-vance-contradiction',
                source: 'suspect-vance',
                target: 'contradiction-alibi',
                type: 'string',
                animated: false,
                data: { label: 'had master desk access' },
                style: { stroke: '#f59e0b', strokeWidth: 2 },
            },
            {
                id: 'edge-keycard-locksmith',
                source: 'clue-keycard',
                target: 'clue-locksmith',
                type: 'string',
                animated: false,
                data: { label: 'skimmer scratch marks' },
                style: { stroke: '#a855f7', strokeWidth: 2 },
            },
        ],
    };
}

/**
 * Ensures an example investigation board exists for the given user.
 * Called automatically during signup and on first dashboard visit.
 */
export async function createExampleBoard(userId: string): Promise<string | null> {
    try {
        // Check if user already has an example board
        const existing = await db.query.boards.findFirst({
            where: and(
                eq(boards.userId, userId),
                eq(boards.title, EXAMPLE_CASE_TITLE)
            ),
        });

        if (existing) {
            // Auto-upgrade legacy 7-node boards to the full multi-component showcase
            const existingContent = existing.content as { nodes?: unknown[] } | null;
            if (existingContent && Array.isArray(existingContent.nodes) && existingContent.nodes.length < 10) {
                await db.update(boards).set({
                    content: getExampleCaseContent(),
                    updatedAt: new Date(),
                }).where(eq(boards.id, existing.id));
            }
            return existing.id;
        }

        const boardId = createId();
        await db.insert(boards).values({
            id: boardId,
            userId,
            title: EXAMPLE_CASE_TITLE,
            isPublic: false,
            content: getExampleCaseContent(),
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        return boardId;
    } catch (error) {
        console.error('Failed to create example board:', error);
        return null;
    }
}

/**
 * Synchronizes and updates all existing example boards in Turso to use the full component showcase.
 */
export async function syncAllExampleBoards(): Promise<number> {
    try {
        const exampleBoards = await db.query.boards.findMany({
            where: eq(boards.title, EXAMPLE_CASE_TITLE),
        });
        const updatedContent = getExampleCaseContent();
        for (const b of exampleBoards) {
            await db.update(boards).set({
                content: updatedContent,
                updatedAt: new Date(),
            }).where(eq(boards.id, b.id));
        }
        return exampleBoards.length;
    } catch (error) {
        console.error('Failed to sync example boards:', error);
        return 0;
    }
}
