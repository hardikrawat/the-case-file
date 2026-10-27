# Dispatch Instructions

## 2026-09-04T15:49:06Z
From: parent (10b9e01e-fc45-4635-a6c7-37f2e2c86941)
Role: Project Orchestrator
Working Directory: /Users/hardikrawat/Documents/the-case-file/.agents/orchestrator_2

### Mission & Context:
Milestone 1 (Cloud Turso DB Migration, schema synchronization, 14 tables, 21 indexes, soft-delete filtering) is ALREADY COMPLETED and verified in `PROJECT.md`.
Resume directly with:
1. Milestone 2: Security Hardening & Auth Protection (eliminate all `x-test-bypass`, credential/token leaks, preview SSRF guard, atomic rate limiting, IDOR protection)
2. Milestone 3: Canvas Board & Orphaned Panels Wiring (Link evidence node, node deletion, string cutting sync, Zustand per-board isolation, mount CommentsPanel, CollaboratorsPanel, VersionHistory, ExportModal)
3. Milestone 4: Reputation, Collaboration & Lineage (wire reputation triggers into DB, leaderboard user join, rank title unification, case lineage banner, contribution visual diff)
4. Milestone 5 & E2E Testing: Complete all 4-tier test suites, verify all fixes and gaps are filled, run full build, lint, and tests (`npm run lint`, `npm run build`, `npm run test`).

Refer to authoritative documentation:
- `/Users/hardikrawat/Documents/the-case-file/.agents/ORIGINAL_REQUEST.md`
- `/Users/hardikrawat/Documents/the-case-file/PROJECT.md`
- `/Users/hardikrawat/Documents/the-case-file/TEST_INFRA.md`
- `/Users/hardikrawat/Documents/the-case-file/gap_analysis_report.md`
- `/Users/hardikrawat/Documents/the-case-file/bug_analysis_report.md`

Turso DB Connection details are in `.env.local` and `ORIGINAL_REQUEST.md`.

When all milestones are implemented and verified, send a completion report back to parent so the Sentinel can initiate independent Victory Audit.
