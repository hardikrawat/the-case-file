# Milestone 1 — Database Cloud Persistence & Schema Integrity Investigation Report

**Agent**: Explorer 1 (`teamwork_preview_explorer_m1_1`)  
**Parent**: `sub_orch_m1` (`dbefc965-e54e-4106-b236-b0c2e5c3d7ae`)  
**Scope**: Milestone 1 (Turso DB Cloud Persistence, Fail-Fast Client, Environment Configuration, Script Tooling)  
**Date**: 2026-09-04  

---

## 1. Observation

### 1.1 Existing Database Client (`src/lib/db.ts`)
Direct inspection of `/Users/hardikrawat/Documents/the-case-file/src/lib/db.ts` reveals:
```typescript
1: import { createClient } from '@libsql/client';
2: import { drizzle } from 'drizzle-orm/libsql';
3: import * as schema from './schema';
4: 
5: const url = process.env.TURSO_DATABASE_URL || ':memory:';
6: const authToken = process.env.TURSO_AUTH_TOKEN;
7: 
8: const client = createClient({
9:     url,
10:     authToken,
11: });
12: 
13: export const db = drizzle(client, { schema });
```
- Line 5 assigns `const url = process.env.TURSO_DATABASE_URL || ':memory:';`. If `TURSO_DATABASE_URL` is omitted, undefined, or empty, the client silently connects to a transient in-memory SQLite instance (`:memory:`).
- Line 6 extracts `TURSO_AUTH_TOKEN` without validation. If `TURSO_DATABASE_URL` points to a remote Turso instance (`libsql://...`) and `TURSO_AUTH_TOKEN` is missing, client instantiation succeeds without error, but every query crashes later at runtime with authentication failure.

### 1.2 Existing Drizzle Configuration (`drizzle.config.ts`)
Direct inspection of `/Users/hardikrawat/Documents/the-case-file/drizzle.config.ts` reveals:
```typescript
1: import { defineConfig } from 'drizzle-kit';
2: import * as dotenv from 'dotenv';
3: dotenv.config({ path: '.env.local' });
4: 
5: export default defineConfig({
6:     schema: './src/lib/schema.ts',
7:     out: './drizzle',
8:     dialect: 'turso', // Trying specific dialect if supported, or back to sqlite
9:     dbCredentials: {
10:         url: process.env.TURSO_DATABASE_URL!,
11:         authToken: process.env.TURSO_AUTH_TOKEN!,
12:     },
13: });
```
- Line 3 imports and loads `.env.local` via `dotenv.config({ path: '.env.local' })`.
- Line 8 configures `dialect: 'turso'`, which is officially supported by `drizzle-kit` v0.31.8 (confirmed via `npx drizzle-kit push --help`).
- Currently, `.env.local` does not exist on disk in the project root (`find_by_name` returned 0 results for `.env*`).

### 1.3 Existing Scripts in `package.json`
Inspection of `/Users/hardikrawat/Documents/the-case-file/package.json` lines 7–19 reveals:
```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest",
    "test:unit": "vitest run",
    "test:watch": "vitest --watch",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:all": "npm run test && npm run test:e2e"
  },
```
- There are no database management scripts (no `db:push`, `db:generate`, `db:migrate`, `db:studio`, `db:check`, or `db:test`).
- `devDependencies` contains `"drizzle-kit": "^0.31.8"`, and `dependencies` contains `"drizzle-orm": "^0.36.4"`, `"@libsql/client": "^0.17.0"`, and `"dotenv": "^17.2.4"`.

