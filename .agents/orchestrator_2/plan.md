# Plan: The Case File Remediation & Hardening

## Overview
This plan defines the step-by-step execution across Milestones 2-5 and the E2E Testing Track.

## Execution Sequence

### Track A: E2E Test Finalization (M-E2E)
- Dispatch a subagent / worker to verify all 4 tiers of test specs (`tests/e2e/tier1`, `tier2`, `tier3`, `tier4`), ensure smoke and infra tests run cleanly against Turso DB, and publish `TEST_READY.md`.

### Track B: Milestone 2 — Security Hardening & Auth Protection
- Features 6-15:
  1. Eliminate all `x-test-bypass` headers and mock board backdoors (`src/auth.ts`, `src/auth.config.ts`, `src/app/(authenticated)/board/[id]/page.tsx`).
  2. Route protection for `/board/*`, `/profile/*`, `/leaderboard` in middleware.
  3. Fix signup token leak (`verificationToken`), forgot-password reset token leak (`resetToken`).
  4. Strip `passwordHash` from `GET /api/me` and `PUT /api/profile/[id]`.
  5. Privacy hardening: omit email from public profile and search.
  6. Preview SSRF guard: protocol validation, DNS resolution, private IP blocking.
  7. Atomic rate limiting: SQLite UPSERT and protect 12 endpoints.
  8. IDOR protection: `getBoardAccess` helper for comments, contributions, collaborators.
  9. File upload hardening: MIME whitelist, extension enforcement, magic numbers.
- Gate verification: Reviewers, Challengers, Forensic Auditor.

### Track C: Milestone 3 — Canvas Board & Orphaned Panels Wiring
- Features 16-25:
  1. Fix build blocker: restore `connectMode` in store and board components.
  2. Implement `LinkNode.tsx` with detective styling and register in Board & Toolbar.
  3. Node deletion UI: delete action on all nodes with edge cleanup.
  4. String cutting sync: synchronize edge cutting in `StringEdge.tsx` with `useStore.deleteEdge`.
  5. Board state isolation: per-board store scoping, purge node/edge pollution from localStorage.
  6. Optimistic locking & auto-save: version check on save.
  7. Mount CommentsPanel in Board UI with user details join.
  8. Mount CollaboratorsPanel in Board UI with email lookup and DELETE/PATCH.
  9. Mount VersionHistory in Board UI with auto-save snapshots.
  10. Mount ExportModal in Board UI with PNG, PDF, JSON export.
- Gate verification: Reviewers, Challengers, Forensic Auditor.

### Track D: Milestone 4 — Reputation, Collaboration & Lineage
- Features 26-30:
  1. Reputation engine wiring: wire `awardPoints` into board creation, publishing, comments, contributions.
  2. Leaderboard user joins: join `users` in `GET /api/leaderboard` for real names and ranks.
  3. Unified rank titles: standardize thresholds across profile, leaderboard, and reputation lib.
  4. Case lineage indicators: parent board data, lineage banner, fork badges.
  5. Contribution visual diff: visual highlighting of added, modified, unchanged nodes.
- Gate verification: Reviewers, Challengers, Forensic Auditor.

### Track E: Milestone 5 — Full E2E Test Suite & Final Audit
- Pass 100% of Tiers 1-4 E2E tests.
- Tier 5 adversarial hardening with Challenger.
- Forensic Auditor integrity check.
- Final full build, lint, and test validation (`npm run lint`, `npm run build`, `npm run test`).
- Send completion report to parent Sentinel.
