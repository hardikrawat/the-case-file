import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

if (!process.env.TURSO_DATABASE_URL) {
    throw new Error('[CRITICAL] TURSO_DATABASE_URL is missing in drizzle.config.ts. Ensure .env.local is populated.');
}

export default defineConfig({
    schema: './src/lib/schema.ts',
    out: './drizzle',
    dialect: 'turso',
    dbCredentials: {
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN,
    },
});
