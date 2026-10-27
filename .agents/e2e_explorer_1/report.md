# E2E Test Infrastructure & Genuine Authentication Exploration Report

**Explorer**: Explorer 1 (Harness & Auth Infrastructure)  
**Date**: 2026-09-04  
**Target Project**: 'The Case File' (`/Users/hardikrawat/Documents/the-case-file`)  
**Parent Orchestrator**: `sub_orch_e2e` (`6bd03dee-8755-41ec-b6a0-6e521bb5b5b5`)

---

## 1. Executive Summary

This investigation analyzed the existing test harness, NextAuth v5 beta authentication architecture, and cloud Turso database persistence in 'The Case File'. The existing test suite heavily relied on a critical backdoor (`x-test-bypass: true` headers) and in-memory mock route fulfillments, meaning prior tests never validated genuine authentication, route guards, or real Turso database transactions.

We have established a genuine, backdoor-free test infrastructure architecture:
1. **Zero-Bypass Cryptographic Authentication**: Using `@auth/core/jwt`'s `encode` function with `AUTH_SECRET` and salt `authjs.session-token` to sign authentic JWE session cookies identical to those produced by NextAuth v5. These cookies authenticate genuine test users in Turso DB across both headless browser pages (`context.addCookies`) and API request wrappers.
2. **Dedicated Cloud Turso Seeding & Scoped Teardown**: A deterministic database seeder inserting 3 persistent test detectives (`DETECTIVE_ALPHA`, `DETECTIVE_BETA`, `DETECTIVE_GAMMA`) and managing ephemeral prefixed entities (`e2e_board_*`) with automated cascading teardown.
3. **Unified Playwright 4-Tier Test Runner**: Leveraging Playwright 1.58 (already installed with Chromium) to execute both headless HTTP API contracts (Tier 1 & 2) and full ReactFlow visual board interactions (Tier 3 & 4) under a single command (`npm run test:e2e`).
4. **Complete Blueprint for `TEST_INFRA.md`**: Outlining full specifications for implementation workers.

---

## 2. Audit of Existing Test Setup & Configuration

### 2.1 Configuration Files Analysis

| File | Current Configuration | Flaws / Issues Identified | Remediation Required |
|------|-----------------------|---------------------------|----------------------|
| `package.json` | `"test:e2e": "playwright test"`, `"test": "vitest"` | No dotenv loading for runner scripts; `test:e2e` assumes server is pre-running or started via `npm run start` | Keep `"test:e2e": "playwright test"`; add scripts for running specific tiers; ensure dotenv loads `.env.local` |
| `playwright.config.ts` | Lines 31-33: `extraHTTPHeaders: { 'x-test-bypass': 'true' }`<br>Lines 52-59: `webServer.command: 'npm run start'` | **Critical Backdoor**: Globals inject `x-test-bypass` header into every request.<br>`npm run start` fails locally if `npm run build` has not been run first. | **Remove `x-test-bypass` header** from config.<br>Update `webServer` command to fallback: `process.env.CI ? 'npm run start' : 'npm run dev'` with `reuseExistingServer: true`.<br>Import `dotenv/config` targeting `.env.local`. |
| `vitest.config.ts` | `environment: 'jsdom'`, excludes `tests/e2e/**` | Excludes E2E tests correctly. Configured for JSDOM unit tests. | Maintain exclusion of `tests/e2e/**`. |
| `tsconfig.json` | Path alias `"@/*": ["./src/*"]`, strict mode enabled | Test directories (`tests/`) are included under `"**/*.ts"`. Path alias `@/*` works across tests. | Ready as is. |

### 2.2 Flaws in Existing Test Suites (`tests/`)

1. **Auth Session Mocking**:
   - `tests/fixtures/auth.fixtures.ts` (lines 13-26) intercepts `**/api/auth/session` and fulfills with static JSON:
     ```typescript
     await page.route('**/api/auth/session', async route => {
         await route.fulfill({ status: 200, json: { user: { id: 'test-user-123' } } });
     });
     ```
   - This mocked out NextAuth entirely, so real server-side session resolution (`await auth()`) in Next.js Server Components and Route Handlers never executed.
2. **Backend API Mocking**:
   - `tests/helpers/test-helpers.ts` (lines 56-115) defines `mockBoardAPI` which intercepts `**/api/me`, `**/api/boards**`, and `**/api/contributions**`.
   - Tests were never running against real API route handlers or remote Turso DB.
