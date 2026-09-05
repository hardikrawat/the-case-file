# Dispatch Log — Explorer 1 (Harness & Auth Infrastructure)

## Mission
Investigate the existing codebase and test configuration for 'The Case File'. Determine the optimal test runner setup (Vitest / Playwright / Node HTTP testing) for executing E2E tests via a single command. Investigate how tests can authenticate genuinely (NextAuth v5 beta credentials provider, session cookies/tokens) without using `x-test-bypass` headers. Detail the architecture and design needed for `TEST_INFRA.md` and test helpers in `tests/e2e/helpers/`.

## Input Files
- `/Users/hardikrawat/Documents/the-case-file/.agents/ORIGINAL_REQUEST.md`
- `/Users/hardikrawat/Documents/the-case-file/PROJECT.md`
- `/Users/hardikrawat/Documents/the-case-file/.agents/sub_orch_e2e/SCOPE.md`

## Output Requirements
Write your detailed exploration report to `/Users/hardikrawat/Documents/the-case-file/.agents/e2e_explorer_1/report.md` and `handoff.md`.

## 2026-09-04T15:00:01Z
You are Explorer 1 for the E2E Testing Track of 'The Case File'.
Working directory: `/Users/hardikrawat/Documents/the-case-file/.agents/e2e_explorer_1`
Your parent is `sub_orch_e2e` (conversation ID: `6bd03dee-8755-41ec-b6a0-6e521bb5b5b5`).

Read:
- `/Users/hardikrawat/Documents/the-case-file/.agents/ORIGINAL_REQUEST.md`
- `/Users/hardikrawat/Documents/the-case-file/PROJECT.md`
- `/Users/hardikrawat/Documents/the-case-file/.agents/sub_orch_e2e/SCOPE.md`
- `/Users/hardikrawat/Documents/the-case-file/.agents/e2e_explorer_1/DISPATCH.md`

Your tasks:
1. Examine package.json, vitest.config.ts / playwright.config.ts (if any), tsconfig.json, and existing test setup.
2. Examine auth flow (NextAuth v5 beta in src/auth.ts, src/auth.config.ts, login/signup routes) to determine how E2E tests can authenticate genuinely (e.g. creating real users in Turso DB or signing JWT session cookies) without ANY `x-test-bypass` headers.
3. Recommend the exact test infrastructure architecture, helper functions (auth client, DB seeder/cleaner, API fetch wrapper), and runner script (`npm run test:e2e`).
4. Detail the contents needed for `TEST_INFRA.md`.

Write your full exploration report to `/Users/hardikrawat/Documents/the-case-file/.agents/e2e_explorer_1/report.md` and your handoff to `/Users/hardikrawat/Documents/the-case-file/.agents/e2e_explorer_1/handoff.md`. Send a message back to parent when done.

