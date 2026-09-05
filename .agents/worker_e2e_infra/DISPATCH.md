# Dispatch Log — Worker E2E Infra

## Mission
Build the test infrastructure and harness for 'The Case File' E2E Testing Track:
1. Create `/Users/hardikrawat/Documents/the-case-file/TEST_INFRA.md` following the template in `PROJECT.md` and synthesized explorer findings.
2. Update `/Users/hardikrawat/Documents/the-case-file/playwright.config.ts` to:
   - Remove `'x-test-bypass': 'true'`.
   - Load environment variables from `.env.local` using `dotenv`.
   - Configure test directory as `tests/e2e`.
   - Add webServer config to start `npm run dev` on port 3000 if not already running.
3. Implement `tests/e2e/helpers/auth.ts`:
   - Cryptographic NextAuth v5 JWE session token generation using `@auth/core/jwt` (`encode` with `salt: 'authjs.session-token'`).
   - Cookie generation for browser context and HTTP headers.
   - Persona definitions (`DETECTIVE_ALPHA`, `DETECTIVE_BETA`, `DETECTIVE_GAMMA`).
4. Implement `tests/e2e/helpers/db.ts`:
   - Direct connection to Turso DB via `@libsql/client` using credentials in `.env.local` / `ORIGINAL_REQUEST.md`.
   - `seedTestUsers()` ensuring test users exist in Turso DB with `emailVerifiedFlag: 1`.
   - `cleanupTestBoards()` cleaning boards with prefix `e2e_` / `test_`.
5. Implement `tests/e2e/helpers/api-client.ts`:
   - Authenticated HTTP fetch helper wrapping `request` or native `fetch` with NextAuth session cookie injection.
6. Verify `package.json` scripts:
   - Add `"test:e2e": "playwright test tests/e2e"`
   - Add `"test:e2e:tier1": "playwright test tests/e2e/tier1"`
   - Add `"test:e2e:tier2": "playwright test tests/e2e/tier2"`
   - Add `"test:e2e:tier3": "playwright test tests/e2e/tier3"`
   - Add `"test:e2e:tier4": "playwright test tests/e2e/tier4"`

## Exclusive Write Ownership
- `/Users/hardikrawat/Documents/the-case-file/TEST_INFRA.md`
- `/Users/hardikrawat/Documents/the-case-file/playwright.config.ts`
- `/Users/hardikrawat/Documents/the-case-file/package.json`
- `/Users/hardikrawat/Documents/the-case-file/tests/e2e/helpers/`

## Mandatory Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. An auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Reports to Consult
- `/Users/hardikrawat/Documents/the-case-file/.agents/e2e_explorer_1/report.md`
- `/Users/hardikrawat/Documents/the-case-file/.agents/e2e_explorer_2/report.md`
- `/Users/hardikrawat/Documents/the-case-file/.agents/e2e_explorer_3/report.md`

## 2026-09-04T15:05:47Z
You are Worker E2E Infra for 'The Case File'.
Working directory: `/Users/hardikrawat/Documents/the-case-file/.agents/worker_e2e_infra`
Your parent is `sub_orch_e2e` (conversation ID: `6bd03dee-8755-41ec-b6a0-6e521bb5b5b5`).

Read:
- `/Users/hardikrawat/Documents/the-case-file/.agents/ORIGINAL_REQUEST.md`
- `/Users/hardikrawat/Documents/the-case-file/PROJECT.md`
- `/Users/hardikrawat/Documents/the-case-file/.agents/sub_orch_e2e/SCOPE.md`
- `/Users/hardikrawat/Documents/the-case-file/.agents/worker_e2e_infra/DISPATCH.md`
- `/Users/hardikrawat/Documents/the-case-file/.agents/e2e_explorer_1/report.md`
- `/Users/hardikrawat/Documents/the-case-file/.agents/e2e_explorer_2/report.md`
- `/Users/hardikrawat/Documents/the-case-file/.agents/e2e_explorer_3/report.md`

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your Tasks:
1. Create `/Users/hardikrawat/Documents/the-case-file/TEST_INFRA.md` at project root documenting test architecture, runner commands, and 4-tier methodology (Category-Partition, BVA, Pairwise, Workload Testing).
2. Update `/Users/hardikrawat/Documents/the-case-file/playwright.config.ts`:
   - Remove `'x-test-bypass': 'true'`.
   - Configure dotenv for `.env.local`.
   - Ensure baseURL is `http://localhost:3000`.
   - Set testDir to `tests/e2e`.
3. Create `tests/e2e/helpers/auth.ts`:
   - Genuine cryptographic session generation using `@auth/core/jwt` (`encode` with `salt: 'authjs.session-token'` and `AUTH_SECRET`).
   - Defined detective personas (`DETECTIVE_ALPHA`, `DETECTIVE_BETA`, `DETECTIVE_GAMMA`).
   - Cookie helpers for browser context and HTTP headers.
4. Create `tests/e2e/helpers/db.ts`:
   - Remote Turso DB connection using `@libsql/client`.
   - `seedTestUsers()` to ensure detective personas exist in Turso DB `users` table.
   - `cleanupTestData()` to clean test boards and contributions safely without touching existing non-test rows.
5. Create `tests/e2e/helpers/api-client.ts`:
   - Authenticated fetch helper for making API requests with NextAuth v5 session cookies.
6. Update `package.json`:
   - Add `"test:e2e": "playwright test tests/e2e"`
   - Add tier-specific test commands.
7. Run a smoke validation test to verify that `auth.ts` and `db.ts` helpers function properly.
8. Write `progress.md` and `handoff.md` in your working directory and message your parent when complete.

