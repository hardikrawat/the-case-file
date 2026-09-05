# DISPATCH for Explorer 1 (Auth Bypass Elimination, Route Protection & Credential Privacy)

## Mission
Investigate the codebase and write a comprehensive technical implementation plan for:
1. Eliminating all `x-test-bypass` headers and mock board synthesis from `src/auth.ts`, `src/auth.config.ts`, and `src/app/(authenticated)/board/[id]/page.tsx`. Ensure `isNull(boards.deletedAt)` is checked on the board page query. Also check `playwright.config.ts` and `tests/e2e/smoke.spec.ts`.
2. Route Protection in `src/auth.config.ts`: Add `/board`, `/profile`, `/leaderboard` to `protectedPaths` (`['/cases', '/discover', '/board', '/profile', '/leaderboard', '/settings', '/starred']`). Verify redirect behavior to `/login`.
3. Eliminating Token & Credential Leakage:
   - `POST /api/auth/signup`: Remove `verificationToken` from JSON response. Update `src/app/signup/page.tsx:81` to redirect to `/signup/verify?email=${encodeURIComponent(formData.email)}` without `token`.
   - `POST /api/auth/forgot-password`: Remove `resetToken: token`. Return `{ success: true, message: 'If an account exists with this email, a password reset link has been sent' }`.
   - `GET /api/me`: Strip `passwordHash` before returning user session payload (`const { passwordHash, ...safeUser } = user`).
   - `PUT /api/profile/[id]`: Exclude `passwordHash` in `.returning({ id: users.id, name: users.name, bio: users.bio, avatarUrl: users.avatarUrl })`.
   - `GET /api/profile/[id]`: Do not expose email unless `session?.user?.id === params.id`. Exclude private boards from `boardsCount` for non-owners.
   - `src/lib/search.ts`: Omit `email` from user search results.
   - `src/app/api/auth/verify-email/route.ts`: Rate limit and validate tokens strictly.

## Required Reading
- `/Users/hardikrawat/Documents/the-case-file/.agents/ORIGINAL_REQUEST.md`
- `/Users/hardikrawat/Documents/the-case-file/PROJECT.md`
- `/Users/hardikrawat/Documents/the-case-file/.agents/sub_orch_m2/SCOPE.md`
- `/Users/hardikrawat/Documents/the-case-file/.agents/teamwork_preview_explorer_survey_2/handoff.md`

## Output Requirements
Write your detailed plan and findings to `/Users/hardikrawat/Documents/the-case-file/.agents/explorer_m2_1/handoff.md`.
Include exact file paths, line numbers, proposed diffs/code snippets, edge cases, and verification commands.
Send a message back to parent when complete.

## 2026-09-04T15:18:35Z
You are Explorer 1 for Milestone 2 (Auth Bypass Elimination, Route Protection & Credential Privacy).
Your working directory is `/Users/hardikrawat/Documents/the-case-file/.agents/explorer_m2_1`.

You MUST read:
- `/Users/hardikrawat/Documents/the-case-file/.agents/ORIGINAL_REQUEST.md`
- `/Users/hardikrawat/Documents/the-case-file/PROJECT.md`
- `/Users/hardikrawat/Documents/the-case-file/.agents/sub_orch_m2/SCOPE.md`
- `/Users/hardikrawat/Documents/the-case-file/.agents/explorer_m2_1/DISPATCH.md`
- `/Users/hardikrawat/Documents/the-case-file/.agents/teamwork_preview_explorer_survey_2/handoff.md`

Your task is to investigate the exact source files, verify line numbers and structures, and produce a comprehensive technical implementation plan in `/Users/hardikrawat/Documents/the-case-file/.agents/explorer_m2_1/handoff.md` for:
1. Eliminating all `x-test-bypass` header inspection and mock board fabrication from `src/auth.ts`, `src/auth.config.ts`, and `src/app/(authenticated)/board/[id]/page.tsx` (ensuring `isNull(boards.deletedAt)` is checked on the board query). Check `playwright.config.ts` and `tests/e2e/smoke.spec.ts`.
2. Expanding protected route middleware in `src/auth.config.ts` to include `/board`, `/profile`, `/leaderboard` (`['/cases', '/discover', '/board', '/profile', '/leaderboard', '/settings', '/starred']`).
3. Eliminating credential and token leakage:
   - `src/app/api/auth/signup/route.ts` (remove `verificationToken` from JSON response) and `src/app/signup/page.tsx:81` (update redirect to `/signup/verify?email=${encodeURIComponent(formData.email)}` without token).
   - `src/app/api/auth/forgot-password/route.ts` (remove `resetToken: token`).
   - `src/app/api/me/route.ts` (strip `passwordHash`).
   - `src/app/api/profile/[id]/route.ts` (exclude `passwordHash` on PUT; protect email and private boards count on GET).
   - `src/lib/search.ts` (omit email from search results).
   - `src/app/api/auth/verify-email/route.ts` (rate limiting and security).

Write your detailed findings and concrete implementation code snippets into `/Users/hardikrawat/Documents/the-case-file/.agents/explorer_m2_1/handoff.md`. Do not modify source code yourself. When finished, send a completion message to parent.
