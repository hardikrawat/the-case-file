import { db } from '../src/lib/db';
import { notifications, users } from '../src/lib/schema';
import { createId } from '@paralleldrive/cuid2';
import { eq } from 'drizzle-orm';

async function main() {
    const user = await db.select().from(users).where(eq(users.email, 'detective@casefile.test')).limit(1);
    if (user.length === 0) {
        console.log('Test user not found');
        return;
    }
    const userId = user[0].id;

    // Check existing notifications
    const existing = await db.select().from(notifications).where(eq(notifications.recipientId, userId));
    if (existing.length === 0) {
        console.log('Seeding notifications for test detective...');
        await db.insert(notifications).values([
            {
                id: createId(),
                recipientId: userId,
                actorId: userId,
                type: 'contribution',
                referenceId: 'e2209gke2x2e3pr9pqdkc71u',
                referenceType: 'board',
                message: "Detective Watson proposed 2 new evidence nodes on 'The Blackwood Mansion Mystery'",
                isRead: false,
                createdAt: new Date(),
            },
            {
                id: createId(),
                recipientId: userId,
                actorId: userId,
                type: 'reputation',
                referenceId: 'e2209gke2x2e3pr9pqdkc71u',
                referenceType: 'board',
                message: "Commendation: You have been promoted to Chief Detective with 1,250 points!",
                isRead: false,
                createdAt: new Date(Date.now() - 3600000),
            }
        ]);
        console.log('✅ 2 notifications seeded successfully');
    } else {
        console.log(`User already has ${existing.length} notifications`);
    }
}

main().catch(console.error);
