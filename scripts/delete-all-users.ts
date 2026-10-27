import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
    const { db } = await import('../src/lib/db');
    const { users } = await import('../src/lib/schema');
    const { count } = await import('drizzle-orm');

    console.log('Counting existing users...');
    
    const userCountResult = await db.select({ value: count() }).from(users);
    const userCount = userCountResult[0].value;

    console.log(`Found ${userCount} users. Deleting ALL users...`);
    
    // Delete all users. Due to CASCADE, this wipes out boards, sessions, etc.
    await db.delete(users);

    console.log(`Successfully deleted all ${userCount} users and their associated data (cases, sessions, rep, etc).`);
    process.exit(0);
}

main();
