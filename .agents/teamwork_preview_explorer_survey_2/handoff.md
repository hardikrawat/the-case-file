# Comprehensive Security, Authentication & Authorization Survey Report (R2)

**Author**: Explorer 2 (Security & Auth Auditor)  
**Target Working Directory**: `/Users/hardikrawat/Documents/the-case-file/.agents/teamwork_preview_explorer_survey_2`  
**Date**: 2026-09-04  
**Scope**: Requirement R2 (Authentication, Authorization & Security Hardening) and all related security, access control, and privacy issues across 'The Case File' application.

---

## 1. Observation

### 1.1 Reference Documentation & Git Archaeology (Task 1)
- **Tool Commands**:
  - `find_by_name` for `*analysis*.md` and `*.md` in repository root.
  - `git log --all --pretty=format: --name-only | grep -iE "gap|bug|analysis|report"`
  - `git branch -a`, `git stash list`, `git fsck --lost-found`
- **Verbatim Result**:
  - `git stash list` returned empty (`0` stashes).
  - `git fsck --lost-found` returned empty (`0` dangling commits/blobs).
  - Remote branches `origin/improved-linking-functionality-in-board-editor` and `origin/improvement-in-existing-functionality` are both fully merged into `main` (0 commits ahead).
  - Neither `gap_analysis_report.md` nor `bug_analysis_report.md` exists as physical files on disk or in the git ref history. They are conceptual catalogues referenced in `ORIGINAL_REQUEST.md` (identifying 124 feature gaps and 157 bugs).
  - All security vulnerabilities and feature gaps must therefore be cataloged directly from static code analysis and structural inspection.

---

### 1.2 Authentication Infrastructure & Test Bypass Discovery (Tasks 2 & 3)

#### Observation 1.2.1: `src/auth.ts` Test Header Auth Bypass
- **File & Lines**: `src/auth.ts:114-132`
- **Direct Quote**:
  ```typescript
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const auth: any = async (...args: any[]) => {
      try {
          const headerList = await headers();
          if (headerList.get('x-test-bypass') === 'true') {
              return {
                  user: {
                      id: 'test-user-123',
                      email: 'test@example.com',
                      name: 'Test Detective'
                  },
                  expires: new Date(Date.now() + 86400000).toISOString()
              };
          }
      } catch {
          // Ignore error if headers() is called outside of request context
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (internalAuth as any)(...args);
  };
  ```
- **Finding**: Sending an HTTP header `x-test-bypass: true` completely bypasses authentication across the application and forces NextAuth to report an active session as `test-user-123`.

#### Observation 1.2.2: `src/auth.config.ts` Test Header Route Bypass
- **File & Lines**: `src/auth.config.ts:10-14`
- **Direct Quote**:
  ```typescript
  authorized({ auth, request: { nextUrl, headers } }) {
      // Allow bypass in test environment
      const isTestBypass = headers.get('x-test-bypass') === 'true';
      if (isTestBypass) return true;
  ```
- **Finding**: Any client providing `x-test-bypass: true` circumvents the NextAuth middleware `authorized` callback, allowing unauthorized access to protected routes.

#### Observation 1.2.3: `src/app/(authenticated)/board/[id]/page.tsx` Test Bypass & Mock Board Fabrication
- **File & Lines**: `src/app/(authenticated)/board/[id]/page.tsx:22-48`
- **Direct Quote**:
  ```typescript
  const headerList = await headers();
  const isTestBypass = headerList.get('x-test-bypass') === 'true';

  let board: BoardData | null = null;

  // Normal flow check
  const dbBoard = await db.query.boards.findFirst({
      where: eq(boards.id, boardId),
      with: {
          collaborators: true
      }
  });

  if (dbBoard) {
      board = dbBoard as unknown as BoardData;
  } else if (isTestBypass) {
      board = {
          id: boardId,
          title: 'Test Case',
          isPublic: true,
          userId: 'test-user-123',
          createdAt: new Date(),
          updatedAt: new Date(),
          collaborators: []
      };
  }
  ```
- **Finding**: When `x-test-bypass: true` is present, the board page fabricates an arbitrary mock board in-memory for non-existent or private board IDs, bypassing database queries and permission checks.

#### Observation 1.2.4: Test Files Injecting Test Bypass Header
- `playwright.config.ts:32`:
  ```typescript
  use: {
      extraHTTPHeaders: {
          'x-test-bypass': 'true',
      },
  }
  ```
- `tests/e2e/smoke.spec.ts:34`:
  ```typescript
  extraHTTPHeaders: {
      'x-test-bypass': 'true'
  }
  ```

---

### 1.3 Route Protection Gaps in Middleware & Auth Config (Task 2)

#### Observation 1.3.1: Incomplete Protected Paths List in `src/auth.config.ts`
- **File & Lines**: `src/auth.config.ts:16-17`
- **Direct Quote**:
  ```typescript
  const protectedPaths = ['/cases', '/discover', '/settings', '/starred'];
  const isOnProtected = protectedPaths.some(path => nextUrl.pathname.startsWith(path));
  ```
