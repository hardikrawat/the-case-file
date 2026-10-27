# Dispatch Log — Worker E2E Tier 1 & 2

## Mission
Implement Tier 1 (Feature Coverage) and Tier 2 (Boundary & Corner Cases) automated test suites for 'The Case File' using Playwright, the genuine cryptographic auth helper, and Turso DB utilities from `tests/e2e/helpers`.

## Authoritative Inputs
- User Request: `/Users/hardikrawat/Documents/the-case-file/.agents/ORIGINAL_REQUEST.md`
- Project Master: `/Users/hardikrawat/Documents/the-case-file/PROJECT.md`
- Test Infrastructure Architecture: `/Users/hardikrawat/Documents/the-case-file/TEST_INFRA.md`
- Explorer 2 Specifications: `/Users/hardikrawat/Documents/the-case-file/.agents/e2e_explorer_2/report.md`
- Test Helpers: `tests/e2e/helpers/index.ts` (`tests/e2e/helpers/auth.ts`, `tests/e2e/helpers/db.ts`, `tests/e2e/helpers/api-client.ts`, `tests/e2e/helpers/canvas-helpers.ts`)

## Exclusive Write Ownership
- `/Users/hardikrawat/Documents/the-case-file/tests/e2e/tier1/`
- `/Users/hardikrawat/Documents/the-case-file/tests/e2e/tier2/`

## Files to Implement
1. `tests/e2e/tier1/security.spec.ts` (T1-SEC-01 through T1-SEC-05)
2. `tests/e2e/tier1/database.spec.ts` (T1-DB-01 through T1-DB-05)
3. `tests/e2e/tier1/canvas.spec.ts` (T1-CANVAS-01 through T1-CANVAS-07, T1-STORE-01)
4. `tests/e2e/tier1/panels.spec.ts` (T1-COMM-01-04, T1-COL-01-04, T1-VER-01-04, T1-EXP-01-03)
5. `tests/e2e/tier1/reputation.spec.ts` (T1-REP-01-03, T1-LEAD-01-02)
6. `tests/e2e/tier2/ssrf.spec.ts` (T2-SSRF-01 through T2-SSRF-06)
7. `tests/e2e/tier2/boundary.spec.ts` (T2-BOUND-01-04, T2-AUTH-01-02)
8. `tests/e2e/tier2/rate-limit.spec.ts` (T2-RATE-01-02, T2-RACE-01)

## Mandatory Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. An auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Completion Criteria
1. All Tier 1 and Tier 2 test files created and fully populated with genuine assertions.
2. Zero `x-test-bypass` usage.
3. ESLint passes on created files.
4. Run tests with `npx playwright test tests/e2e/tier1 tests/e2e/tier2` (or dry-run/syntax check if app servers or pending milestone fixes are running).
5. Document test counts and handoff in `/Users/hardikrawat/Documents/the-case-file/.agents/worker_e2e_tier1_2/handoff.md`.
36: 
## 2026-09-04T15:13:00Z
You are Test Writer for Tier 1 & Tier 2 E2E Tests for 'The Case File'.
Working directory: `/Users/hardikrawat/Documents/the-case-file/.agents/worker_e2e_tier1_2`
Your parent is `sub_orch_e2e` (conversation ID: `6bd03dee-8755-41ec-b6a0-6e521bb5b5b5`).

Read:
- `/Users/hardikrawat/Documents/the-case-file/.agents/ORIGINAL_REQUEST.md`
- `/Users/hardikrawat/Documents/the-case-file/PROJECT.md`
- `/Users/hardikrawat/Documents/the-case-file/TEST_INFRA.md`
- `/Users/hardikrawat/Documents/the-case-file/.agents/worker_e2e_tier1_2/DISPATCH.md`
- `/Users/hardikrawat/Documents/the-case-file/.agents/e2e_explorer_2/report.md`
- Helpers in `/Users/hardikrawat/Documents/the-case-file/tests/e2e/helpers/`

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. An auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your Tasks:
Implement all Tier 1 and Tier 2 test suites using Playwright:
1. `tests/e2e/tier1/security.spec.ts` (T1-SEC-01 to 05)
2. `tests/e2e/tier1/database.spec.ts` (T1-DB-01 to 05)
3. `tests/e2e/tier1/canvas.spec.ts` (T1-CANVAS-01 to 07, T1-STORE-01)
4. `tests/e2e/tier1/panels.spec.ts` (T1-COMM-01 to 04, T1-COL-01 to 04, T1-VER-01 to 04, T1-EXP-01 to 03)
5. `tests/e2e/tier1/reputation.spec.ts` (T1-REP-01 to 03, T1-LEAD-01 to 02)
6. `tests/e2e/tier2/ssrf.spec.ts` (T2-SSRF-01 to 06)
7. `tests/e2e/tier2/boundary.spec.ts` (T2-BOUND-01 to 04, T2-AUTH-01 to 02)
8. `tests/e2e/tier2/rate-limit.spec.ts` (T2-RATE-01 to 02, T2-RACE-01)

All tests must import genuine auth and DB helpers from `tests/e2e/helpers`. NO `x-test-bypass`.
Run eslint and test syntax validation. Write `progress.md` and `handoff.md` and message parent when complete.
