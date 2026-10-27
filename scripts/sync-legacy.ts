import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
    const { getExampleCaseContent, EXAMPLE_CASE_TITLE } = await import('../src/lib/example-case');
    const { db } = await import('../src/lib/db');
    const { boards } = await import('../src/lib/schema');
    const { eq, or } = await import('drizzle-orm');

    console.log('Syncing old example boards...');
    const exampleBoards = await db.query.boards.findMany({
        where: or(
            eq(boards.title, 'Case #042: The Midnight Gallery Heist'),
            eq(boards.title, EXAMPLE_CASE_TITLE)
        ),
    });
    
    const updatedContent = getExampleCaseContent();
    let count = 0;
    
    for (const b of exampleBoards) {
        await db.update(boards).set({
            title: EXAMPLE_CASE_TITLE,
            content: updatedContent,
            updatedAt: new Date(),
        }).where(eq(boards.id, b.id));
        count++;
    }
    
    console.log(`Synced ${count} example boards to the new Isabella Gardner case.`);
    process.exit(0);
}

main();