- **Finding**:
  - Protected paths list only includes `/cases`, `/discover`, `/settings`, `/starred`.
  - **Missing Protected Paths**:
    - `/board` and `/board/*` (Canvas evidence boards)
    - `/profile` and `/profile/*` (Detective profile dossiers)
    - `/leaderboard` (Global detective leaderboard)
  - Unauthenticated users can navigate directly to `/leaderboard` and `/profile/[id]` without being redirected to `/login`.
  - In `ORIGINAL_REQUEST.md:44`: *"All authenticated routes (/cases, /discover, /board/*, /profile/*, /leaderboard, /settings) enforce authentication."*

#### Observation 1.3.2: Middleware Exclusion of API Routes
- **File & Lines**: `src/middleware.ts:6-8`
- **Direct Quote**:
  ```typescript
  export const config = {
      matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
  };
  ```
- **Finding**: Middleware explicitly excludes all `/api/...` routes from NextAuth verification via the negative lookahead `(?!api)`. All API route handlers must independently enforce authentication checks.

#### Observation 1.3.3: Authenticated Layout Does Not Enforce Auth
- **File & Lines**: `src/app/(authenticated)/layout.tsx:4-20`
- **Finding**: The shared layout for `(authenticated)` routes contains zero authentication checks, relying entirely on route-level middleware.

---

### 1.4 Token Leakage & Credential Exposure in Endpoints (Task 4)

#### Observation 1.4.1: Verification Token Leaked in `POST /api/auth/signup`
- **File & Lines**: `src/app/api/auth/signup/route.ts:73-79`
- **Direct Quote**:
  ```typescript
  // In a production app, send email with verification link
  // For now, we'll return the token in the response for testing
  return NextResponse.json({
      success: true,
      userId,
      message: 'Account created successfully',
      // TODO: Remove in production, send via email instead
      verificationToken,
  }, { status: 201 });
  ```
- **Client Side Consumption**: `src/app/signup/page.tsx:81`
  ```typescript
  router.push(`/signup/verify?email=${encodeURIComponent(formData.email)}&token=${data.verificationToken}`);
  ```
- **Finding**: Sensitive email verification token is returned directly in HTTP JSON response body and consumed in URL parameters by the client, violating requirement R2 / AC 41.

#### Observation 1.4.2: Password Reset Token Leaked in `POST /api/auth/forgot-password` (Critical Account Takeover)
- **File & Lines**: `src/app/api/auth/forgot-password/route.ts:41-46`
- **Direct Quote**:
  ```typescript
  // TODO: Send email with reset link
  // For now, return token in response for testing
  return NextResponse.json({
      success: true,
      message: 'Password reset link sent',
      // TODO: Remove in production
      resetToken: token,
  });
  ```
- **Finding**: Any anonymous attacker can submit any user's email to `/api/auth/forgot-password` and receive the valid `resetToken` directly in the response body. The attacker can then immediately call `POST /api/auth/reset-password` with this token and hijack the victim's account without having access to their email inbox.

#### Observation 1.4.3: `passwordHash` Leaked in `GET /api/me`
- **File & Lines**: `src/app/api/me/route.ts:16-35`
- **Direct Quote**:
  ```typescript
  const user = await db.query.users.findFirst({
      where: eq(users.email, session.user.email),
      with: {
          reputation: true,
      },
  });
  ...
  return NextResponse.json({
      ...user,
      reputationPoints: rep?.points || 0,
      boardsCreated: rep?.boardsCreated || 0,
      contributionsAccepted: rep?.contributionsAccepted || 0,
  });
  ```
- **Finding**: Spreading `...user` leaks all user table columns, specifically `passwordHash`, to the client. This violates requirement R2 / AC 43 (*"`GET /api/me` strips `passwordHash` before returning user session payload"*).

#### Observation 1.4.4: `passwordHash` Leaked in `PUT /api/profile/[id]`
- **File & Lines**: `src/app/api/profile/[id]/route.ts:112-117`
- **Direct Quote**:
  ```typescript
  const updated = await db.update(users)
      .set(updateData)
      .where(eq(users.id, params.id))
      .returning();

  return NextResponse.json(updated[0]);
  ```
- **Finding**: Drizzle ORM `.returning()` returns all columns of the `users` row, including `passwordHash`. Updating profile bio or name exposes the user's password hash in the response.

#### Observation 1.4.5: Private Email & Private Boards Count Disclosure in `GET /api/profile/[id]`
- **File & Lines**: `src/app/api/profile/[id]/route.ts:23-53`
- **Direct Quote**:
  ```typescript
  // Get user's boards count
  const userBoards = await db.select()
      .from(boards)
      .where(eq(boards.userId, params.id));
  ...
  return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      boardsCount: userBoards.length,
      reputation: reputation.length > 0 ? reputation[0].points : 0,
  });
  ```
- **Finding**:
  - `email: user.email` is returned to ANY requester (even unauthenticated).
  - `boardsCount` queries ALL boards (`where eq(boards.userId, params.id)`), exposing the exact count of private cases.

