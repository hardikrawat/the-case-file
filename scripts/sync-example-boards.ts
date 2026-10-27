import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Dynamic import to ensure dotenv is loaded first
async function main() {
    console.log('Syncing example boards...');
    const { syncAllExampleBoards } = await import('../src/lib/example-case');
    const count = await syncAllExampleBoards();
    console.log(`Synced ${count} example boards.`);
    process.exit(0);
}

main();
