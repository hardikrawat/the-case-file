import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
    const { db } = await import('../src/lib/db');
    const { users } = await import('../src/lib/schema');
    const { eq } = await import('drizzle-orm');

    const email = 'detective@casefile.test';
    console.log(`Locating user with email: ${email}...`);
    
    const user = await db.query.users.findFirst({
        where: eq(users.email, email),
    });

    if (!user) {
        console.error('User not found!');
        process.exit(1);
    }

    console.log(`Found user! ID: ${user.id}. Deleting...`);
    
    // This will trigger cascade deletes on boards, accounts, sessions, detective_sessions, etc.
    await db.delete(users).where(eq(users.id, user.id));

    console.log('User and all associated data have been completely deleted.');
    process.exit(0);
}

main();
