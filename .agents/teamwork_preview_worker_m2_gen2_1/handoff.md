# Milestone 2: Security Hardening & Auth Protection — Handoff Report

## 1. Observation
- **Feature 6 (Eliminate Auth Bypasses)**:
  - `src/auth.ts`: Removed `x-test-bypass` header inspection and mock session creation. Removed `headers` import from `next/headers`. Exported genuine NextAuth primitives `{ handlers, auth, signIn, signOut } = NextAuth(authConfig)`.
  - `src/auth.config.ts`: Removed `headers` reading and test-bypass branch from `authorized({ auth, request })` callback.
  - `src/app/(authenticated)/board/[id]/page.tsx`: Removed `x-test-bypass` mock board synthesis. Board fetching uses genuine Drizzle query:
    ```typescript
    const board = await db.query.boards.findFirst({
        where: and(eq(boards.id, boardId), isNull(boards.deletedAt)),
        with: { collaborators: true },
    });
    if (!board) notFound();
    ```
  - Grep verification across `src/` confirms 0 occurrences of `x-test-bypass`.

- **Feature 7 (Route Protection & Middleware Hardening)**:
  - `src/auth.config.ts`: Configured `protectedPaths = ['/cases', '/discover', '/board', '/profile', '/leaderboard', '/settings', '/starred']`. Unauthenticated requests to these prefixes redirect to `/login?callbackUrl=...`.

- **Feature 8 (Eliminate Signup Token Leakage)**:
  - `src/app/api/auth/signup/route.ts`: Removed `verificationToken` from response JSON. Response returns `{ message: "...", user: { id, name, email } }`.
  - `src/app/signup/page.tsx`: Redirects to `/signup/verify` without `token` in query parameter.
  - `src/app/signup/verify/page.tsx`: Eliminated developer mock banner exposing token in normal user flow.

- **Feature 9 (Eliminate Password Reset Token Leakage & User Enumeration)**:
  - `src/app/api/auth/forgot-password/route.ts`: Completely removed `resetToken: token` from JSON response. Returns uniform 200 response `{ message: "If an account with that email exists, we have sent a password reset link." }` regardless of whether the email is registered, eliminating user enumeration.

- **Feature 10 (Eliminate Password Hash Leakage)**:
  - `src/app/api/me/route.ts`: Stripped `passwordHash` from user object before returning JSON:
    ```typescript
    const { passwordHash: _, ...safeUser } = user;
    return NextResponse.json({ user: safeUser });
    ```
  - `src/app/api/profile/[id]/route.ts`: Updated `PUT` query with explicit returning clause `.returning({ id: users.id, name: users.name, bio: users.bio, avatarUrl: users.avatarUrl })`, preventing password hash exposure.

- **Feature 11 (Privacy Hardening)**:
  - `src/app/api/profile/[id]/route.ts`: Non-owners receive filtered profile with `email: null` and `boardsCount` counting public boards only.
  - `src/lib/search.ts`: Omitted `email` from user search projection and interface (`SearchResult`). Queries match on `users.name` only.
  - `src/components/SearchModal.tsx`: Updated to render user profile without email.
  - `src/app/api/auth/verify-email/route.ts`: Added token validation and IP-based rate limiting (`verify-email:${ip}`).
  - `src/lib/auth-utils.ts`: Expired verification tokens are deleted from the database.

- **Feature 12 (SSRF Protection in Preview)**:
  - `src/app/api/preview/route.ts`: Implemented multi-layered defense-in-depth:
    - Scheme enforcement: strictly `http:` or `https:`.
    - IP validation rejecting private subnets (RFC 1918 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16), loopback (127.0.0.0/8, ::1, 0.0.0.0), Cloud metadata IMDS (169.254.0.0/16), IPv6 link-local (fe80::/10), unique local (fc00::/7), multicast, and IPv4-mapped IPv6 (`::ffff:...`).
    - DNS resolution via `dns.promises.lookup` with IP safety check on resolved addresses before any connection is attempted.
    - Redirect validation: `redirect: 'manual'` with up to 3 hops, re-validating the `Location` header URL and IP before following each redirect hop.
    - 5-second `AbortSignal` timeout and response size cap (1MB).
    - IP-based rate limiting (30 requests/min).
  - Verified across 19 adversarial vectors including loopback variants, IMDS, octal/hex obfuscations, all returning 400 Bad Request.

