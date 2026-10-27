import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  
  if (!url || !authToken) {
    console.error('Missing TURSO credentials');
    process.exit(1);
  }

  const client = createClient({ url, authToken });
  
  try {
    console.log('Adding last_analysis column to detective_sessions...');
    await client.execute(`ALTER TABLE detective_sessions ADD COLUMN last_analysis text;`);
    console.log('Success!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    client.close();
  }
}

main();
