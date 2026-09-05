## 2026-09-04T15:05:00Z

You are Worker 1 for Milestone 1 (Turso DB Cloud Persistence & Schema Integrity).
Your working directory is `/Users/hardikrawat/Documents/the-case-file/.agents/teamwork_preview_worker_m1_1`.
Your parent is `sub_orch_m1` (conversation ID: `dbefc965-e54e-4106-b236-b0c2e5c3d7ae`).

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

MANDATORY: Read the following files before beginning:
- `/Users/hardikrawat/Documents/the-case-file/.agents/ORIGINAL_REQUEST.md`
- `/Users/hardikrawat/Documents/the-case-file/PROJECT.md`
- `/Users/hardikrawat/Documents/the-case-file/.agents/sub_orch_m1/SCOPE.md`
- `/Users/hardikrawat/Documents/the-case-file/.agents/teamwork_preview_explorer_m1_1/handoff.md`
- `/Users/hardikrawat/Documents/the-case-file/.agents/teamwork_preview_explorer_m1_2/handoff.md`
- `/Users/hardikrawat/Documents/the-case-file/.agents/teamwork_preview_explorer_m1_3/handoff.md`
- `/Users/hardikrawat/Documents/the-case-file/.agents/teamwork_preview_explorer_m1_2/proposed_schema.ts`

Your exclusive write ownership:
- `/Users/hardikrawat/Documents/the-case-file/.env.local`
- `/Users/hardikrawat/Documents/the-case-file/package.json`
- `/Users/hardikrawat/Documents/the-case-file/drizzle.config.ts`
- `/Users/hardikrawat/Documents/the-case-file/src/lib/db.ts`
- `/Users/hardikrawat/Documents/the-case-file/src/lib/schema.ts`
- `/Users/hardikrawat/Documents/the-case-file/src/app/api/boards/route.ts`
- `/Users/hardikrawat/Documents/the-case-file/src/app/api/boards/[id]/route.ts`
- `/Users/hardikrawat/Documents/the-case-file/src/app/(authenticated)/discover/page.tsx`
- `/Users/hardikrawat/Documents/the-case-file/src/app/page.tsx`
- `/Users/hardikrawat/Documents/the-case-file/src/app/api/profile/[id]/route.ts`
- `/Users/hardikrawat/Documents/the-case-file/src/lib/search.ts`

Execution Steps:
1. Environment & Scripts:
   - Create `.env.local` with exact credentials from `SCOPE.md`.
   - Update `package.json` with scripts: `"db:generate"`, `"db:push"`, `"db:migrate"`, `"db:studio"`, `"db:check"`, `"db:test"`.
2. Fail-Fast DB Client:
   - Replace `src/lib/db.ts` with the strict fail-fast implementation from Explorer 1's report (prohibit empty URL, prohibit `:memory:`, require `TURSO_AUTH_TOKEN` for remote URLs).
   - Update `drizzle.config.ts` to ensure clean loading of `.env.local`.
3. Schema Synchronization:
   - Update `src/lib/schema.ts` using the validated content in `/Users/hardikrawat/Documents/the-case-file/.agents/teamwork_preview_explorer_m1_2/proposed_schema.ts`.
4. Cloud Turso DB Push:
   - Run `npx drizzle-kit push` against the live cloud Turso database. Ensure all tables are preserved and indexes/columns are cleanly added.
5. Soft-Delete Alignment:
   - Implement changes in `src/app/api/boards/route.ts` (filter `isNull(boards.deletedAt)` in GET).
   - Implement changes in `src/app/api/boards/[id]/route.ts` (filter `isNull(boards.deletedAt)` in GET & PUT, add `DELETE` route per Explorer 3's specifications).
   - Implement soft-delete filters in `src/app/(authenticated)/discover/page.tsx`, `src/app/page.tsx`, `src/app/api/profile/[id]/route.ts`, and `src/lib/search.ts`.
6. Verification & Testing:
   - Run `npm run test:unit`
   - Run `npm run lint`
   - Run `npm run build`
   - Test fail-fast error throws when `TURSO_DATABASE_URL` is empty.
   - Test remote live connection query.

Document all actions, diffs, and test results in `/Users/hardikrawat/Documents/the-case-file/.agents/teamwork_preview_worker_m1_1/handoff.md`.
Send a completion message back to parent (`dbefc965-e54e-4106-b236-b0c2e5c3d7ae`).
