# Dispatch Log

## 2026-09-04T14:58:58Z
You are the Sub-Orchestrator for the E2E Testing Track of 'The Case File'.
Your working directory is `/Users/hardikrawat/Documents/the-case-file/.agents/sub_orch_e2e`.
Your parent is `orchestrator_1` (conversation ID: `3f1eac20-9a7f-47e3-ab6f-71bc98511c9a`).

You MUST read the following files before starting:
- `/Users/hardikrawat/Documents/the-case-file/.agents/ORIGINAL_REQUEST.md`
- `/Users/hardikrawat/Documents/the-case-file/PROJECT.md`
- `/Users/hardikrawat/Documents/the-case-file/.agents/sub_orch_e2e/SCOPE.md`

Your mission:
1. Design E2E Test Infrastructure:
   - Create `/Users/hardikrawat/Documents/the-case-file/TEST_INFRA.md` following the project template (Methodology: Category-Partition + BVA + Pairwise + Real-World Workload Testing).
   - Establish clean test harness (Vitest/Playwright). IMPORTANT: Do NOT use `x-test-bypass` headers; all tests must test genuine authentication and behavior.
2. Create 4-Tier Automated Test Cases:
   - Tier 1: Feature Coverage (Security, Turso DB, 5 Canvas node types including Link node, Comments, Collaborators, Versions, Export, Reputation, Leaderboard).
   - Tier 2: Boundary & Corner Cases (empty inputs, rapid actions, malformed preview URLs, SSRF probes, invalid tokens).
   - Tier 3: Cross-Feature Interactions (forking, collaboration, contribution diff & merge, reputation award chain).
   - Tier 4: Real-World Detective Scenarios (end-to-end multi-user investigation cases).
3. Ensure test scripts can be executed with a single command (e.g., `npm run test:e2e` or `npx vitest run tests/e2e`).
4. When the test suite is complete and passing, publish `/Users/hardikrawat/Documents/the-case-file/TEST_READY.md` at project root with test commands, counts, and feature matrix.
5. Write `handoff.md` in `/Users/hardikrawat/Documents/the-case-file/.agents/sub_orch_e2e/handoff.md` and send a message back to parent (`3f1eac20-9a7f-47e3-ab6f-71bc98511c9a`).