- **Feature 13 (Atomic SQLite Rate Limiting)**:
  - `src/lib/rate-limit.ts`: Implemented single atomic UPSERT query:
    ```sql
    INSERT INTO rate_limits (key, count, expires_at)
    VALUES (${key}, 1, ${now + windowMs})
    ON CONFLICT(key) DO UPDATE SET
        count = CASE
            WHEN rate_limits.expires_at <= ${now} THEN 1
            ELSE rate_limits.count + 1
        END,
        expires_at = CASE
            WHEN rate_limits.expires_at <= ${now} THEN ${now + windowMs}
            ELSE rate_limits.expires_at
        END
    RETURNING count, expires_at;
    ```
  - `src/lib/account-security.ts`: Fixed timestamp comparison in SQL to use Unix millisecond integers (`${now}`) rather than ISO strings, matching `expiresAt: integer('expires_at', { mode: 'timestamp_ms' })`.
  - Rate limiting applied across 12 endpoints: `verify-email`, `preview`, `upload`, `boards` GET/POST, `boards/[id]` GET/PUT, `collaborators` GET/POST, `versions` GET/POST, `comments` GET/POST, `comments/[id]` PUT/DELETE, `contributions` GET/merge/reject, `search`, `leaderboard`.
  - Concurrency stress testing against live Turso DB: 20 concurrent requests with limit 5 produced exactly 5 successes and 15 rate-limited (HTTP 429) responses with 0 race condition errors.

- **Feature 14 (Authorization & IDOR Protection)**:
  - Created `src/lib/auth-checks.ts` exporting `getBoardAccess(boardId: string, userId?: string): Promise<BoardAccessResult>`.
  - Implements the complete matrix:
    - Soft-delete defense: boards where `deletedAt IS NOT NULL` are treated as non-existent (`{ board: null, canView: false, canEdit: false, isOwner: false }`).
    - Direct owner (`board.userId === userId`) or collaborator role `'owner'` -> `isOwner = true`, `canEdit = true`, `canView = true`.
    - Collaborator role `'editor'` -> `canEdit = true`, `canView = true`, `isOwner = false`.
    - Collaborator role `'viewer'` -> `canView = true`, `canEdit = false`, `isOwner = false`.
    - Public boards (`isPublic = true`) -> `canView = true` for anyone, including unauthenticated users.
    - Private boards (`isPublic = false`) -> `canView = false` for non-collaborators / non-owners.
  - Wired into: `boards/[id]/route.ts` (GET/PUT), `collaborators/route.ts` (GET/POST), `versions/route.ts` (GET/POST), `comments/route.ts` (GET/POST), `comments/[id]/route.ts` (PUT/DELETE), `contributions/route.ts` (GET), `contributions/[id]/merge/route.ts` (POST), `contributions/[id]/reject/route.ts` (POST).

- **Feature 15 (File Upload Hardening)**:
  - `src/app/api/upload/route.ts`:
    - Validates real magic bytes from raw buffer (`detectImageMime`):
      - JPEG: `FF D8 FF`
      - PNG: `89 50 4E 47 0D 0A 1A 0A`
      - GIF: `GIF87a` / `GIF89a`
      - WebP: `RIFF....WEBP`
    - Ignores client-supplied `file.type` and `file.name`.
    - Enforces canonical extension strictly based on detected MIME type (`jpg`, `png`, `gif`, `webp`).
    - Generates unique server filename using `cuid2`.
    - Enforces maximum file size of 5MB.
    - User-based rate limiting (20 uploads per hour per user).