#### Observation 1.4.6: Bulk Email Harvesting via `GET /api/search`
- **File & Lines**: `src/lib/search.ts:66-75`
- **Direct Quote**:
  ```typescript
  // Search users (names and emails - limited for privacy)
  const userResults = await db
      .select({
          id: users.id,
          name: users.name,
          email: users.email,
          avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(or(like(users.name, searchTerm), like(users.email, searchTerm)))
      .limit(10);
  ```
- **Finding**: Any caller (even unauthenticated, as `GET /api/search` does not require auth) can search with single characters (e.g., `%`, `a`, `@`) and harvest user names and full email addresses across the entire user base.

#### Observation 1.4.7: State Modification via Unauthenticated `GET /api/auth/verify-email`
- **File & Lines**: `src/app/api/auth/verify-email/route.ts:4-29`
- **Finding**:
  - Uses HTTP `GET` to mutate database state (`emailVerifiedFlag = 1` and deletes token).
  - Has ZERO rate limiting.
  - Vulnerable to email security scanner pre-fetching (consuming tokens before the user clicks) and automated brute-force attacks against token identifiers.

---

### 1.5 Server-Side Request Forgery (SSRF) in `GET /api/preview` (Task 5)

#### Observation 1.5.1: Flawed Protocol Check & Missing URL Parsing
- **File & Lines**: `src/app/api/preview/route.ts:3-23`
- **Direct Quote**:
  ```typescript
  export async function GET(req: NextRequest) {
      const { searchParams } = new URL(req.url);
      const url = searchParams.get('url');

      if (!url) {
          return NextResponse.json({ error: 'URL is required' }, { status: 400 });
      }

      try {
          // Simple SSRF protection: only allow http/https
          if (!url.startsWith('http')) {
              return NextResponse.json({ error: 'Invalid URL protocol' }, { status: 400 });
          }

          const response = await fetch(url, {
              next: { revalidate: 3600 }, // Cache for 1 hour
              headers: {
                  'User-Agent': 'TheCaseFile-Bot/1.0',
              },
          });
  ```
- **Forensic Breakdown of Gaps**:
  1. **Weak Protocol Check**: `!url.startsWith('http')` permits non-standard protocols like `httpanything://`, `http://`, `https://`.
  2. **No URL Object Parsing**: Does not construct `new URL(url)` to validate URL structure or extract components (`hostname`, `port`, `protocol`).
  3. **No Localhost / Loopback Blocking**: Requests to `http://127.0.0.1`, `http://localhost`, `http://0.0.0.0`, `http://[::1]` pass unchecked.
  4. **No Cloud Metadata Blocking**: Requests to `http://169.254.169.254` (AWS/GCP/Azure IMDSv1 instance metadata) pass unchecked, allowing cloud credential extraction.
  5. **No RFC1918 Private Network Blocking**: Requests to internal subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) pass unchecked.
  6. **No DNS Resolution / Rebinding Protection**: Hostnames resolving to private IPs (e.g., `127.0.0.1.nip.io` or DNS rebinding domains) are fetched without IP inspection.
  7. **Unrestricted HTTP Redirects**: Default `fetch` follows redirects (`redirect: 'follow'`), allowing a public URL to redirect internally to `http://169.254.169.254`.
  8. **Zero Rate Limiting**: The endpoint has no rate limiting or authentication, functioning as an open proxy / DoS amplifier.

---

### 1.6 Rate Limiting Architecture & Unprotected Endpoints (Task 6)

#### Observation 1.6.1: Non-Atomic Rate Limiting Implementation
- **File & Lines**: `src/lib/rate-limit.ts:12-57`
- **Direct Quote**:
  ```typescript
  export async function checkRateLimit(key: string, maxRequests: number = 5, windowMs: number = 60000) {
      const now = Date.now();

      // 1. Probabilistic cleanup (1% of requests) to prevent table bloat
      if (Math.random() < 0.01) {
          await db.delete(rateLimits).where(lt(rateLimits.expiresAt, new Date(now)));
      }

      // 2. Get current limit
      const record = await db.select().from(rateLimits).where(eq(rateLimits.key, key)).limit(1);

      if (record.length === 0) {
          // Create new record
          const expiresAt = new Date(now + windowMs);
          await db.insert(rateLimits).values({
              key,
              count: 1,
              expiresAt,
          });
          return { success: true, reset: expiresAt.getTime() };
      }

      const expiresAt = record[0].expiresAt;
      const count = record[0].count || 0;

      if (now > expiresAt.getTime()) {
          // Window expired, reset count
          const newExpiresAt = new Date(now + windowMs);
          await db.update(rateLimits)
              .set({ count: 1, expiresAt: newExpiresAt })
              .where(eq(rateLimits.key, key));
          return { success: true, reset: newExpiresAt.getTime() };
      }

      if (count >= maxRequests) {
          // Rate limit exceeded
          return { success: false, reset: expiresAt.getTime() };
      }

      // Increment count
      await db.update(rateLimits)
          .set({ count: count + 1 })
          .where(eq(rateLimits.key, key));

      return { success: true, reset: expiresAt.getTime() };
  }
  ```