3. **Application-Side Mock Synthesis**:
   - `src/app/(authenticated)/board/[id]/page.tsx` (lines 37-47) synthesized a fake board in memory whenever `x-test-bypass: true` was received:
     ```typescript
     } else if (isTestBypass) {
         board = { id: boardId, title: 'Test Case', isPublic: true, userId: 'test-user-123', ... };
     }
     ```
   - This masked database query errors, missing board permissions, and authorization bypasses.

---

## 3. Auth Flow Analysis & Genuine Authentication Without Bypasses

### 3.1 NextAuth v5 Beta Architecture in 'The Case File'

In NextAuth.js v5 (beta.30), authentication works as follows:
- **Provider**: Email/Password via `Credentials` provider in `src/auth.ts`.
- **Session Strategy**: Explicitly set to `"jwt"` (`session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 }`).
- **Cookie Mechanics**:
  - In development / HTTP (`http://localhost:3000`), the session cookie name is `authjs.session-token`.
  - The cookie value is a JWE (JSON Web Encryption) encrypted token using algorithm `A256CBC-HS512` (direct key management `dir`).
  - Key derivation uses `@panva/hkdf` with SHA-256:
    - Input key material: `process.env.AUTH_SECRET`
    - Salt: `authjs.session-token` (the cookie name)
    - Info: `"Auth.js Generated Encryption Key (authjs.session-token)"`
    - Derived key length: 64 bytes
- **Route Guarding**:
  - `src/middleware.ts` runs `NextAuth(authConfig).auth`.
  - In `src/auth.config.ts`, `authorized({ auth, request })` checks `!!auth?.user`.
  - In server components and API routes, `const session = await auth()` decrypts the cookie and reads the session.

### 3.2 Verification That User Must Exist in Turso DB

In `src/app/api/me/route.ts`:
```typescript
const session = await auth();
if (!session?.user?.email) return new NextResponse("Unauthorized", { status: 401 });

const user = await db.query.users.findFirst({
    where: eq(users.email, session.user.email),
    with: { reputation: true },
});
if (!user) return new NextResponse("User not found", { status: 404 });
```
This proves that even with a cryptographically valid session cookie, if the user's email does not exist in the Turso DB `users` table, the API returns `404 User not found`. 

Furthermore, `src/auth.ts` lines 80-83 enforces that `user.emailVerifiedFlag` must be `true` (or `1` in SQLite) for credentials login to succeed.

### 3.3 Two Genuine Authentication Strategies for E2E Tests

#### Strategy 1: Programmatic JWE Session Cookie Injection (High Performance)
For fast, resilient test execution across 50+ E2E tests, tests should not submit the UI login form on every single test (which incurs ~1-2 seconds of bcrypt hashing and navigation latency per test). Instead, tests can generate authentic session cookies programmatically using NextAuth's own `@auth/core/jwt` `encode` function.

**Implementation verified via Node.js execution**:
```typescript
import { encode } from '@auth/core/jwt';

export async function createSessionCookie(user: { id: string; email: string; name: string }) {
    const secret = process.env.AUTH_SECRET || 'the-case-file-super-secret-key-development-2026';
    const salt = 'authjs.session-token';
    const token = await encode({
        token: {
            id: user.id,
            sub: user.id,
            email: user.email,
            name: user.name,
        },
        secret,
        salt,
        maxAge: 30 * 24 * 60 * 60,
    });

    return {
        name: 'authjs.session-token',
        value: token,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax' as const,
        secure: false,
    };
}
```

When added to Playwright's browser context:
```typescript
await context.addCookies([cookie]);
```
- Next.js middleware and route handlers decrypt this cookie using `AUTH_SECRET`.
- The user is recognized as legitimately authenticated.
- Zero backdoors (`x-test-bypass` eliminated).

#### Strategy 2: Genuine UI Credentials Login Flow
For tests specifically validating authentication and security behaviors (e.g. login form submission, bad passwords, lockout, email verification checks), tests will use the actual browser UI:
```typescript
export async function loginViaUI(page: Page, email: string, password: string) {
    await page.goto('/login');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/cases|\/board/, { timeout: 15000 });
}
```

---

## 4. Recommended Test Infrastructure Architecture

### 4.1 Directory Structure

