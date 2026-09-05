# Scope: Milestone 2 - Security Hardening & Auth Protection (R2)

## Mission
Eliminate all test authentication bypasses (`x-test-bypass`), fix token and credential leakages (verification tokens, reset tokens, password hashes), secure the URL preview endpoint against SSRF attacks, implement atomic SQLite rate limiting, and enforce authorization and IDOR protections across all routes.

## Authoritative Inputs
- User Request: `/Users/hardikrawat/Documents/the-case-file/.agents/ORIGINAL_REQUEST.md`
- Master Project Architecture & Contracts: `/Users/hardikrawat/Documents/the-case-file/PROJECT.md`
- Master Test Infra: `/Users/hardikrawat/Documents/the-case-file/TEST_INFRA.md`
- Forensic Survey Report: `/Users/hardikrawat/Documents/the-case-file/.agents/teamwork_preview_explorer_survey_2/handoff.md`
- Working Directory: `/Users/hardikrawat/Documents/the-case-file/.agents/sub_orch_m2_gen2`

## Required Features & Scope Boundaries (Features 6-15)

1. **Eliminate All Test Auth Bypasses (Feature 6)**:
   - `src/auth.ts`: Remove lines inspecting `x-test-bypass`. Export `auth` directly from `NextAuth`.
   - `src/auth.config.ts`: Remove lines checking `x-test-bypass`.
   - `src/app/(authenticated)/board/[id]/page.tsx`: Remove lines checking `isTestBypass` and synthesizing mock boards. Ensure `isNull(boards.deletedAt)` is checked on the board query.
   - `playwright.config.ts` & `tests/e2e/smoke.spec.ts`: Ensure no `x-test-bypass` headers are sent.

2. **Route Protection & Middleware Hardening (Feature 7)**:
   - `src/auth.config.ts`: Add `/board`, `/profile`, `/leaderboard` to `protectedPaths` (`['/cases', '/discover', '/board', '/profile', '/leaderboard', '/settings', '/starred']`).
   - Ensure unauthenticated users navigating to protected paths are redirected to `/login`.

3. **Eliminate Token & Credential Leakage (Features 8, 9, 10, 11)**:
   - `POST /api/auth/signup`: Remove `verificationToken` from JSON response. Update `src/app/signup/page.tsx` to redirect to `/signup/verify?email=${encodeURIComponent(formData.email)}` without `token`.
   - `POST /api/auth/forgot-password`: Remove `resetToken: token`. Return `{ success: true, message: 'If an account exists with this email, a password reset link has been sent' }`.
   - `GET /api/me`: Strip `passwordHash` before returning user session payload (`const { passwordHash, ...safeUser } = user`).
   - `PUT /api/profile/[id]`: Exclude `passwordHash` in `.returning({ id: users.id, name: users.name, bio: users.bio, avatarUrl: users.avatarUrl })`.
   - `GET /api/profile/[id]`: Do not expose email unless `session?.user?.id === params.id`. Exclude private boards from `boardsCount` for non-owners.
   - `src/lib/search.ts`: Omit `email` from user search results.
   - `src/app/api/auth/verify-email/route.ts`: Rate limit and validate tokens strictly.

4. **SSRF Protection in `GET /api/preview` (Feature 12)**:
   - In `src/app/api/preview/route.ts`:
     - Parse URL with `new URL(url)`. Reject invalid formats (400 Bad Request).
     - Strict protocol check: `parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:'`.
     - Resolve hostname using `dns.promises.lookup(hostname, { all: true })`.
     - Block all private/reserved IPv4 & IPv6 addresses:
       - `127.0.0.0/8`, `localhost`, `0.0.0.0/8` (Loopback)
       - `169.254.0.0/16` (Link-Local & Cloud IMDS `169.254.169.254`)
       - `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` (RFC1918)
       - `::1`, `fc00::/7`, `fe80::/10`
     - If private or loopback, return `400 Bad Request` ("Access to private network address is forbidden").
     - Fetch with `redirect: 'manual'` (or re-validate redirect target URLs before following).
     - Add 5-second timeout via `AbortSignal.timeout(5000)`.
     - Add rate limiting: `checkRateLimit('preview:${ip}', 20, 60000)`.

5. **Atomic Rate Limiting Implementation (Feature 13)**:
   - In `src/lib/rate-limit.ts`:
     - Rewrite `checkRateLimit` to use an atomic SQLite UPSERT (`INSERT INTO rate_limits ... ON CONFLICT(key) DO UPDATE SET count = ... RETURNING ...`) to eliminate TOCTOU race conditions.
     - Add rate limiting across the 12 previously unprotected endpoints (verify-email, preview, boards CRUD, comments, contributions, search, leaderboard).
   - In `src/lib/account-security.ts`: Fix timestamp comparison in SQL to use Unix millisecond integers.

6. **Authorization & IDOR Protection (Feature 14)**:
   - Implement `src/lib/auth-checks.ts` with `getBoardAccess(boardId: string, userId?: string)` helper.
   - Enforce access control in:
     - `GET /api/comments` and `POST /api/comments`: check `canView` on `boardId`.
     - `GET /api/contributions`: check board ownership / collaborator access.
     - `GET /api/boards/[id]/collaborators`: verify caller is owner or collaborator before returning list.
     - `PUT /api/boards/[id]`: only allow owner (`userId === session.user.id`) to change `isPublic`.

7. **File Upload Hardening (Feature 15)**:
   - In `src/app/api/upload/route.ts`: strictly map allowed MIME types to extensions, never trust client extension, verify buffer magic bytes.

## Execution Iteration Loop
1. Spawn 3 Explorers (`teamwork_preview_explorer`) to inspect exact lines and plan changes.
2. Spawn Worker (`teamwork_preview_worker`) with MANDATORY INTEGRITY WARNING to implement and run tests.
3. Spawn 2 Reviewers (`teamwork_preview_reviewer`) to verify code correctness and test results.
4. Spawn 2 Challengers (`teamwork_preview_challenger`) to test exploit attempts (bypass rejection, SSRF blocking, token omission, rate limits).
5. Spawn Forensic Auditor (`teamwork_preview_auditor`) for integrity verification.
6. Evaluate Gate in `GATE_STATUS.md`.
7. Once all pass, write `handoff.md` and notify parent orchestrator.
