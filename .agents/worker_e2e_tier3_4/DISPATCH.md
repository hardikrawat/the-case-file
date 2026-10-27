# Dispatch Log — Worker E2E Tier 3 & 4

## Mission
Implement Tier 3 (Cross-Feature Combinations) and Tier 4 (Real-World Detective Application Scenarios) automated test suites for 'The Case File' using Playwright, genuine cryptographic auth helpers, and Turso DB utilities from `tests/e2e/helpers`.

## Authoritative Inputs
- User Request: `/Users/hardikrawat/Documents/the-case-file/.agents/ORIGINAL_REQUEST.md`
- Project Master: `/Users/hardikrawat/Documents/the-case-file/PROJECT.md`
- Test Infrastructure Architecture: `/Users/hardikrawat/Documents/the-case-file/TEST_INFRA.md`
- Explorer 3 Specifications: `/Users/hardikrawat/Documents/the-case-file/.agents/e2e_explorer_3/report.md`
- Test Helpers: `tests/e2e/helpers/index.ts` (`tests/e2e/helpers/auth.ts`, `tests/e2e/helpers/db.ts`, `tests/e2e/helpers/api-client.ts`, `tests/e2e/helpers/canvas-helpers.ts`)

## Exclusive Write Ownership
- `/Users/hardikrawat/Documents/the-case-file/tests/e2e/tier3/`
- `/Users/hardikrawat/Documents/the-case-file/tests/e2e/tier4/`

## Files to Implement
1. `tests/e2e/tier3/forking-lineage.spec.ts` (T3.1: Case forking with `parentId` lineage, fork badge, parent metadata)
2. `tests/e2e/tier3/canvas-nodes-strings.spec.ts` (T3.2: Link and Sticky nodes with red string physics connection)
3. `tests/e2e/tier3/collaboration-rbac.spec.ts` (T3.3: 6-role RBAC permissions matrix across 12 operations)
4. `tests/e2e/tier3/contribution-lifecycle.spec.ts` (T3.4: Proposal -> visual diff inspection -> smart merge -> status update)
5. `tests/e2e/tier3/contribution-rejection.spec.ts` (T3.5: Proposal -> rejection workflow)
6. `tests/e2e/tier3/reputation-chain.spec.ts` (T3.6: End-to-end multi-step reputation award chain with rank promotion)
7. `tests/e2e/tier4/homicide-investigation.spec.ts` (T4.1: "The Blackwood Manor Mystery" multi-detective workflow)
8. `tests/e2e/tier4/discovery-starring-search.spec.ts` (T4.2: Public case publishing, discovery feed, starring, scoped search)
9. `tests/e2e/tier4/export-roundtrip.spec.ts` (T4.3: Courtroom dossier multi-format export - JSON, PNG, PDF + roundtrip JSON import)
10. `tests/e2e/tier4/versions-conflict.spec.ts` (T4.4: Version snapshotting, rollback, and optimistic locking conflict detection HTTP 409)

## Mandatory Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. An auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Completion Criteria
1. All Tier 3 and Tier 4 test files created and fully populated with genuine assertions.
2. Zero `x-test-bypass` usage.
3. ESLint passes on created files.
4. Run tests with `npx playwright test tests/e2e/tier3 tests/e2e/tier4` (or dry-run/syntax check if app servers or pending milestone fixes are running).
5. Document test counts and handoff in `/Users/hardikrawat/Documents/the-case-file/.agents/worker_e2e_tier3_4/handoff.md`.

## 2026-09-04T15:13:00Z
Received dispatch request:
Implement all Tier 3 and Tier 4 test suites using Playwright:
1. `tests/e2e/tier3/forking-lineage.spec.ts` (T3.1: Case forking with parentId lineage, fork badge, parent metadata)
2. `tests/e2e/tier3/canvas-nodes-strings.spec.ts` (T3.2: Link and Sticky nodes with red string physics connection)
3. `tests/e2e/tier3/collaboration-rbac.spec.ts` (T3.3: 6-role RBAC permissions matrix across 12 operations)
4. `tests/e2e/tier3/contribution-lifecycle.spec.ts` (T3.4: Proposal -> visual diff inspection -> smart merge -> status update)
5. `tests/e2e/tier3/contribution-rejection.spec.ts` (T3.5: Proposal -> rejection workflow)
6. `tests/e2e/tier3/reputation-chain.spec.ts` (T3.6: End-to-end multi-step reputation award chain with rank promotion)
7. `tests/e2e/tier4/homicide-investigation.spec.ts` (T4.1: "The Blackwood Manor Mystery" multi-detective workflow)
8. `tests/e2e/tier4/discovery-starring-search.spec.ts` (T4.2: Public case publishing, discovery feed, starring, scoped search)
9. `tests/e2e/tier4/export-roundtrip.spec.ts` (T4.3: Courtroom dossier multi-format export - JSON, PNG, PDF + roundtrip JSON import)
10. `tests/e2e/tier4/versions-conflict.spec.ts` (T4.4: Version snapshotting, rollback, and optimistic locking conflict detection HTTP 409)
All tests must import genuine auth and DB helpers from `tests/e2e/helpers`. NO `x-test-bypass`.