```
tests/e2e/
├── fixtures/
│   ├── auth.fixtures.ts        # Extended Playwright test fixtures (authPage, apiContext, etc.)
│   └── test-data.ts            # Standard detective profiles, board templates, node fixtures
├── helpers/
│   ├── auth.ts                 # JWE session cookie generator, UI login helper
│   ├── db.ts                   # Turso DB connection, seeder, cleaner, and query utilities
│   ├── api-client.ts           # Type-safe HTTP API fetch wrapper with auto-auth
│   └── canvas-helpers.ts       # ReactFlow toolbar, node creation/deletion, red string cutting
├── global-setup.ts             # Global one-time seeder for standard test detectives in Turso
├── global-teardown.ts          # Global cleanup of orphaned test entities
├── tier1-features/
│   ├── security.spec.ts        # Token leakage, auth guards, passwordHash stripping, rate limits
│   ├── turso-db.spec.ts        # Remote DB connection, 14 tables verification, soft-delete
│   ├── canvas-nodes.spec.ts    # 5 node types (Sticky, Text, Image, Article, Link), delete, strings
│   └── collaboration.spec.ts   # Comments, Collaborators, VersionHistory, Export, Reputation
├── tier2-boundary/
│   ├── ssrf-preview.spec.ts    # SSRF attack vectors: 127.0.0.1, 169.254.169.254, RFC1918, malformed
│   ├── input-boundary.spec.ts  # Max-length strings, empty payloads, invalid JWTs, boundary limits
│   └── concurrency.spec.ts     # Rapid clicks, duplicate invites, concurrent updates
├── tier3-cross-feature/
│   ├── forking-lineage.spec.ts # Board fork, parentId preservation, lineage badge display
│   └── collaboration-diff.spec.ts # Invite editor, contribution submission, diff modal, merge & reputation
└── tier4-scenarios/
    ├── homicide-case.spec.ts   # Multi-detective homicide investigation scenario with all 5 nodes
    └── export-rollback.spec.ts # PDF/PNG/JSON export generation and version history rollback
```

### 4.2 Helper Specifications

#### 1. `tests/e2e/helpers/auth.ts`
- `createSessionCookie(user: TestUser): Promise<PlaywrightCookie>`: Generates valid JWE session cookie using `@auth/core/jwt`.
- `authenticateContext(context: BrowserContext, user: TestUser): Promise<void>`: Attaches cookie to browser context.
- `loginViaUI(page: Page, email: string, password: string): Promise<void>`: Performs form login via browser UI.
- `getAuthHeaders(user: TestUser): Promise<Record<string, string>>`: Returns `{ Cookie: 'authjs.session-token=...' }` for HTTP fetch requests.

#### 2. `tests/e2e/helpers/db.ts`
- **Database Client**: Direct `@libsql/client` connection using `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`.
- **Predefined Detectives**:
  - `DETECTIVE_ALPHA`: Primary owner (`id: 'e2e-user-alpha'`, `email: 'alpha@testcasefile.dev'`, password: `'DetectivePass123!'`, `emailVerifiedFlag: 1`)
  - `DETECTIVE_BETA`: Collaborator (`id: 'e2e-user-beta'`, `email: 'beta@testcasefile.dev'`, password: `'DetectivePass123!'`, `emailVerifiedFlag: 1`)
  - `DETECTIVE_GAMMA`: Stranger/Viewer (`id: 'e2e-user-gamma'`, `email: 'gamma@testcasefile.dev'`, password: `'DetectivePass123!'`, `emailVerifiedFlag: 1`)
- **Functions**:
  - `seedStandardUsers()`: Idempotently upserts the 3 standard detectives and their initial reputation rows.
  - `createTestBoard(options: CreateBoardOptions): Promise<string>`: Inserts a board directly in Turso DB with `id = 'e2e_board_' + cuid()`.
  - `cleanTestArtifacts()`: Deletes all boards with `id LIKE 'e2e_%'` or title containing `'[E2E-TEST]'`. Cascades delete to comments, collaborators, versions, and contributions.
  - `cleanTestUsers()`: Deletes ephemeral users with `email LIKE '%@test-ephemeral.com'`.

#### 3. `tests/e2e/helpers/api-client.ts`
- Encapsulates Playwright's `APIRequestContext` or native `fetch`.
- Provides methods: `get`, `post`, `put`, `delete`, `patch`.
- Automatically signs and injects the `authjs.session-token` cookie for authenticated calls.
- Supports unauthenticated calls for testing 401s and public routes.
- Includes automatic response assertion helpers: `expectStatus(res, code)`, `expectNoTokens(body)`, `expectNoPasswordHash(body)`.

#### 4. `tests/e2e/helpers/canvas-helpers.ts`
- `waitForBoardReady(page: Page)`: Waits for ReactFlow canvas (`.react-flow`) and dismisses loading indicators (`div:has-text("Reconstructing Case Evidence")`).
- `addNode(page: Page, type: 'sticky' | 'text' | 'image' | 'article' | 'link')`: Clicks toolbar button, verifies node is mounted in ReactFlow.
- `deleteNode(page: Page, nodeId: string)`: Selects node, clicks delete action button, verifies removal from store and DOM.
- `cutEdge(page: Page, edgeId: string)`: Clicks scissors icon on `StringEdge`, verifies edge removal.
- `openPanel(page: Page, panel: 'comments' | 'collaborators' | 'history' | 'export')`: Clicks panel toggle button and verifies overlay container is visible.

