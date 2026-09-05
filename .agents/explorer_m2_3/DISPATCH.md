# DISPATCH for Explorer 3 (Atomic Rate Limiting & IDOR Authorization Architecture)

## Mission
Investigate the codebase and write a comprehensive technical implementation plan for:
1. Atomic Rate Limiting:
   - In `src/lib/rate-limit.ts`: Rewrite `checkRateLimit` to use an atomic SQLite UPSERT (`INSERT INTO rate_limits ... ON CONFLICT(key) DO UPDATE SET count = ... RETURNING ...`) to eliminate TOCTOU race conditions and primary key collision errors on concurrent requests.
   - Fix timestamp comparison in `src/lib/account-security.ts` to ensure types match the integer/millisecond schema.
   - Catalog and plan rate limiting across the 12 previously unprotected endpoints:
     - `GET /api/auth/verify-email`
     - `GET /api/preview`
     - `POST /api/boards`, `GET /api/boards`, `GET /api/boards/[id]`, `PUT /api/boards/[id]`
     - `GET /api/boards/[id]/collaborators`, `POST /api/boards/[id]/collaborators`
     - `GET /api/boards/[id]/versions`, `POST /api/boards/[id]/versions`
     - `GET /api/comments`, `PUT /api/comments/[id]`, `DELETE /api/comments/[id]`
     - `GET /api/contributions`, `POST /api/contributions/[id]/merge`, `POST /api/contributions/[id]/reject`
     - `GET /api/search`
     - `GET /api/leaderboard`
2. Authorization & IDOR Protection:
   - Implement `src/lib/auth-checks.ts` with `getBoardAccess(boardId: string, userId?: string)` helper per interface contract in `PROJECT.md`.
   - Enforce access control in:
     - `GET /api/comments` and `POST /api/comments`: check `canView` on `boardId`.
     - `GET /api/contributions`: check board ownership / collaborator access for `type=received` or target board.
     - `GET /api/boards/[id]/collaborators`: verify caller is owner or collaborator before returning list.
     - `PUT /api/boards/[id]`: only allow owner (`userId === session.user.id`) to change `isPublic`.
     - Verify and plan any missing collaborator removal/edit or board delete if needed for security integrity.

## Required Reading
- `/Users/hardikrawat/Documents/the-case-file/.agents/ORIGINAL_REQUEST.md`
- `/Users/hardikrawat/Documents/the-case-file/PROJECT.md`
- `/Users/hardikrawat/Documents/the-case-file/.agents/sub_orch_m2/SCOPE.md`
- `/Users/hardikrawat/Documents/the-case-file/.agents/teamwork_preview_explorer_survey_2/handoff.md`

## Output Requirements
Write your detailed plan and findings to `/Users/hardikrawat/Documents/the-case-file/.agents/explorer_m2_3/handoff.md`.
Include exact file paths, line numbers, proposed diffs/code snippets, edge cases, and verification commands.
Send a message back to parent when complete.

## 2026-09-04T15:18:35Z
You are Explorer 3 for Milestone 2 (Atomic Rate Limiting & IDOR Authorization Architecture).
Your working directory is `/Users/hardikrawat/Documents/the-case-file/.agents/explorer_m2_3`.

You MUST read:
- `/Users/hardikrawat/Documents/the-case-file/.agents/ORIGINAL_REQUEST.md`
- `/Users/hardikrawat/Documents/the-case-file/PROJECT.md`
- `/Users/hardikrawat/Documents/the-case-file/.agents/sub_orch_m2/SCOPE.md`
- `/Users/hardikrawat/Documents/the-case-file/.agents/explorer_m2_3/DISPATCH.md`
- `/Users/hardikrawat/Documents/the-case-file/.agents/teamwork_preview_explorer_survey_2/handoff.md`

Your task is to investigate the exact source files and produce a comprehensive technical implementation plan in `/Users/hardikrawat/Documents/the-case-file/.agents/explorer_m2_3/handoff.md` for:
1. Atomic Rate Limiting:
   - In `src/lib/rate-limit.ts`: Rewrite `checkRateLimit` to use atomic SQLite UPSERT (`INSERT INTO rate_limits ... ON CONFLICT(key) DO UPDATE SET count = ... RETURNING ...`) to eliminate TOCTOU race conditions and duplicate key errors on concurrent requests.
   - Fix timestamp comparison in `src/lib/account-security.ts`.
   - Plan rate limiting across the 12 previously unprotected endpoints (verify-email, preview, boards CRUD, collaborators, versions, comments, contributions, search, leaderboard).
2. Authorization & IDOR Protection:
   - Implement `src/lib/auth-checks.ts` with `getBoardAccess(boardId: string, userId?: string)` helper per interface contract in `PROJECT.md`.
   - Enforce access control in `src/app/api/comments/route.ts` (`canView`), `src/app/api/contributions/route.ts` (board access), `src/app/api/boards/[id]/collaborators/route.ts` (board owner/collaborator), `src/app/api/boards/[id]/route.ts` (owner-only `isPublic` modification).

Write your detailed findings and concrete implementation code snippets into `/Users/hardikrawat/Documents/the-case-file/.agents/explorer_m2_3/handoff.md`. Do not modify source code yourself. When finished, send a completion message to parent.
