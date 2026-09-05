import { db } from '../src/lib/db';
import { users, userReputation, boards } from '../src/lib/schema';
import { hashPassword } from '../src/lib/password';
import { createId } from '@paralleldrive/cuid2';
import { eq } from 'drizzle-orm';

async function main() {
    const testEmail = 'detective@casefile.test';
    const testPassword = 'Password123!';
    const testName = 'Detective Sherlock';

    console.log(`Checking if user ${testEmail} exists in Turso DB...`);
    const existing = await db.select().from(users).where(eq(users.email, testEmail)).limit(1);

    let userId: string;
    const passwordHash = await hashPassword(testPassword);

    if (existing.length > 0) {
        userId = existing[0].id;
        console.log(`Updating existing test user ${userId}...`);
        await db.update(users).set({
            name: testName,
            passwordHash,
            emailVerifiedFlag: true,
        }).where(eq(users.id, userId));
    } else {
        userId = createId();
        console.log(`Creating new test user ${userId}...`);
        await db.insert(users).values({
            id: userId,
            name: testName,
            email: testEmail,
            passwordHash,
            emailVerifiedFlag: true,
            createdAt: new Date(),
        });
    }

    // Upsert Reputation (1250 points -> Chief Detective)
    console.log(`Setting reputation for user ${userId}...`);
    const repExisting = await db.select().from(userReputation).where(eq(userReputation.userId, userId)).limit(1);
    if (repExisting.length > 0) {
        await db.update(userReputation).set({
            points: 1250,
            boardsCreated: 3,
            contributionsAccepted: 5,
            lastUpdated: new Date(),
        }).where(eq(userReputation.userId, userId));
    } else {
        await db.insert(userReputation).values({
            userId,
            points: 1250,
            boardsCreated: 3,
            contributionsAccepted: 5,
            lastUpdated: new Date(),
        });
    }

    // Check if user has an initial test case board
    const userBoards = await db.select().from(boards).where(eq(boards.userId, userId)).limit(1);
    if (userBoards.length === 0) {
        console.log(`Creating sample investigation case for ${userId}...`);
        const boardId = createId();
        await db.insert(boards).values({
            id: boardId,
            userId,
            title: 'The Blackwood Mansion Mystery',
            isPublic: true,
            version: 1,
            content: {
                nodes: [
                    {
                        id: 'node-1',
                        type: 'sticky',
                        position: { x: 100, y: 150 },
                        data: {
                            text: 'Victim found in study at 23:00. Watch broken, stopped at 22:42.',
                            color: 'yellow',
                        },
                    },
                    {
                        id: 'node-2',
                        type: 'text',
                        position: { x: 450, y: 100 },
                        data: {
                            text: 'KEY SUSPECT: Lord Blackwood (Missing since midnight)',
                        },
                    },
                    {
                        id: 'node-3',
                        type: 'link',
                        position: { x: 300, y: 350 },
                        data: {
                            url: 'https://en.wikipedia.org/wiki/Sherlock_Holmes',
                            title: 'Forensic Dossier Archive',
                            description: 'External archive evidence reference on suspect background.',
                        },
                    },
                ],
                edges: [
                    {
                        id: 'e-node-1-node-2',
                        source: 'node-1',
                        target: 'node-2',
                        type: 'string',
                    },
                    {
                        id: 'e-node-2-node-3',
                        source: 'node-2',
                        target: 'node-3',
                        type: 'string',
                    },
                ],
            },
            createdAt: new Date(),
            updatedAt: new Date(),
        });
        console.log(`Created sample board: ${boardId}`);
    }

    console.log('✅ Test user created & verified successfully in Turso DB!');
}

main().catch((err) => {
    console.error('Failed to create test user:', err);
    process.exit(1);
});