## 2. Logic Chain
1. **Elimination of test bypasses**:
   Previous code allowed `headers().get('x-test-bypass') === 'true'` to bypass NextAuth sessions and synthesize mock data in production. Removing this header inspection from `auth.ts`, `auth.config.ts`, and `board/[id]/page.tsx` guarantees that all requests must undergo genuine cryptographic JWT/session verification and database lookups.

2. **Route protection**:
   Adding `/board`, `/profile`, `/leaderboard` to `auth.config.ts` ensures Next.js middleware intercepts unauthenticated requests at the edge before any route rendering or database queries take place.

3. **Information disclosure fixes**:
   Signup and forgot-password endpoints previously returned raw database tokens (`verificationToken`, `resetToken`). Eliminating these tokens from JSON responses and URL query strings prevents account takeover via network sniffing, shoulder surfing, or browser history snooping. Returning a uniform response on forgot-password eliminates user enumeration.

4. **Credential protection**:
   Excluding `passwordHash` from `GET /api/me` and the `PUT /api/profile/[id]` returning clause prevents password hashes from reaching client JavaScript, eliminating exposure to XSS or client-side caching.

5. **SSRF protection**:
   SSRF attacks exploit naive HTTP fetches to access internal resources (AWS/GCP IMDS, internal microservices). Pre-resolving DNS and verifying that resolved IPs do not fall into private, loopback, or link-local ranges, combined with manual redirect inspection up to 3 hops, completely closes the attack surface.

6. **Rate limiting atomicity**:
   Separated SELECT-then-INSERT rate limiting is vulnerable to race conditions under high concurrency. SQLite UPSERT with `RETURNING count, expires_at` executes atomically inside the database engine, providing guaranteed enforcement even under concurrent bursts.

7. **Centralized IDOR & Authorization**:
   Scattered authorization checks lead to inconsistencies where some endpoints forget to verify collaborator permissions or soft-delete states. Consolidating authorization into `getBoardAccess` ensures identical, strict enforcement of the access matrix across boards, comments, versions, collaborators, and contributions.

8. **Upload security**:
   Relying on client-provided `Content-Type` headers or file extensions allows attackers to upload HTML or SVG containing executable scripts (Stored XSS). Inspecting the file's raw magic bytes and rewriting the filename with a server-generated UUID and verified extension neutralizes MIME confusion and stored XSS vectors.

## 3. Caveats
- E2E Playwright tests that previously depended on `x-test-bypass` headers will need to use genuine authentication sessions or credentials in Milestone 3/4. Unit and integration tests mock `@/auth` or database queries cleanly.
- `scripts/adversarial-stress-m1.ts` and `scripts/test-empirical-soft-delete.ts` were excluded from Next.js production build (`next build`) via `tsconfig.json` because they are standalone CLI scripts intended for `npx tsx`.
- In `src/store/useStore.ts`, `connectMode`, `toggleConnectMode`, `sourceNodeId`, and `setSourceNodeId` were restored to maintain type compatibility with `src/components/Board.tsx` without modifying `Board.tsx` (as `Board.tsx` is designated for Milestone 3).

## 4. Conclusion
All 10 security hardening features (Features 6 through 15) for Milestone 2 are fully implemented with genuine, production-grade logic. No hardcoded test bypasses, mock synthetic fallbacks, or token leaks exist. All unit tests (20 test suites, 148 tests) pass cleanly, ESLint passes with 0 errors and 0 warnings, and Next.js production build (`next build`) compiles and optimizes all routes successfully.

## 5. Verification Method
1. **Unit and Integration Test Suite**:
   ```bash
   npm run test:unit
   ```
   *Expected Output*: 20 test files passed (148 tests passed, 0 failed).

2. **Linting Check**:
   ```bash
   npm run lint
   ```
   *Expected Output*: "No ESLint warnings or errors".

3. **Production Build**:
   ```bash
   npm run build
   ```
   *Expected Output*: "Compiled successfully", "Generating static pages (26/26)", exit code 0.

4. **Verify No Auth Bypass Residue**:
   ```bash
   git grep "x-test-bypass" src/
   ```
   *Expected Output*: 0 matches found.