---

## 5. Test Runner Configuration & Execution Scripts

### 5.1 Updates to `playwright.config.ts`

```typescript
import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });
dotenv.config();

export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: false, // Database operations require controlled concurrency
    workers: process.env.CI ? 1 : 2,
    retries: process.env.CI ? 2 : 1,
    timeout: 30000,
    expect: { timeout: 10000 },
    globalSetup: './tests/e2e/global-setup.ts',
    globalTeardown: './tests/e2e/global-teardown.ts',

    reporter: process.env.CI
        ? [['html'], ['json', { outputFile: 'test-results/results.json' }], ['list']]
        : [['html'], ['list']],

    use: {
        baseURL: 'http://localhost:3000',
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
        actionTimeout: 15000,
        navigationTimeout: 30000,
        // ZERO x-test-bypass headers
    },

    projects: [
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
                viewport: { width: 1280, height: 720 },
            },
        },
    ],

    webServer: {
        command: process.env.CI ? 'npm run start' : 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: true,
        timeout: 120000,
        stdout: 'pipe',
        stderr: 'pipe',
    },
});
```

### 5.2 Scripts to add to `package.json`

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:tier1": "playwright test tests/e2e/tier1-features",
    "test:e2e:tier2": "playwright test tests/e2e/tier2-boundary",
    "test:e2e:tier3": "playwright test tests/e2e/tier3-cross-feature",
    "test:e2e:tier4": "playwright test tests/e2e/tier4-scenarios",
    "test:e2e:headed": "playwright test --headed",
    "test:e2e:ui": "playwright test --ui"
  }
}
```

---

## 6. Detailed Blueprint for `TEST_INFRA.md`

`TEST_INFRA.md` must be placed at the project root (`/Users/hardikrawat/Documents/the-case-file/TEST_INFRA.md`). The document must contain the following core sections:

1. **Architecture Overview & Opaque-Box Principles**:
   - Testing against external user contracts and acceptance criteria without coupling to internal private states.
   - Elimination of all test backdoors (`x-test-bypass`).
   - Authentic cloud Turso DB persistence (`libsql://...`).
   - Genuine NextAuth v5 session cookies.
2. **Environment & Prerequisites**:
   - Required environment variables: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `AUTH_SECRET`, `NEXTAUTH_URL`.
   - Instructions for local development vs CI execution.
3. **Authentication Infrastructure & Cryptography**:
   - How JWE tokens are constructed with `@auth/core/jwt` using `AUTH_SECRET` and `authjs.session-token` salt.
   - How `authPage` fixture seamlessly injects cookies into browser contexts.
   - How `loginViaUI` tests the actual authentication UI flow.
4. **Database Management & Seeding Protocol**:
   - Details of standard test personas (`DETECTIVE_ALPHA`, `DETECTIVE_BETA`, `DETECTIVE_GAMMA`).
   - Seeding workflow in `global-setup.ts`.
   - Prefixing convention (`e2e_board_*`) and teardown workflow in `global-teardown.ts`.
5. **4-Tier Test Suite Specification**:
   - Tier 1: Feature Coverage matrix (Security, DB, 5 Canvas Nodes, Panels, Reputation).
   - Tier 2: Boundary & Corner Cases matrix (SSRF, Empty/Max inputs, Tampered tokens, Concurrency).
   - Tier 3: Cross-Feature Workflows (Lineage preservation, Diffing, Merging, Reputation awards).
   - Tier 4: Real-World Scenarios (Multi-detective investigation board, Export & conflict rollback).
6. **Execution Commands & Troubleshooting**:
   - Detailed list of npm commands for full and targeted test runs.
   - Debugging procedures using Playwright UI, Tracing, and Headed modes.
   - Resolving common pitfalls (rate limit exhaustion during test bursts, Next.js server startup timeouts).

---

## 7. Next Steps for Sub-Orchestrator

1. Review and approve the test infrastructure architecture and helper specifications.
2. Ingest findings from Explorer 2 (Tier 1 & 2 specs) and Explorer 3 (Tier 3 & 4 specs).
3. Author `TEST_INFRA.md` at root.
4. Dispatch Worker agent to implement `tests/e2e/helpers/`, `tests/e2e/fixtures/`, update `playwright.config.ts`, and construct the 4-tier test suites.
