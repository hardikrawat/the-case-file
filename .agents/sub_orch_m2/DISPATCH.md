## 2026-09-04T15:17:29Z

You are the Sub-Orchestrator for Milestone 2 (Authentication, Authorization & Security Hardening - R2) of 'The Case File'.
Your working directory is `/Users/hardikrawat/Documents/the-case-file/.agents/sub_orch_m2`.
Your parent is `orchestrator_1` (conversation ID: `3f1eac20-9a7f-47e3-ab6f-71bc98511c9a`).

You MUST read the following files before starting:
- `/Users/hardikrawat/Documents/the-case-file/.agents/ORIGINAL_REQUEST.md`
- `/Users/hardikrawat/Documents/the-case-file/PROJECT.md`
- `/Users/hardikrawat/Documents/the-case-file/.agents/sub_orch_m2/SCOPE.md`
- `/Users/hardikrawat/Documents/the-case-file/.agents/teamwork_preview_explorer_survey_2/handoff.md`

Your mission:
1. Eliminate all `x-test-bypass` headers and mock board synthesis from `src/auth.ts`, `src/auth.config.ts`, and `src/app/(authenticated)/board/[id]/page.tsx`. Ensure `isNull(boards.deletedAt)` is checked on the board page query.
2. Route Protection: Guard `/board/*`, `/profile/*`, `/leaderboard` in `auth.config.ts` middleware.
3. Fix Token/Credential Leakage:
   - Remove `verificationToken` from `POST /api/auth/signup` response and update `src/app/signup/page.tsx` redirect.
   - Remove `resetToken` from `POST /api/auth/forgot-password` response.
   - Strip `passwordHash` from `GET /api/me` and `PUT /api/profile/[id]`.
   - Protect email and private boards count in `GET /api/profile/[id]` and `src/lib/search.ts`.
4. Secure `GET /api/preview` against SSRF:
   - Validate URL format and protocol (`http:`, `https:`).
   - Resolve DNS and block private/reserved IPs (127.0.0.1, localhost, 169.254.169.254, RFC1918 subnets, IPv6 loopback). Return 400 Bad Request if private.
   - Manual redirect handling, 5s timeout, rate limiting.
5. Atomic Rate Limiting:
   - Rewrite `checkRateLimit` in `src/lib/rate-limit.ts` to use atomic SQLite UPSERT with RETURNING clause. Add rate limiting to previously unprotected endpoints. Fix timestamp in `src/lib/account-security.ts`.
6. Authorization & IDOR Protection:
   - Implement `src/lib/auth-checks.ts` with `getBoardAccess(boardId, userId)` helper.
   - Protect comments, contributions, collaborators, and board visibility updates.
7. File Upload Hardening:
   - In `src/app/api/upload/route.ts`: strictly map allowed MIME types to extensions, never trust client extension, verify buffer magic bytes.

Follow the Project Pattern Orchestration:
- Assess -> Run Iteration Loop (2B):
  a. Spawn Explorers (`teamwork_preview_explorer`) to plan code modifications.
  b. Spawn Worker (`teamwork_preview_worker`) with the MANDATORY INTEGRITY WARNING to implement changes and test.
  c. Spawn 2 Reviewers (`teamwork_preview_reviewer`) to review code and test results.
  d. Spawn 2 Challengers (`teamwork_preview_challenger`) to probe test bypass rejection (401), SSRF blocking (400), token absence, and rate limiting atomicity.
  e. Spawn Forensic Auditor (`teamwork_preview_auditor`) to verify zero backdoors and genuine security controls.
  f. Evaluate Gate in `GATE_STATUS.md`.
- Once all pass, write `handoff.md` in `/Users/hardikrawat/Documents/the-case-file/.agents/sub_orch_m2/handoff.md` and send a completion message back to parent (`3f1eac20-9a7f-47e3-ab6f-71bc98511c9a`).
