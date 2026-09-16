import { db } from '@/lib/db';
import { boards } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';

export const EXAMPLE_CASE_TITLE = 'Case #042: The Midnight Gallery Heist';

export function getExampleCaseContent() {
    return {
        nodes: [
            {
                id: 'clue-incident',
                type: 'text',
                position: { x: 80, y: 80 },
                data: {
                    label: 'INCIDENT REPORT: The Florentine Shadow\nCase #042: Grand Larceny\nDate: Oct 14, 01:15 AM\nLocation: Blackwood Private Gallery, East Wing\n\nPriceless Renaissance oil painting removed from frame. Vault door unlocked via electronic override. Laser alarm system was powered off from the security desk at 01:08 AM. No forced entry detected at exterior entrances until rear fire exit at 01:25 AM.',
                },
            },
            {
                id: 'clue-keycard',
                type: 'sticky',
                position: { x: 550, y: 80 },
                data: {
                    color: '#fef08a',
                    label: 'KEYCARD ACCESS LOG (Oct 14):\n\n• 01:05 AM — Card #08 (Guard Vance: Entered East Wing)\n• 01:08 AM — Security Terminal: Laser grid disabled\n• 01:12 AM — Card #14 (Dr. Ross: Vault Access)\n• 01:25 AM — Fire Exit #3 Forced Open',
                },
            },
            {
                id: 'suspect-vance',
                type: 'sticky',
                position: { x: 80, y: 380 },
                data: {
                    color: '#fca5a5',
                    label: 'SUSPECT 1: Marcus Vance\nRole: Lead Night Guard\n\n• Swiped into East Wing at 01:05 AM\n• Claims he was patrolling Basement B\n• Hallway 3 CCTV camera disabled 01:00-01:22 AM\n• Motive: Severe gambling debt ($85,000) with loan sharks',
                },
            },
            {
                id: 'suspect-ross',
                type: 'sticky',
                position: { x: 550, y: 380 },
                data: {
                    color: '#bfdbfe',
                    label: 'SUSPECT 2: Dr. Eleanor Ross\nRole: Head Curator\n\n• Her personal Card #14 opened the vault at 01:12 AM\n• Vocal opponent of museum board overseas auction\n• Alibi: Claims she was having drinks at The Gilded Drake 3 miles away',
                },
            },
            {
                id: 'evidence-fabric',
                type: 'sticky',
                position: { x: 950, y: 380 },
                data: {
                    color: '#bbf7d0',
                    label: 'PHYSICAL EVIDENCE: Torn Fabric\n\nRecovered from Fire Exit #3 door latch.\nLab analysis: Navy blue wool with gold synthetic trim.\nMatches standard-issue Blackwood Security winter uniform.',
                },
            },
            {
                id: 'intel-wire',
                type: 'text',
                position: { x: 80, y: 680 },
                data: {
                    label: 'FINANCIAL INTELLIGENCE: Wire Transfer #ZUR-9941\n\n$50,000 deposited into an offshore shell account registered to "M. V. Logistics" (alias tied to Vance) on Oct 12, exactly 48 hours prior to the heist.',
                },
            },
            {
                id: 'contradiction-alibi',
                type: 'text',
                position: { x: 550, y: 680 },
                data: {
                    label: 'CRITICAL ALIBI CONTRADICTION:\n\nCurator Ross provided a verified credit card receipt timestamped 01:18 AM at The Gilded Drake.\nHer Card #14 swiped at the gallery vault at 01:12 AM.\nDriving time between locations in torrential rain is 14+ minutes.\nConclusion: Ross could NOT have swiped Card #14. Her card was cloned or taken from her desk before midnight!',
                },
            },
        ],
        edges: [
            {
                id: 'edge-incident-keycard',
                source: 'clue-incident',
                target: 'clue-keycard',
                type: 'string',
                animated: false,
                data: { label: 'logs override' },
                style: { stroke: '#ef4444', strokeWidth: 2 },
            },
            {
                id: 'edge-keycard-vance',
                source: 'clue-keycard',
                target: 'suspect-vance',
                type: 'string',
                animated: false,
                data: { label: 'swiped 01:05 AM' },
                style: { stroke: '#ef4444', strokeWidth: 2 },
            },
            {
                id: 'edge-vance-wire',
                source: 'suspect-vance',
                target: 'intel-wire',
                type: 'string',
                animated: false,
                data: { label: 'bribe payment' },
                style: { stroke: '#f59e0b', strokeWidth: 2 },
            },
            {
                id: 'edge-vance-fabric',
                source: 'suspect-vance',
                target: 'evidence-fabric',
                type: 'string',
                animated: false,
                data: { label: 'uniform fiber match' },
                style: { stroke: '#ef4444', strokeWidth: 3 },
            },
            {
                id: 'edge-keycard-ross',
                source: 'clue-keycard',
                target: 'suspect-ross',
                type: 'string',
                animated: false,
                data: { label: 'Card #14 swiped' },
                style: { stroke: '#60a5fa', strokeWidth: 2 },
            },
            {
                id: 'edge-ross-contradiction',
                source: 'suspect-ross',
                target: 'contradiction-alibi',
                type: 'string',
                animated: false,
                data: { label: 'impossible travel time' },
                style: { stroke: '#ef4444', strokeWidth: 3 },
            },
            {
                id: 'edge-vance-contradiction',
                source: 'suspect-vance',
                target: 'contradiction-alibi',
                type: 'string',
                animated: false,
                data: { label: 'had master key access' },
                style: { stroke: '#f59e0b', strokeWidth: 2 },
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
