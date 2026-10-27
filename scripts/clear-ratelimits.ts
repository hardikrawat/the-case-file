import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
    const { db } = await import('../src/lib/db');
    const { rateLimits } = await import('../src/lib/schema');

    console.log('Clearing rate limits...');
    await db.delete(rateLimits);
    console.log('Rate limits cleared successfully.');
    
    process.exit(0);
}

main();