### 1.4 Authoritative Credentials in `SCOPE.md` and `ORIGINAL_REQUEST.md`
Inspection of `/Users/hardikrawat/Documents/the-case-file/.agents/sub_orch_m1/SCOPE.md` lines 12–19 and `/Users/hardikrawat/Documents/the-case-file/.agents/ORIGINAL_REQUEST.md` lines 14–18 confirms:
- **Turso Database URL**: `libsql://the-case-file-hardikrawat.aws-ap-south-1.turso.io`
- **Turso Database Auth Token**: `eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODg1MzI4OTIsImlkIjoiZTc1YzQzZjktNGNlYy00ZmQyLWE1YzgtNTY4ZDFlM2I5MTRkIiwia2lkIjoiMWJvLWNfaVFSb010THZkcVVQc09ZSTByeWVIM2x0VEstcFBYU1AxTldJcyIsInJpZCI6IjE1ZGRjNDM1LWY2ZjgtNDJjMi04YjM0LTg2ZTE5NDc4NDc3MCJ9.NLQbA_6E0u-z3TFYSESi_K0L0ayZKxbRDYb8fsUx7a39Qm0UvL1PYo3h89laelUIADXl7GUb-BfkOVvhoNTaCw`
- **Turso Platform Management Token**: `eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJncm91cF91dWlkIjoiYTZiZTExMGItZjQxOS00YTUxLTlkNmMtNjY0OWVhZWQxODg2IiwianRpIjoiaFlqYWg2ZWFFZkcwd0dJR2kyNk9vUSIsIm9yZ19pZCI6MTAwMDExMTE5Miwic2NvcGVzIjp7InNjb3BlcyI6WyJkYjpjb25maWd1cmUiLCJkYjpjcmVhdGUiLCJkYjpkZWxldGUiLCJkYjptaW50LXRva2VuIiwiZGI6cm90YXRlLWNyZWRzIiwiZ3JvdXA6Y29uZmlndXJlIiwiZ3JvdXA6bWludC10b2tlbiIsImdyb3VwOnJvdGF0ZS1jcmVkcyIsInJlYWQiXX19.JrEW_PFbQpdejYwfIiL7ISv9LJGIx0tIE7Nh6zyfy7qRuFol0pYrPkmMY3P9sKOFj-IkXTsc4RLcV-LpCJMOBQ`
- **Auth Secret**: `the-case-file-super-secret-key-development-2026`
- **NextAuth URL**: `http://localhost:3000`

### 1.5 Live Remote Connectivity Verification
Direct execution of live remote connection test against cloud Turso DB:
```bash
TURSO_DATABASE_URL="libsql://the-case-file-hardikrawat.aws-ap-south-1.turso.io" \
TURSO_AUTH_TOKEN="eyJhbGci..." \
npx tsx -e "
import { db } from './src/lib/db';
import { sql } from 'drizzle-orm';
db.run(sql\`SELECT 1 as connected\`).then(r => console.log(r));
"
```
Output:
```
ResultSetImpl {
  columns: [ 'connected' ],
  columnTypes: [ '' ],
  rows: [ { connected: 1 } ],
  rowsAffected: 0,
  lastInsertRowid: undefined
}
```
Connection and Drizzle ORM query execution against the remote Turso DB succeeded with zero errors.

---

## 2. Logic Chain

1. **Observation Ref**: `src/lib/db.ts:5` assigns `url = process.env.TURSO_DATABASE_URL || ':memory:'`.
   - **Reasoning**: If `TURSO_DATABASE_URL` is omitted, the app boots into a private in-memory SQLite database. In serverless/containerized deployments, every cold start or route invocation creates an isolated transient database, leading to immediate silent data loss and impossible persistence.
   - **Requirement Reference**: `PROJECT.md` Turso DB Client Contract ("Throws fatal error on import if `TURSO_DATABASE_URL` is empty or if remote URL lacks `TURSO_AUTH_TOKEN`. Zero fallback to `:memory:`").
   - **Deduction**: `src/lib/db.ts` must be modified to immediately throw a descriptive fatal Error during module evaluation if `process.env.TURSO_DATABASE_URL` is missing, empty, or set to `:memory:`.

2. **Observation Ref**: `src/lib/db.ts:6` does not check for `TURSO_AUTH_TOKEN`.
   - **Reasoning**: Remote Turso databases (`libsql://...` or `https://...`) mandate authentication. If an operator sets `TURSO_DATABASE_URL` but forgets `TURSO_AUTH_TOKEN`, the client constructor does not throw, delaying the failure until the first database operation, which obfuscates configuration errors.
   - **Deduction**: `src/lib/db.ts` must validate that if the URL begins with `libsql://`, `https://`, or `wss://`, `TURSO_AUTH_TOKEN` must be present and non-empty, throwing a descriptive critical error otherwise.

