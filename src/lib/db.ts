import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

let client: ReturnType<typeof createClient>;
let db: ReturnType<typeof drizzle<typeof schema>>;

if (typeof window === 'undefined') {
    if (!url || url.trim() === '') {
        throw new Error(
            '[CRITICAL] TURSO_DATABASE_URL is missing. In-memory SQLite fallback (:memory:) is strictly prohibited. Configure TURSO_DATABASE_URL in .env.local.'
        );
    }

    if (url === ':memory:') {
        throw new Error(
            '[CRITICAL] In-memory SQLite database (:memory:) is strictly prohibited. Configure a valid remote Turso database URL in .env.local.'
        );
    }

    const isRemote = url.startsWith('libsql://') || url.startsWith('https://') || url.startsWith('wss://');

    if (isRemote && (!authToken || authToken.trim() === '')) {
        throw new Error(
            `[CRITICAL] TURSO_AUTH_TOKEN is required to connect to remote Turso DB at ${url}. Configure TURSO_AUTH_TOKEN in .env.local.`
        );
    }

    client = createClient({
        url,
        authToken,
    });

    db = drizzle(client, { schema });
} else {
    // Client-side stub to prevent browser bundle crashes
    client = {} as ReturnType<typeof createClient>;
    db = {} as ReturnType<typeof drizzle<typeof schema>>;
}

export { client, db };
