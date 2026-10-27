import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
    const { db } = await import('../src/lib/db');
    const { users } = await import('../src/lib/schema');
    const { hashPassword } = await import('../src/lib/password');
    const { createId } = await import('@paralleldrive/cuid2');
    const { createExampleBoard } = await import('../src/lib/example-case');

    const email = 'test@example.com';
    const plainPassword = 'password123';
    
    console.log(`Creating test user with email: ${email}...`);
    
    const passwordHash = await hashPassword(plainPassword);
    const userId = createId();

    await db.insert(users).values({
        id: userId,
        name: 'Test Agent',
        email,
        passwordHash,
        emailVerifiedFlag: true, // Already verified!
        createdAt: new Date(),
    });

    console.log('Generating initial example case for the test user...');
    await createExampleBoard(userId);

    console.log('----------------------------------------');
    console.log('✅ Test user successfully created!');
    console.log(`Email:    ${email}`);
    console.log(`Password: ${plainPassword}`);
    console.log('----------------------------------------');
    
    process.exit(0);
}

main();
