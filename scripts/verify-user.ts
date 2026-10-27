import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
    const { db } = await import('../src/lib/db');
    const { users } = await import('../src/lib/schema');
    const { eq } = await import('drizzle-orm');

    const email = 'xaxaj61354@findize.com';
    console.log(`Locating user with email: ${email}...`);
    
    const user = await db.query.users.findFirst({
        where: eq(users.email, email),
    });

    if (!user) {
        console.error('User not found!');
        process.exit(1);
    }

    console.log(`Found user! ID: ${user.id}. Verifying email manually...`);
    
    await db.update(users)
        .set({ emailVerifiedFlag: true })
        .where(eq(users.id, user.id));

    console.log('User has been manually verified in the database!');
    process.exit(0);
}

main();
