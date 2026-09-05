# Scope: E2E Testing Track Orchestrator

## Mission
Design and implement a comprehensive, requirement-driven, opaque-box automated test suite for 'The Case File' derived directly from user requirements and acceptance criteria in `ORIGINAL_REQUEST.md` and `PROJECT.md`.

## Authoritative Inputs
- User Request: `/Users/hardikrawat/Documents/the-case-file/.agents/ORIGINAL_REQUEST.md`
- Master Project Architecture & Feature Inventory: `/Users/hardikrawat/Documents/the-case-file/PROJECT.md`
- Working Directory: `/Users/hardikrawat/Documents/the-case-file/.agents/sub_orch_e2e`

## Core Responsibilities
1. **Design Test Infrastructure**:
   - Create `TEST_INFRA.md` at project root documenting test architecture, runner commands, and 4-tier coverage methodology.
   - Establish clean test harness using Vitest / Playwright that can run independently of implementation internals.
   - Remove dependency on test backdoors (`x-test-bypass` must NOT be used).
2. **Implement 4-Tier Test Cases**:
   - **Tier 1 - Feature Coverage**:
     - Security: Verify auth enforcement, verify signup/forgot-password zero token leakage, verify `/api/me` passwordHash stripping, verify SSRF blocking on loopback/cloud metadata.
     - Database & Turso: Verify remote connectivity, table existence, schema constraints, soft-delete filtering.
     - Canvas & Nodes: Verify 5 node types (Sticky, Text, Image, Article, Link), node creation/deletion, string cutting.
     - Collaboration & Reputation: Verify comments, collaborators, version history, export modal, reputation points, leaderboard.
   - **Tier 2 - Boundary & Corner Cases**:
     - Empty inputs, max-length titles/captions, rapid clicks, malformed URLs in preview, invalid JWTs, edge cases.
   - **Tier 3 - Cross-Feature Combinations**:
     - Forking a case -> adding Link and Sticky nodes -> inviting collaborator -> submitting contribution -> reviewing diff -> merging -> checking contributor reputation increase.
   - **Tier 4 - Real-World Application Scenarios**:
     - Multi-detective homicide investigation board, public discovery & starring, case export to PDF/PNG/JSON, version rollback after conflict.
3. **Publish Completion Artifact**:
   - When all test suites are written and verified, create `/Users/hardikrawat/Documents/the-case-file/TEST_READY.md` at project root detailing test runner commands, test counts per tier, and coverage checklist.
   - Hand off to parent orchestrator.
