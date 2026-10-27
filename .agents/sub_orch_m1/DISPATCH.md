# Dispatch Log

## 2026-09-04T14:58:58Z

You are the Sub-Orchestrator for Milestone 1 (Turso DB Cloud Persistence & Schema Integrity) of 'The Case File'.
Your working directory is `/Users/hardikrawat/Documents/the-case-file/.agents/sub_orch_m1`.
Your parent is `orchestrator_1` (conversation ID: `3f1eac20-9a7f-47e3-ab6f-71bc98511c9a`).

You MUST read the following files before starting:
- `/Users/hardikrawat/Documents/the-case-file/.agents/ORIGINAL_REQUEST.md`
- `/Users/hardikrawat/Documents/the-case-file/PROJECT.md`
- `/Users/hardikrawat/Documents/the-case-file/.agents/sub_orch_m1/SCOPE.md`
- `/Users/hardikrawat/Documents/the-case-file/.agents/teamwork_preview_explorer_survey_1/handoff.md`

Your mission:
1. Environment & Config: Create/populate `.env.local` with verified Turso credentials from `SCOPE.md` and add db scripts (`db:push`, `db:generate`) to `package.json`.
2. Client Fail-Fast: Update `src/lib/db.ts` to strictly eliminate `:memory:` fallback and throw fatal descriptive errors if `TURSO_DATABASE_URL` is missing or remote URL lacks `TURSO_AUTH_TOKEN`.
3. Schema Synchronization & Integrity: Update `src/lib/schema.ts` to add `isAnonymous` to `comments`, `version` to `boards`, `parentId` self-reference to `boards`, `notifications` table, unique index on `boardCollaborators(boardId, userId)`, and indexes across foreign keys and queried columns.
4. Execute `npx drizzle-kit push` against cloud Turso DB to synchronize schema cleanly without dropping tables.
5. Soft-Delete Alignment: Filter `isNull(boards.deletedAt)` in `GET /api/boards`, `GET /api/boards/[id]`, discover page, landing page, and profile; implement `DELETE /api/boards/[id]` setting `deletedAt = new Date()`.

Follow the Project Pattern Orchestration:
- Run the Iteration Loop (2B):
  a. Spawn Explorers (`teamwork_preview_explorer`) to plan code modifications.
  b. Spawn Worker (`teamwork_preview_worker`) with the MANDATORY INTEGRITY WARNING to implement changes, run drizzle-kit push, and test.
  c. Spawn 2 Reviewers (`teamwork_preview_reviewer`) to review code and test results.
  d. Spawn 2 Challengers (`teamwork_preview_challenger`) to stress-test fail-fast behavior, constraints, and soft-delete queries.
  e. Spawn Forensic Auditor (`teamwork_preview_auditor`) to verify genuine Turso connection and no facade code.
  f. Evaluate Gate in `GATE_STATUS.md`.
- Once all pass, write `handoff.md` in `/Users/hardikrawat/Documents/the-case-file/.agents/sub_orch_m1/handoff.md` and send a completion message back to parent (`3f1eac20-9a7f-47e3-ab6f-71bc98511c9a`).
