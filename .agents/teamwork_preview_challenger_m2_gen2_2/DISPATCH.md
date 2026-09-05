# Challenger 2 Dispatch - Milestone 2
- Working directory: /Users/hardikrawat/Documents/the-case-file/.agents/teamwork_preview_challenger_m2_gen2_2

## 2026-09-04T16:14:38Z
You are Challenger 2 for Milestone 2: Security Hardening & Auth Protection.
Working Directory: /Users/hardikrawat/Documents/the-case-file/.agents/teamwork_preview_challenger_m2_gen2_2
Parent: Sub-Orchestrator Milestone 2 (Conversation ID: 3cafafc6-bb20-4b00-bb5d-54223a3a8175)

Mandatory reading before starting:
- /Users/hardikrawat/Documents/the-case-file/.agents/ORIGINAL_REQUEST.md (Subagents MUST read it before starting work)
- /Users/hardikrawat/Documents/the-case-file/PROJECT.md
- /Users/hardikrawat/Documents/the-case-file/.agents/sub_orch_m2_gen2/SCOPE.md
- /Users/hardikrawat/Documents/the-case-file/.agents/teamwork_preview_worker_m2_gen2_1/handoff.md

Your Objective:
Empirically attack and challenge Rate Limiting, IDOR authorization, and File Upload security.
Write and run empirical stress test scripts (using `npx tsx` or node) to verify:
1. **Atomic Rate Limiting Stress Test**:
   - Execute a concurrent burst of requests (e.g. 20-30 concurrent calls to `checkRateLimit` with a cap of 5) against the live database.
   - Verify that exactly the capped number succeed and the remainder return `{ success: false }`.
   - Verify zero database locking errors, zero TOCTOU count bypasses, and atomic expiration reset behavior.
2. **IDOR & Authorization Access Matrix Attack**:
   - Test `getBoardAccess` and route handler authorization:
     - Non-collaborator attempting to access private board -> `canView: false, canEdit: false, isOwner: false`.
     - Soft-deleted board (`deletedAt IS NOT NULL`) -> returns null board and denies all permissions even to owner.
     - Viewer collaborator attempting to edit or delete -> `canEdit: false, isOwner: false`.
     - Editor collaborator attempting owner-only actions (e.g. `isPublic` change) -> denied.
3. **File Upload Security Attack**:
   - Test file upload endpoint with:
     - Executable script disguised as image (`test.php.png` or HTML payload with `image/png` header).
     - Corrupted or non-image magic bytes.
     - Oversized payloads (>5MB).
     - Verify buffer magic byte validation rejects non-images and extension is strictly mapped from detected magic bytes.

Deliverables:
- Save test scripts in `scripts/test-challenger-m2-ratelimit-idor.ts` (or your agent working directory).
- Execute the scripts and capture verbatim outputs.
- Write a comprehensive verification report with empirical evidence and verdict in:
  `/Users/hardikrawat/Documents/the-case-file/.agents/teamwork_preview_challenger_m2_gen2_2/handoff.md`.
- Send a message back to parent (3cafafc6-bb20-4b00-bb5d-54223a3a8175).
