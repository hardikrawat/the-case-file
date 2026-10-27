import { db } from '@/lib/db';
import { boards } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';

export const EXAMPLE_CASE_TITLE = 'Case #042: The Isabella Stewart Gardner Museum Heist';

export function getExampleCaseContent() {
    return {
        nodes: [
            // Row 1: The Breach & Masterpiece
            {
                id: 'clue-timeline',
                type: 'sticky',
                position: { x: 150, y: 100 },
                data: {
                    color: '#fef08a',
                    label: 'SECURITY TIMELINE (Mar 18, 1990):\n\n• 1:24 AM — Thieves disguised as police enter museum\n• 1:48 AM — Motion sensors triggered in Dutch Room\n• 2:45 AM — Thieves exit museum with 13 artworks\n• 8:15 AM — Next shift arrives, finds guards tied up',
                },
            },
            {
                id: 'clue-incident',
                type: 'text',
                position: { x: 750, y: 100 },
                data: {
                    label: 'FBI INCIDENT REPORT: Isabella Stewart Gardner Museum Theft\nDate: March 18, 1990\nLocation: Boston, Massachusetts\n\nTwo men dressed in Boston police uniforms gained entry by telling the guard they were responding to a disturbance. They handcuffed both guards in the basement. Total stolen value estimated at $500 million, the largest private property theft in history.',
                },
            },
            {
                id: 'evidence-masterpiece',
                type: 'image',
                position: { x: 1400, y: 100 },
                data: {
                    src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Rembrandt_Christ_in_the_Storm_on_the_Lake_of_Galilee.jpg',
                    caption: 'EXHIBIT A: "The Storm on the Sea of Galilee" (Rembrandt, 1633) - His only seascape. STOLEN.',
                },
            },

            // Row 2: Secondary Evidence & Reports
            {
                id: 'link-fbi',
                type: 'link',
                position: { x: 500, y: 550 },
                data: {
                    url: 'https://www.fbi.gov/investigate/violent-crime/art-theft/isabella-stewart-gardner-museum-theft',
                    title: 'FBI: Isabella Stewart Gardner Museum Theft',
                    description: 'Official FBI Art Theft Program page detailing the $5 million reward for information leading to the recovery of the stolen works.',
                    image: '/evidence/interpol-art-theft.svg',
                    favicon: '/globe.svg',
                },
            },
            {
                id: 'article-wiki',
                type: 'article',
                position: { x: 950, y: 550 },
                data: {
                    title: 'Wikipedia: Isabella Stewart Gardner Museum theft',
                    url: 'https://en.wikipedia.org/wiki/Isabella_Stewart_Gardner_Museum_theft',
                    description: 'Comprehensive overview of the heist, the stolen artworks, and the ongoing decades-long investigation.',
                    date: 'March 18, 1990',
                    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cf/Empty_frames_at_the_Isabella_Stewart_Gardner_Museum_01.jpg/800px-Empty_frames_at_the_Isabella_Stewart_Gardner_Museum_01.jpg',
                },
            },
            {
                id: 'evidence-frames',
                type: 'image',
                position: { x: 1400, y: 550 },
                data: {
                    src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cf/Empty_frames_at_the_Isabella_Stewart_Gardner_Museum_01.jpg/800px-Empty_frames_at_the_Isabella_Stewart_Gardner_Museum_01.jpg',
                    caption: 'EXHIBIT B: Empty frames remain hanging in the museum as a placeholder and memorial.',
                },
            },

            // Row 3: Surveillance & Prime Suspects
            {
                id: 'suspect-abath',
                type: 'sticky',
                position: { x: 150, y: 550 },
                data: {
                    color: '#fca5a5',
                    label: 'SUSPECT 1: Richard Abath\nRole: Night Guard\n\n• Broke protocol by opening the door to the "officers"\n• Opened side door at 12:54 AM prior to heist (claims he was checking for snow)\n• Passed lie detector tests; denied involvement.',
                },
            },
            {
                id: 'suspect-merlino',
                type: 'sticky',
                position: { x: 1400, y: 1050 },
                data: {
                    color: '#bfdbfe',
                    label: 'SUSPECT 2: Carmello Merlino\nRole: Mobster (TRC Auto Electric)\n\n• Informant told FBI Merlino was attempting to broker the return of the Rembrandt for the reward.\n• Never formally charged; died in prison in 2005.',
                },
            },
            {
                id: 'suspect-gentile',
                type: 'sticky',
                position: { x: 950, y: 1050 },
                data: {
                    color: '#e9d5ff',
                    label: 'SUSPECT 3: Robert Gentile\nRole: Mobster\n\n• FBI raid of his home found a handwritten list of the stolen paintings with black market prices.\n• Claims he was framed; denied knowledge of the heist.',
                },
            },

            // Row 4: Forensics & Contradictions
            {
                id: 'contradiction-door',
                type: 'text',
                position: { x: -250, y: 1050 },
                data: {
                    label: 'CRITICAL ANOMALY: The Side Door\n\nGuard Richard Abath opened the museum\'s side door at 12:54 AM, briefly stepping outside. He claimed he was checking the weather for snow. This action was highly irregular and suspect, potentially signaling the thieves that the coast was clear.',
                },
            },
            {
                id: 'intel-motion',
                type: 'text',
                position: { x: 550, y: 1050 },
                data: {
                    label: 'SENSOR CONTRADICTION: MacKnight Room\n\nA painting (Manet\'s Chez Tortoni) was stolen from the MacKnight Room on the first floor. However, the motion sensors in that room NEVER triggered during the 81 minutes the thieves were inside. Who took it?',
                },
            },
            {
                id: 'evidence-duct-tape',
                type: 'sticky',
                position: { x: 150, y: 1500 },
                data: {
                    color: '#bbf7d0',
                    label: 'PHYSICAL EVIDENCE: Duct Tape & Handcuffs\n\nGuards were bound with duct tape. Decades later, advanced DNA testing was attempted on the tape and handcuffs, but the results were inconclusive or too degraded.',
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
                data: { label: 'stolen artwork' },
                style: { stroke: '#ef4444', strokeWidth: 3 },
            },
            {
                id: 'edge-incident-wiki',
                source: 'clue-incident',
                target: 'article-wiki',
                type: 'string',
                animated: false,
                data: { label: 'case overview' },
                style: { stroke: '#f59e0b', strokeWidth: 2 },
            },
            {
                id: 'edge-incident-timeline',
                source: 'clue-incident',
                target: 'clue-timeline',
                type: 'string',
                animated: false,
                data: { label: 'sequence of events' },
                style: { stroke: '#3b82f6', strokeWidth: 2 },
            },
            {
                id: 'edge-fbi-wiki',
                source: 'link-fbi',
                target: 'article-wiki',
                type: 'string',
                animated: false,
                data: { label: 'official vs public record' },
                style: { stroke: '#a855f7', strokeWidth: 2 },
            },
            {
                id: 'edge-masterpiece-frames',
                source: 'evidence-masterpiece',
                target: 'evidence-frames',
                type: 'string',
                animated: false,
                data: { label: 'cut from frames' },
                style: { stroke: '#ef4444', strokeWidth: 3 },
            },
            {
                id: 'edge-timeline-abath',
                source: 'clue-timeline',
                target: 'suspect-abath',
                type: 'string',
                animated: false,
                data: { label: 'guard on duty' },
                style: { stroke: '#ef4444', strokeWidth: 3 },
            },
            {
                id: 'edge-abath-door',
                source: 'suspect-abath',
                target: 'contradiction-door',
                type: 'string',
                animated: false,
                data: { label: 'suspicious behavior' },
                style: { stroke: '#f59e0b', strokeWidth: 3 },
            },
            {
                id: 'edge-abath-motion',
                source: 'suspect-abath',
                target: 'intel-motion',
                type: 'string',
                animated: false,
                data: { label: 'did he take the Manet?' },
                style: { stroke: '#3b82f6', strokeWidth: 2 },
            },
            {
                id: 'edge-abath-tape',
                source: 'suspect-abath',
                target: 'evidence-duct-tape',
                type: 'string',
                animated: false,
                data: { label: 'bound in basement' },
                style: { stroke: '#10b981', strokeWidth: 2 },
            },
            {
                id: 'edge-merlino-gentile',
                source: 'suspect-merlino',
                target: 'suspect-gentile',
                type: 'string',
                animated: false,
                data: { label: 'mob associates' },
                style: { stroke: '#ef4444', strokeWidth: 2 },
            },
            {
                id: 'edge-wiki-gentile',
                source: 'article-wiki',
                target: 'suspect-gentile',
                type: 'string',
                animated: false,
                data: { label: 'price list discovered' },
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