- **Flaws Identified**:
  - **Check-Then-Act Race Condition (TOCTOU)**: Executes separate `SELECT`, conditional branching in Node.js runtime, and then `INSERT` or `UPDATE`. Concurrent requests interleaved between the `SELECT` and `UPDATE` all read the same `count`, allowing bursts of concurrent traffic to completely bypass the limit.
  - **Insert Collisions**: If two requests arrive simultaneously when no record exists, both execute `INSERT INTO rate_limits (key, ...)`, throwing an unhandled database unique constraint violation error on `rate_limits.key`.
  - **Remote Turso Latency Amplification**: Because Turso runs remotely over HTTP/WebSocket, the round-trip latency window (50ms–200ms) dramatically increases the race condition window.
  - **Schema Data Type Mismatch in `account-security.ts:67`**:
    ```typescript
    expiresAt: sql`CASE WHEN ${rateLimits.expiresAt} < ${new Date(now).toISOString()} THEN ${expiresAt.toISOString()} ELSE ${rateLimits.expiresAt} END`
    ```
    The column `rate_limits.expires_at` is defined as `integer({ mode: 'timestamp_ms' })`, but `account-security.ts` attempts to compare and set ISO 8601 strings into an integer column.

#### Observation 1.6.2: Spoofable IP Extraction
- In `auth/[...nextauth]/route.ts:11`, `auth/forgot-password/route.ts:9`, `auth/reset-password/route.ts:22`, `auth/signup/route.ts:14`:
  ```typescript
  const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
  ```
  - An attacker sending a spoofed or randomized header (`x-forwarded-for: 10.0.0.X`) can generate an arbitrary unique key for every request, completely evading the rate limit.
  - Does not sanitize multi-hop proxy headers (e.g. `client, proxy1, proxy2`).

#### Observation 1.6.3: Catalog of Protected vs Unprotected Endpoints
- **Endpoints With Rate Limiting**:
  1. `POST /api/auth/[...nextauth]` (IP: 10 req/min)
  2. `POST /api/auth/signup` (IP: 5 req/hour)
  3. `POST /api/auth/forgot-password` (IP: 3 req/hour)
  4. `POST /api/auth/reset-password` (IP: 5 req/hour)
  5. `POST /api/comments` (User: 30 req/min)
  6. `POST /api/contributions` (User: 10 req/hour)
  7. `PUT /api/profile/[id]` (User: 10 req/min)
  8. `POST /api/upload` (User: 20 req/hour)
- **Endpoints Lacking Rate Limiting (12 Vulnerable Endpoints)**:
  1. `GET /api/auth/verify-email` (CRITICAL: token brute force vulnerability)
  2. `GET /api/preview` (CRITICAL: SSRF and outbound DoS proxy amplification)
  3. `POST /api/boards` (Board creation spam)
  4. `GET /api/boards` & `GET /api/boards/[id]` (Resource exhaustion)
  5. `PUT /api/boards/[id]` (Board save hammering)
  6. `GET /api/boards/[id]/collaborators` & `POST /api/boards/[id]/collaborators` (Spam invites)
  7. `GET /api/boards/[id]/versions` & `POST /api/boards/[id]/versions` (Version flood)
  8. `GET /api/comments` (Comment scraping)
  9. `PUT /api/comments/[id]` & `DELETE /api/comments/[id]` (Comment mutation spam)
  10. `GET /api/contributions` & `POST /api/contributions/[id]/merge` & `POST /api/contributions/[id]/reject` (Contribution DoS)
  11. `GET /api/search` (Expensive wildcard SQL query DoS)
  12. `GET /api/leaderboard` (Expensive aggregation query DoS)

---

### 1.7 Authorization & Insecure Direct Object Reference (IDOR) Flaws (Task 7)

#### Observation 1.7.1: IDOR in `GET /api/comments` (Private Board Comments Leaked)
- **File & Lines**: `src/app/api/comments/route.ts:18-49`
- **Direct Quote**:
  ```typescript
  export async function GET(req: NextRequest) {
      try {
          const session = await auth();
          if (!session?.user?.id) {
              return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
          }

          const { searchParams } = new URL(req.url);
          const boardId = searchParams.get('boardId');
          const nodeId = searchParams.get('nodeId');

          if (!boardId) {
              return NextResponse.json({ error: 'Board ID required' }, { status: 400 });
          }

          // Build query based on filters
          const conditions = [eq(comments.boardId, boardId)];
  ```
- **Finding**: While it checks that a user is logged in, it NEVER checks whether `session.user.id` has access to `boardId` (whether the board is public, or user is owner/collaborator). ANY authenticated user can read all private investigation notes and comments on ANY private board by querying `GET /api/comments?boardId=<victim_board_id>`.

#### Observation 1.7.2: IDOR in `POST /api/comments` (Unauthorized Comment Injection)
- **File & Lines**: `src/app/api/comments/route.ts:53-101`
- **Finding**: Any authenticated user can submit a comment to ANY `boardId`. The route does not check if the board exists, if it is private, or if the user is a collaborator or owner.