3. **Observation Ref**: `package.json` contains no database management scripts; `drizzle-kit` v0.31.8 is installed in `devDependencies`.
   - **Reasoning**: Developers and CI pipelines need standard npm scripts to inspect, generate, push, and migrate schema changes without typing lengthy CLI flags.
   - **Deduction**: Adding `"db:push": "drizzle-kit push"`, `"db:generate": "drizzle-kit generate"`, `"db:migrate": "drizzle-kit migrate"`, `"db:studio": "drizzle-kit studio"`, `"db:check": "drizzle-kit check"`, and `"db:test": "npx tsx scripts/test-db.ts"` enables complete developer ergonomics and automated schema synchronization.

4. **Observation Ref**: `drizzle.config.ts` loads `.env.local` via `dotenv.config({ path: '.env.local' })`, but does not validate environment variables before passing them with `!`.
   - **Reasoning**: When `.env.local` is populated with the authoritative credentials, `drizzle-kit push` works seamlessly. Adding a descriptive error check in `drizzle.config.ts` provides additional defense against unconfigured environments.

---

## 3. Caveats

- **Git Tracking of Credentials**: `.env.local` is ignored in `.gitignore` (line 34: `.env*`). It will remain local on disk and will not be accidentally committed to git.
- **CI / Production Environments**: In CI pipelines (e.g., `.github/workflows/e2e-tests.yml`), `.env.local` is dynamically synthesized from GitHub repository secrets (`secrets.TURSO_DATABASE_URL`, `secrets.TURSO_AUTH_TOKEN`, `secrets.AUTH_SECRET`). The exact same keys are required in both local and CI environments.
- **Unit Test Isolation**: In `src/setupTests.ts`, `@/lib/db` is mocked via `vi.mock('@/lib/db')` for unit tests. However, integration tests, scripts, Next.js build (`next build`), and runtime routes require actual database connectivity or fail-fast validation.

---

## 4. Conclusion

### 4.1 Exact Content for `.env.local`
File path: `/Users/hardikrawat/Documents/the-case-file/.env.local`

```env
# Cloud Turso Database Configuration (Mandatory)
TURSO_DATABASE_URL=libsql://the-case-file-hardikrawat.aws-ap-south-1.turso.io
TURSO_AUTH_TOKEN=eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODg1MzI4OTIsImlkIjoiZTc1YzQzZjktNGNlYy00ZmQyLWE1YzgtNTY4ZDFlM2I5MTRkIiwia2lkIjoiMWJvLWNfaVFSb010THZkcVVQc09ZSTByeWVIM2x0VEstcFBYU1AxTldJcyIsInJpZCI6IjE1ZGRjNDM1LWY2ZjgtNDJjMi04YjM0LTg2ZTE5NDc4NDc3MCJ9.NLQbA_6E0u-z3TFYSESi_K0L0ayZKxbRDYb8fsUx7a39Qm0UvL1PYo3h89laelUIADXl7GUb-BfkOVvhoNTaCw

# NextAuth / Session Configuration (Mandatory)
AUTH_SECRET=the-case-file-super-secret-key-development-2026
NEXTAUTH_URL=http://localhost:3000

# Turso Platform Management Token (Optional / Administrative)
TURSO_PLATFORM_MANAGEMENT_TOKEN=eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJncm91cF91dWlkIjoiYTZiZTExMGItZjQxOS00YTUxLTlkNmMtNjY0OWVhZWQxODg2IiwianRpIjoiaFlqYWg2ZWFFZkcwd0dJR2kyNk9vUSIsIm9yZ19pZCI6MTAwMDExMTE5Miwic2NvcGVzIjp7InNjb3BlcyI6WyJkYjpjb25maWd1cmUiLCJkYjpjcmVhdGUiLCJkYjpkZWxldGUiLCJkYjptaW50LXRva2VuIiwiZGI6cm90YXRlLWNyZWRzIiwiZ3JvdXA6Y29uZmlndXJlIiwiZ3JvdXA6bWludC10b2tlbiIsImdyb3VwOnJvdGF0ZS1jcmVkcyIsInJlYWQiXX19.JrEW_PFbQpdejYwfIiL7ISv9LJGIx0tIE7Nh6zyfy7qRuFol0pYrPkmMY3P9sKOFj-IkXTsc4RLcV-LpCJMOBQ
```

### 4.2 Exact Scripts to Add to `package.json`
In `/Users/hardikrawat/Documents/the-case-file/package.json`, update the `"scripts"` object to include:

