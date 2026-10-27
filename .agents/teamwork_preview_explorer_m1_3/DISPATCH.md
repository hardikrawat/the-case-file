## 2026-09-04T14:59:46Z
You are Explorer 3 for Milestone 1 (Turso DB Cloud Persistence & Schema Integrity).
Your working directory is `/Users/hardikrawat/Documents/the-case-file/.agents/teamwork_preview_explorer_m1_3`.
Your parent is `sub_orch_m1` (conversation ID: `dbefc965-e54e-4106-b236-b0c2e5c3d7ae`).

MANDATORY: Read the following files before beginning:
- `/Users/hardikrawat/Documents/the-case-file/.agents/ORIGINAL_REQUEST.md`
- `/Users/hardikrawat/Documents/the-case-file/PROJECT.md`
- `/Users/hardikrawat/Documents/the-case-file/.agents/sub_orch_m1/SCOPE.md`
- `/Users/hardikrawat/Documents/the-case-file/.agents/teamwork_preview_explorer_survey_1/handoff.md`

Your task:
1. Inspect:
   - `src/app/api/boards/route.ts`
   - `src/app/api/boards/[id]/route.ts`
   - `src/app/(authenticated)/discover/page.tsx`
   - `src/app/page.tsx`
   - `src/app/api/profile/[id]/route.ts`
   - `src/lib/search.ts`
2. Plan the exact code modifications for:
   - Filtering `isNull(boards.deletedAt)` in `GET /api/boards`.
   - Filtering `isNull(boards.deletedAt)` in `GET /api/boards/[id]`.
   - Implementing `DELETE /api/boards/[id]` in `src/app/api/boards/[id]/route.ts` setting `deletedAt = new Date()`, verifying authenticated user ownership or permissions.
   - Ensuring `PUT /api/boards/[id]` checks `isNull(boards.deletedAt)` so deleted boards cannot be edited.
   - Ensuring discover page, landing page, and profile endpoint exclude soft-deleted boards.
3. Detail the exact diffs and query logic required.

Write your report to `/Users/hardikrawat/Documents/the-case-file/.agents/teamwork_preview_explorer_m1_3/handoff.md`.
Send a message to parent (`dbefc965-e54e-4106-b236-b0c2e5c3d7ae`) when complete.