#### Observation 1.7.3: IDOR in `GET /api/contributions` (Private Board Snapshot Leaked)
- **File & Lines**: `src/app/api/contributions/route.ts:109-113`
- **Direct Quote**:
  ```typescript
  } else if (targetBoardId) {
      // Fetch contributions TO this board (existing behavior)
      const results = await db.select().from(contributions).where(eq(contributions.boardId, targetBoardId));
      return NextResponse.json(results);
  }
  ```
- **Finding**: When queried with `?boardId=<targetBoardId>` (default `type=received`), the handler returns all contributions and full canvas node/edge snapshots without verifying if `session.user.id` is the owner or collaborator of that target board.

#### Observation 1.7.4: IDOR in `GET /api/boards/[id]/collaborators` (Private Collaborator Intel & Emails Leaked)
- **File & Lines**: `src/app/api/boards/[id]/collaborators/route.ts:15-42`
- **Direct Quote**:
  ```typescript
  const collaborators = await db.select({
      id: boardCollaborators.id,
      userId: boardCollaborators.userId,
      role: boardCollaborators.role,
      addedAt: boardCollaborators.addedAt,
      userName: users.name,
      userEmail: users.email,
  })
      .from(boardCollaborators)
      .leftJoin(users, eq(boardCollaborators.userId, users.id))
      .where(eq(boardCollaborators.boardId, params.id));
  ```
- **Finding**: Any logged-in user can supply any `params.id` and retrieve the full collaborator roster, user IDs, names, and private email addresses of all collaborators on any private board.

#### Observation 1.7.5: Unauthorized Visibility Modification in `PUT /api/boards/[id]`
- **File & Lines**: `src/app/api/boards/[id]/route.ts:32-46`
- **Direct Quote**:
  ```typescript
  const isOwner = board.userId === session.user.id;
  const collaborator = board.collaborators.find(c => c.userId === session.user.id);
  const isEditor = collaborator && (collaborator.role === 'editor' || collaborator.role === 'owner');

  if (!isOwner && !isEditor) {
      return NextResponse.json({ error: 'Forbidden: You do not have permission to edit this board' }, { status: 403 });
  }
  ...
  if (isPublic !== undefined) updateData.isPublic = isPublic;
  ```
- **Finding**: An invited collaborator with `editor` permissions can toggle `isPublic = true`, exposing a private investigation to the public discover feed without owner consent. Changing board visibility must be restricted to the board owner.

