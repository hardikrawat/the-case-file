import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@libsql/client';

async function main() {
    console.log('Connecting to Turso...');
    const client = createClient({
        url: process.env.TURSO_DATABASE_URL!,
        authToken: process.env.TURSO_AUTH_TOKEN,
    });

    const columnsToAdd = [
        "ALTER TABLE contributions ADD COLUMN updated_at integer DEFAULT (strftime('%s', 'now'));",
        "ALTER TABLE contributions ADD COLUMN created_at integer DEFAULT (strftime('%s', 'now'));"
    ];

    for (const query of columnsToAdd) {
        try {
            console.log(`Executing: ${query}`);
            await client.execute(query);
            console.log("✅ Success");
        } catch (e: any) {
            if (e.message.includes('duplicate column name')) {
                 console.log("✅ Column already exists, skipping.");
            } else {
                 console.error("❌ Error:", e.message);
            }
        }
    }
    process.exit(0);
}

main();