```json
    "db:generate": "drizzle-kit generate",
    "db:push": "drizzle-kit push",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio",
    "db:check": "drizzle-kit check",
    "db:test": "npx tsx scripts/test-db.ts"
```

The resulting `scripts` block in `package.json` should be:
```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest",
    "test:unit": "vitest run",
    "test:watch": "vitest --watch",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:all": "npm run test && npm run test:e2e",
    "db:generate": "drizzle-kit generate",
    "db:push": "drizzle-kit push",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio",
    "db:check": "drizzle-kit check",
    "db:test": "npx tsx scripts/test-db.ts"
  },
```

### 4.3 Exact Code Replacement for `src/lib/db.ts`
Full drop-in replacement for `/Users/hardikrawat/Documents/the-case-file/src/lib/db.ts`:

```typescript
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

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

export const client = createClient({
    url,
    authToken,
});

export const db = drizzle(client, { schema });
```

### 4.4 Defensive Hardening for `drizzle.config.ts` (Recommended)
In `/Users/hardikrawat/Documents/the-case-file/drizzle.config.ts`:
```typescript
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
```

---

## 5. Verification Method

### 5.1 Verification Commands

#### Verification 1: Fail-Fast on Missing `TURSO_DATABASE_URL`
```bash
TURSO_DATABASE_URL="" npx tsx -e "import('./src/lib/db')"
```
**Expected Output**: Throws error and exits with code 1:
`Error: [CRITICAL] TURSO_DATABASE_URL is missing. In-memory SQLite fallback (:memory:) is strictly prohibited. Configure TURSO_DATABASE_URL in .env.local.`

#### Verification 2: Fail-Fast on Explicit `:memory:` Fallback
```bash
TURSO_DATABASE_URL=":memory:" npx tsx -e "import('./src/lib/db')"
```
**Expected Output**: Throws error and exits with code 1:
`Error: [CRITICAL] In-memory SQLite database (:memory:) is strictly prohibited. Configure a valid remote Turso database URL in .env.local.`

#### Verification 3: Fail-Fast on Remote URL without Auth Token
```bash
TURSO_DATABASE_URL="libsql://the-case-file-hardikrawat.aws-ap-south-1.turso.io" TURSO_AUTH_TOKEN="" npx tsx -e "import('./src/lib/db')"
```
**Expected Output**: Throws error and exits with code 1:
`Error: [CRITICAL] TURSO_AUTH_TOKEN is required to connect to remote Turso DB at libsql://the-case-file-hardikrawat.aws-ap-south-1.turso.io. Configure TURSO_AUTH_TOKEN in .env.local.`

#### Verification 4: Live Remote Database Connection Script
```bash
npm run db:test
# or directly:
npx tsx scripts/test-db.ts
```
**Expected Output**:
```
Testing Connection...
URL: libsql://the-case-file-hardikrawat.aws-ap-south-1.turso.io
Token Length: 220
✅ Connection Successful! ResultSetImpl { ... rows: [ { 1: 1 } ] }
```

#### Verification 5: Drizzle ORM Live Remote Query Execution
```bash
npx tsx -e "
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { db } from './src/lib/db';
import { sql } from 'drizzle-orm';

async function test() {
  const result = await db.run(sql\`SELECT 1 as connected\`);
  console.log('✅ Drizzle connected to remote Turso:', result.rows);
}
test();
"
```
**Expected Output**:
`✅ Drizzle connected to remote Turso: [ { connected: 1 } ]`

#### Verification 6: Drizzle-Kit Schema Check
```bash
npm run db:check
```
**Expected Output**: Runs `drizzle-kit check` against `.env.local` credentials with code 0.

### 5.2 Invalidation Conditions
- If running `TURSO_DATABASE_URL="" npx tsx -e "import('./src/lib/db')"` succeeds without throwing an error, verification fails (fallback to `:memory:` still present).
- If running `TURSO_DATABASE_URL=":memory:" npx tsx -e "import('./src/lib/db')"` succeeds without throwing an error, verification fails.
- If running with remote Turso URL and empty `TURSO_AUTH_TOKEN` does not throw an immediate descriptive error upon module evaluation, verification fails.
- If `npx tsx scripts/test-db.ts` fails to connect or authentication fails, verification fails.