#### Observation 1.7.6: Missing HTTP Methods Across Core Resources
- **Missing Collaborator Removal/Update API**: `src/app/api/boards/[id]/collaborators/route.ts` only implements `GET` and `POST`. There is no `DELETE` (to remove a collaborator) or `PATCH` (to change a collaborator's role), violating Requirement R4 (*"Fix collaborator management (user lookup, addition, role management, deletion API)"*).
- **Missing Board Deletion API**: `src/app/api/boards/[id]/route.ts` only implements `GET` and `PUT`. There is no `DELETE` endpoint to delete or soft-delete a board.

---

### 1.8 Unvalidated File Uploads & Potential Stored XSS (Task 8)

#### Observation 1.8.1: File Extension Spoofing in `POST /api/upload`
- **File & Lines**: `src/app/api/upload/route.ts:37-77`
- **Direct Quote**:
  ```typescript
  // Validate file type
  if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
          { error: 'Invalid file type. Only images are allowed.' },
          { status: 400 }
      );
  }
  ...
  // Generate unique filename
  const extension = file.name.split('.').pop();
  const filename = `${createId()}.${extension}`;
  const filepath = join(UPLOAD_DIR, filename);
  ```
- **Finding**:
  - `file.type` is read directly from the client request header `Content-Type` with zero MIME magic-number inspection.
  - The extension is taken directly from the client-supplied filename (`file.name.split('.').pop()`).
  - An attacker can upload an HTML or SVG file with `Content-Type: image/png` and filename `exploit.html`. The server writes `/public/uploads/<id>.html`. Because Next.js serves `/public` files statically, visiting `/uploads/<id>.html` executes arbitrary script in the victim's browser on the application's domain (Stored XSS).

---

## 2. Logic Chain

1. **Test Auth Bypass Chain**:
   - Observations 1.2.1, 1.2.2, and 1.2.3 establish that `headers.get('x-test-bypass') === 'true'` is checked in `auth.ts`, `auth.config.ts`, and `board/[id]/page.tsx`.
   - When present, it fabricates a fake session for `test-user-123` and returns dummy data.
   - Therefore, any unauthenticated attacker sending this header can impersonate `test-user-123`, view protected pages, and create boards under that identity.
   - Elimination requires removing the header checks from production code and migrating E2E tests to authenticate via standard credentials or injected session cookies.

2. **Credential Exposure & Account Takeover Chain**:
   - Observation 1.4.1 reveals `POST /api/auth/signup` returns `verificationToken`.
   - Observation 1.4.2 reveals `POST /api/auth/forgot-password` returns `resetToken`.
   - Any external user can initiate a reset for any victim's email, inspect the response body for `resetToken`, and pass it to `POST /api/auth/reset-password` to overwrite the victim's password.
   - Observation 1.4.3 and 1.4.4 show `GET /api/me` and `PUT /api/profile/[id]` returning the raw `users` row, which includes `passwordHash`.
   - Therefore, sensitive tokens and password hashes must be sanitized/excluded from all JSON serialization.

3. **SSRF Exploitation Chain**:
   - Observation 1.5.1 shows `GET /api/preview` performs `fetch(url)` if `url.startsWith('http')`.
   - Because `http://169.254.169.254/latest/meta-data/` starts with `http`, it is fetched by the server.
   - Because `fetch` follows redirects by default, any domain redirecting to internal IP addresses or private RFC1918 subnets will also succeed.
   - Therefore, `GET /api/preview` allows attackers to probe the internal network and steal cloud environment metadata.

4. **Rate Limiting Concurrency Failure Chain**:
   - Observation 1.6.1 demonstrates that `checkRateLimit` executes a non-atomic `SELECT` followed by application-level evaluation and an `UPDATE`.
   - Under concurrent load, multiple threads observe `count < maxRequests` before any write occurs.
   - Because `rate_limits.key` is a primary key, parallel initial requests crash with duplicate key errors instead of cleanly incrementing.
   - Therefore, the rate limiter must be converted to an atomic database UPSERT (`INSERT INTO ... ON CONFLICT(key) DO UPDATE SET count = ... RETURNING ...`).

5. **Authorization / IDOR Chain**:
   - Observations 1.7.1, 1.7.2, 1.7.3, and 1.7.4 reveal that `comments`, `contributions`, and `collaborators` queries filter only by the supplied `boardId` without verifying the caller's relationship to that board.
   - Any logged-in user can supply any UUID for a private board and read/post comments, view full contribution snapshots, and view private collaborator emails.
   - Therefore, an explicit board access helper (checking `isPublic`, `userId === session.user.id`, or active collaborator role) must guard every board-scoped route.

---

## 3. Caveats

1. **Automated Test Impacts**:
   - Removing `x-test-bypass` from `src/auth.ts`, `src/auth.config.ts`, and `src/app/(authenticated)/board/[id]/page.tsx` will cause Playwright tests configured with `extraHTTPHeaders: { 'x-test-bypass': 'true' }` to fail unless those tests are updated to log in properly via UI or NextAuth test session cookies.
2. **Signup Verification Flow UX**:
   - Removing `verificationToken` from `POST /api/auth/signup` requires updating `src/app/signup/page.tsx:81` so it redirects to `/signup/verify?email=${encodeURIComponent(email)}` without appending `&token=...`.
3. **Turso / SQLite Specifics**:
   - Atomic rate-limiting UPSERT requires SQLite 3.35+ `ON CONFLICT (...) DO UPDATE ... RETURNING ...`, which is fully supported by Turso and modern `@libsql/client`.
4. **No other caveats**: The investigation covered 100% of API routes and authenticated page layouts.

---

## 4. Conclusion

The application exhibits multiple critical security defects across authentication, authorization, rate-limiting, and external fetching:
- **Authentication**: Compromised by global `x-test-bypass` header backdoors in both middleware and NextAuth wrappers.
- **Credential Safety**: Complete account takeover is trivially possible via `resetToken` disclosure in `POST /api/auth/forgot-password`; password hashes are leaked in `GET /api/me` and `PUT /api/profile/[id]`.
- **Network Boundaries**: `GET /api/preview` provides an unauthenticated, un-rate-limited SSRF vector against localhost, RFC1918 subnets, and `169.254.169.254`.
- **Rate-Limiting**: Non-atomic check-then-act implementation in SQLite creates race condition vulnerabilities; 12 sensitive endpoints lack rate-limiting entirely.
- **Authorization**: Critical IDOR vulnerabilities allow any authenticated user to read and mutate comments, read full contribution board snapshots, and harvest private collaborator emails on any private board.
- **Route Protection**: `/board/*`, `/profile/*`, and `/leaderboard` are omitted from protected path middleware checks.

---

## 5. Remediation Plan

### Remediation Item 1: Complete Elimination of Test Auth Bypasses
1. **Target**: `src/auth.ts`
   - Remove lines 114–132 where `headers()` inspects `x-test-bypass`. Export `auth` directly from `NextAuth`:
     ```typescript
     export const { handlers, auth, signIn, signOut } = NextAuth({ ... });
     ```
2. **Target**: `src/auth.config.ts`
   - Remove lines 11–13 checking `headers.get('x-test-bypass') === 'true'`.
3. **Target**: `src/app/(authenticated)/board/[id]/page.tsx`
   - Remove lines 22–23 and 37–47 checking `isTestBypass` and synthesizing a mock board. If `!board`, immediately invoke `notFound()`.
4. **Target**: `playwright.config.ts` & `tests/e2e/smoke.spec.ts`
   - Remove `'x-test-bypass': 'true'` from headers.

### Remediation Item 2: Route Protection & Middleware Hardening
1. **Target**: `src/auth.config.ts`
   - Expand `protectedPaths` to include all required authenticated paths:
     ```typescript
     const protectedPaths = ['/cases', '/discover', '/board', '/profile', '/leaderboard', '/settings', '/starred'];
     ```
   - Redirect authenticated users visiting `/login` or `/signup` to `/cases`.
2. **Target**: `src/middleware.ts`
   - Ensure the matcher properly guards all protected web application paths.

### Remediation Item 3: Fix Token Leakage & Credential Exposure
1. **Target**: `src/app/api/auth/signup/route.ts`
   - Remove `verificationToken` from the JSON response on line 78. Return only `{ success: true, userId, message: 'Account created successfully' }`.
   - Update `src/app/signup/page.tsx:81` to redirect to `/signup/verify?email=${encodeURIComponent(formData.email)}` without `token`.
2. **Target**: `src/app/api/auth/forgot-password/route.ts`
   - Remove `resetToken: token` from line 45. Return only `{ success: true, message: 'If an account exists with this email, a password reset link has been sent' }`.
3. **Target**: `src/app/api/me/route.ts`
   - Explicitly select or destructure to exclude `passwordHash`:
     ```typescript
     const { passwordHash, ...safeUser } = user;
     return NextResponse.json({
         ...safeUser,
         reputationPoints: rep?.points || 0,
         boardsCreated: rep?.boardsCreated || 0,
         contributionsAccepted: rep?.contributionsAccepted || 0,
     });
     ```
4. **Target**: `src/app/api/profile/[id]/route.ts`
   - In `PUT`, exclude `passwordHash` when returning the updated record (`.returning({ id: users.id, name: users.name, bio: users.bio, avatarUrl: users.avatarUrl })`).
   - In `GET`, only return email if `session?.user?.id === params.id` or omit email from public profile cards. Filter `boardsCount` to count only `isPublic = true` boards unless caller is the profile owner.
5. **Target**: `src/lib/search.ts`
   - Do not return `email` in user search results (`SearchModal`). Return only `id`, `name`, and `avatarUrl`.
6. **Target**: `src/app/api/auth/verify-email/route.ts`
   - Add atomic rate-limiting (e.g., 10 attempts per hour per IP).
   - Require `POST` method instead of `GET` for state mutation, or ensure strict token validation.

### Remediation Item 4: Secure `GET /api/preview` Against SSRF
1. **Target**: `src/app/api/preview/route.ts`
   - Parse URL with `new URL(url)`. Reject invalid formats (return 400).
   - Validate protocol strictly: `parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:'`.
   - Resolve DNS hostname using `dns.promises.lookup(hostname, { all: true })`.
   - Check all resolved IPv4 and IPv6 addresses against private and reserved CIDR ranges:
     - `127.0.0.0/8` (Loopback)
     - `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` (RFC1918)
     - `169.254.0.0/16` (Link-Local & Cloud Metadata `169.254.169.254`)
     - `0.0.0.0/8`, `100.64.0.0/10`, `192.0.0.0/24`, `198.51.100.0/24`, `203.0.113.0/24`, `224.0.0.0/4`, `240.0.0.0/4`
     - IPv6: `::1`, `fc00::/7`, `fe80::/10`, `::ffff:0:0/96`
   - If hostname is `localhost` or any resolved IP matches a private/reserved range, return `NextResponse.json({ error: 'Access to private network address is forbidden' }, { status: 400 })`.
   - Fetch using `redirect: 'manual'` (or re-validate redirect target URLs before following).
   - Enforce a 5-second timeout via `AbortSignal.timeout(5000)`.
   - Add rate-limiting: `checkRateLimit('preview:${ip}', 20, 60000)`.

### Remediation Item 5: Atomic Rate-Limiting Implementation
1. **Target**: `src/lib/rate-limit.ts`
   - Rewrite `checkRateLimit` to use an atomic SQL UPSERT with RETURNING clause:
     ```typescript
     export async function checkRateLimit(key: string, maxRequests: number = 5, windowMs: number = 60000) {
         const now = Date.now();
         const newExpiresAt = new Date(now + windowMs);

         // Atomic UPSERT
         const result = await db.insert(rateLimits).values({
             key,
             count: 1,
             expiresAt: newExpiresAt,
         }).onConflictDoUpdate({
             target: rateLimits.key,
             set: {
                 count: sql`CASE WHEN ${rateLimits.expiresAt} < ${now} THEN 1 ELSE ${rateLimits.count} + 1 END`,
                 expiresAt: sql`CASE WHEN ${rateLimits.expiresAt} < ${now} THEN ${newExpiresAt.getTime()} ELSE ${rateLimits.expiresAt} END`,
             },
         }).returning({
             count: rateLimits.count,
             expiresAt: rateLimits.expiresAt,
         });

         const current = result[0];
         const isAllowed = (current?.count || 1) <= maxRequests;
         const resetTime = current?.expiresAt instanceof Date 
             ? current.expiresAt.getTime() 
             : Number(current?.expiresAt || now + windowMs);

         return {
             success: isAllowed,
             reset: resetTime,
         };
     }
     ```
2. **Target**: `src/lib/account-security.ts:67`
   - Replace `.toISOString()` in the SQL statement with Unix millisecond integer timestamp (`now`).
3. **Target**: Add rate-limiting to all 12 unprotected endpoints identified in Observation 1.6.3.

### Remediation Item 6: Fix Authorization & IDORs
1. **Create Board Permission Helper**:
   - Create `src/lib/auth-checks.ts` with `async function getBoardAccess(boardId: string, userId?: string)` returning `{ board, canView: boolean, canEdit: boolean, isOwner: boolean }`.
2. **Target**: `src/app/api/comments/route.ts`
   - In `GET`: verify `canView` on `boardId`. Return 404/403 if user cannot view.
   - In `POST`: verify `canView` (or `canEdit` depending on board collaboration rules).
3. **Target**: `src/app/api/contributions/route.ts`
   - In `GET`: verify user owns `targetBoardId` or is a collaborator before returning received contributions.
   - In `POST`: verify target board exists and is public or accessible.
4. **Target**: `src/app/api/boards/[id]/collaborators/route.ts`
   - In `GET`: verify caller is board owner or active collaborator before returning collaborator list.
   - Add `DELETE /api/boards/[id]/collaborators` (accepting `collaboratorId` or `userId`) restricted to board owner.
   - Add `PATCH /api/boards/[id]/collaborators` to update role (`editor` | `viewer`) restricted to board owner.
5. **Target**: `src/app/api/boards/[id]/route.ts`
   - In `PUT`: only allow updating `isPublic` if `session.user.id === board.userId` (owner only).
   - Implement `DELETE /api/boards/[id]` restricted to board owner (supporting soft delete via `deletedAt = new Date()`).

### Remediation Item 7: Hardening File Uploads
1. **Target**: `src/app/api/upload/route.ts`
   - Whitelist allowed extensions strictly: `{ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp' }`.
   - Never use `file.name.split('.').pop()` to determine extension.
   - Verify magic bytes of the buffer (JPEG: `FF D8 FF`, PNG: `89 50 4E 47`, GIF: `47 49 46 38`, WEBP: `52 49 46 46`).

---

## 6. Verification Method

### 6.1 Automated Test Execution
Run the following verification suites:
```bash
# Run unit & integration tests
npm run test

# Run linting
npm run lint

# Run production build check
npm run build
```

### 6.2 Specific Invalidation & Verification Probes

1. **Test Auth Bypass Elimination**:
   ```bash
   # Should return 401 Unauthorized (or redirect to /login), NOT 200 with test-user-123 session
   curl -s -o /dev/null -w "%{http_code}\n" -H "x-test-bypass: true" http://localhost:3000/api/boards
   ```
   *Invalidation Condition*: Any route returns HTTP 200 or authenticates as `test-user-123` when `x-test-bypass: true` is passed.

2. **Token Leakage Elimination**:
   ```bash
   # Signup probe
   curl -s -X POST http://localhost:3000/api/auth/signup \
     -H "Content-Type: application/json" \
     -d '{"name":"Audit User","email":"audit@example.com","password":"StrongPassword123!"}' \
     | grep -i "verificationToken"
   
   # Forgot password probe
   curl -s -X POST http://localhost:3000/api/auth/forgot-password \
     -H "Content-Type: application/json" \
     -d '{"email":"audit@example.com"}' \
     | grep -i "resetToken"
   ```
   *Invalidation Condition*: Grep matches any token string in output.

3. **SSRF Blocking Verification**:
   ```bash
   # Loopback probe
   curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/api/preview?url=http://127.0.0.1"
   # Metadata probe
   curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/api/preview?url=http://169.254.169.254"
   # Private RFC1918 probe
   curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/api/preview?url=http://192.168.1.1"
   ```
   *Success Condition*: All return HTTP 400 Bad Request.  
   *Invalidation Condition*: Any return 200 or attempt an outbound request.

4. **Credential Stripping in `/api/me`**:
   ```bash
   # Inspect session user object
   curl -s -H "Cookie: <session_cookie>" http://localhost:3000/api/me | grep -i "passwordHash"
   ```
   *Success Condition*: Zero matches.  
   *Invalidation Condition*: `passwordHash` field present in JSON output.

5. **Protected Routes Middleware Enforcement**:
   ```bash
   for path in "/cases" "/discover" "/board/123" "/profile/123" "/leaderboard" "/settings"; do
     code=$(curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000$path")
     echo "$path: $code" # Expect 307 redirect to /login
   done
   ```
   *Success Condition*: All return 307 redirect to `/login`.

---

Report compiled and verified by Explorer 2.
Available at: `/Users/hardikrawat/Documents/the-case-file/.agents/teamwork_preview_explorer_survey_2/handoff.md`
