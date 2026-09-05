# Challenger 2 Handoff Report: Milestone 2 Empirical Security Stress Testing

## 1. Observation

Empirical testing was conducted against the live remote Turso DB (`libsql://the-case-file-hardikrawat.aws-ap-south-1.turso.io`) and application route handlers using the custom verification harness:
`scripts/test-challenger-m2-ratelimit-idor.ts`.

### 1.1 Atomic Rate Limiting Stress Test (`src/lib/rate-limit.ts`)
- **Test Command**: `npx tsx scripts/test-challenger-m2-ratelimit-idor.ts`
- **Implementation Inspected** (`src/lib/rate-limit.ts:26-40`):
  ```typescript
  const result = await db.insert(rateLimits).values({
      key,
      count: 1,
      expiresAt,
  }).onConflictDoUpdate({
      target: rateLimits.key,
      set: {
          count: sql`CASE WHEN ${rateLimits.expiresAt} < ${now} THEN 1 ELSE ${rateLimits.count} + 1 END`,
          expiresAt: sql`CASE WHEN ${rateLimits.expiresAt} < ${now} THEN ${expiresAt.getTime()} ELSE ${rateLimits.expiresAt} END`,
      }
  }).returning({
      count: rateLimits.count,
      expiresAt: rateLimits.expiresAt,
  });
  ```
- **Live Empirical Results**:
  1. **Concurrent Burst (25 parallel requests with cap of 5)**:
     - Exactly 5 succeeded (`{ success: true }`)
     - Exactly 20 blocked (`{ success: false }`)
     - Remote Turso DB counter verified: `count = 25` (zero TOCTOU race bypasses)
  2. **Secondary Burst on Exhausted Key (10 follow-up requests)**:
     - 0 succeeded (`{ success: true }`)
     - 10 blocked (`{ success: false }`)
     - Remote Turso DB counter verified: `count = 35`
  3. **Atomic Expiration Window Reset (800ms window, 1100ms sleep)**:
     - Initial cap enforced: calls 1 and 2 returned `true`, call 3 returned `false`.
     - After 1100ms sleep, call 4 returned `true`.
     - Remote Turso DB counter verified: `count` reset atomically to `1`.
  4. **High Concurrency Burst (50 parallel requests with cap of 10)**:
     - Zero database locking errors (`errors = 0`).
     - Exactly 10 succeeded, 40 blocked.
     - Final DB count = 50.

### 1.2 IDOR & Authorization Access Matrix Attack (`src/lib/auth-checks.ts` & Route Handlers)
- **Implementation Inspected** (`src/lib/auth-checks.ts:17-53`):
  - Enforces `and(eq(boards.id, boardId), isNull(boards.deletedAt))` query filter.
  - Checks role hierarchy: owner, editor, viewer, public.
- **Live Empirical Results**:
  1. **`getBoardAccess` Helper Direct Matrix**:
     - Non-collaborator on private board: `canView: false, canEdit: false, isOwner: false`.
     - Soft-deleted board (`deletedAt IS NOT NULL`): returns `board: null`, `canView: false`, `canEdit: false`, `isOwner: false` across owner, viewer, and unauthenticated callers.
     - Viewer collaborator: `canView: true, canEdit: false, isOwner: false`.
     - Editor collaborator: `canView: true, canEdit: true, isOwner: false`.
     - Board owner: `canView: true, canEdit: true, isOwner: true`.
     - Public board: `canView: true, canEdit: false, isOwner: false` for strangers and unauthenticated callers.
  2. **Route Handler Integration Attacks**:
     - `GET /api/boards/[id]`:
       - Stranger on private board -> HTTP 403 Forbidden.
       - Unauthenticated caller on private board -> HTTP 401 Unauthorized.
       - Owner on soft-deleted board -> HTTP 404 Not Found.
       - Viewer on private board -> HTTP 200 OK.
     - `PUT /api/boards/[id]`:
       - Viewer attempting edit -> HTTP 403 Forbidden (`"Forbidden: You do not have permission to edit this board"`).
       - Editor attempting `isPublic` change -> HTTP 403 Forbidden (`"Forbidden: Only board owner can change visibility"`).
       - Editor editing permitted board content -> HTTP 200 OK.
       - Owner attempting edit on soft-deleted board -> HTTP 404 Not Found.
     - `DELETE /api/boards/[id]`:
       - Viewer attempting delete -> HTTP 403 Forbidden (`"Forbidden: Only the board owner can delete this board"`).
       - Editor attempting delete -> HTTP 403 Forbidden.
       - Stranger attempting delete -> HTTP 403 Forbidden.
       - Owner attempting delete on already soft-deleted board -> HTTP 404 Not Found.
       - Owner deleting active board -> HTTP 200 OK, updates `deletedAt` in Turso DB (`deletedAt IS NOT NULL`).
     - `GET & POST /api/boards/[id]/collaborators`:
       - Stranger GET collaborators of private board -> HTTP 403 Forbidden.
       - Editor POST new collaborator -> HTTP 403 Forbidden (`"Forbidden: Only board owner can add collaborators"`).
       - Owner POST new collaborator -> HTTP 201 Created.
     - `GET & POST /api/comments`:
       - Stranger GET comments on private board -> HTTP 403 Forbidden.
       - Stranger POST comment on private board -> HTTP 403 Forbidden.
       - Viewer POST comment on private board -> HTTP 201 Created.
       - Owner POST comment on soft-deleted board -> HTTP 404 Not Found.

### 1.3 File Upload Security Attack (`src/app/api/upload/route.ts`)
- **Implementation Inspected** (`src/app/api/upload/route.ts:18-67, 103-125`):
  - Magic byte detection: JPEG (`FF D8 FF`), PNG (`89 50 4E 47 0D 0A 1A 0A`), GIF (`GIF87a` / `GIF89a`), WebP (`RIFF....WEBP`).
  - Strict extension mapping (`MIME_TO_EXT`), client filename ignored, unique `cuid2` assigned.
  - 5MB limit check (`file.size > MAX_FILE_SIZE`).
  - Auth session requirement.
- **Live Empirical Results**:
  1. **PHP executable disguised as PNG (`test.php.png`)**: Rejected with HTTP 400 (`"Invalid file content. Only real JPEG, PNG, GIF, and WebP images are allowed."`).
  2. **HTML / JavaScript Stored XSS payload**: Rejected with HTTP 400 (`"Invalid file content"`).
  3. **Bash shell script disguised as JPEG (`avatar.jpg`)**: Rejected with HTTP 400.
  4. **Corrupted / non-image magic bytes**:
     - Truncated buffer (<12 bytes) -> HTTP 400.
     - PDF masquerading as JPEG -> HTTP 400.
     - Linux ELF binary masquerading as PNG -> HTTP 400.
  5. **Oversized payload (>5MB, 5MB + 2048 bytes)**: Rejected with HTTP 400 (`"File too large. Maximum size is 5MB."`).
  6. **Path Traversal & Double Extension Neutralization**: Malicious filename `../../../../var/www/shell.php.jpg` containing valid PNG bytes was safely saved as `<cuid>.png` with no directory traversal, no PHP extension, and `type: "image/png"`.
  7. **MIME Mapping**: Spoofed extensions (`.pdf`, `.svg`, `.bmp`) with genuine image magic bytes were strictly renamed to canonical extensions (`.jpg`, `.gif`, `.webp`).
  8. **Unauthenticated Upload**: Rejected with HTTP 401 Unauthorized.

### 1.4 Baseline Test Suite & Build Verification
- `npm run test:unit`: 20 test files passed (148 tests passed, 0 failed).
- `npm run lint`: "✔ No ESLint warnings or errors".
- `npm run build`: Exit code 0, 26/26 static and dynamic routes compiled and optimized.

---

## 2. Logic Chain

1. **Atomic Rate Limiting Concurrency Guarantee**:
   Under a naive `SELECT count FROM rate_limits` followed by an `UPDATE/INSERT`, concurrent requests read the same initial count before writing, leading to race conditions where far more requests succeed than allowed. The SQLite UPSERT (`INSERT ... ON CONFLICT(key) DO UPDATE SET count = ... RETURNING count`) executes within a single atomic database engine transaction. In our empirical test with 25 concurrent requests and a cap of 5, exactly 5 succeeded and the final count in Turso DB was 25. High concurrency stress (50 parallel requests) showed 0 lock timeouts and exact count tracking. Furthermore, the conditional `CASE WHEN expires_at < now THEN 1` guarantees that expired windows reset counter state without requiring background cron jobs.

2. **Defense-in-Depth Authorization & IDOR Elimination**:
   `getBoardAccess` acts as the single source of truth for board authorization. Because it applies `isNull(boards.deletedAt)` at the query level, any soft-deleted board is treated identically to a non-existent board (`{ board: null, canView: false, canEdit: false, isOwner: false }`). When tested against the API endpoints (`GET /api/boards/[id]`, `PUT`, `DELETE`, `collaborators`, and `comments`), soft-deleted boards returned 404 Not Found even to the board owner, preventing state mutation or data leakage of deleted cases.

3. **Role Segregation Enforcement**:
   The permission matrix strictly enforces owner-only privileges. Viewers attempting edits or deletes receive HTTP 403. Editors attempting to modify visibility (`isPublic`) or invite collaborators receive HTTP 403. Strangers attempting to read comments or view private boards receive HTTP 403. All attempts were confirmed empirically against route handlers.

4. **File Upload Hardening & Stored XSS Neutralization**:
   Relying on client-supplied `Content-Type` headers or file extensions is a critical security vulnerability. By validating magic bytes directly from the binary buffer (`detectImageMime`) and ignoring the client's file name, executable payloads (PHP, HTML, Bash scripts) are rejected with HTTP 400. File extensions are hardcoded based on the detected MIME type, and filenames are replaced with cryptographic `cuid2` identifiers, preventing directory traversal attacks (`../../`) and double-extension execution attacks (`.php.png`).

---

## 3. Caveats

1. **Server-Side File Persistence**: `POST /api/upload` writes files to `public/uploads` on the local file system. In multi-instance serverless deployments (e.g., Vercel), local disk persistence is ephemeral; an external blob store (e.g. S3 / R2) would be needed for distributed production, though for local/VPS deployment, the current implementation satisfies all security constraints.
2. **Cleanup of Empirical Test Artifacts**: All test users, boards, collaborators, comments, rate limit records, and uploaded files created during `scripts/test-challenger-m2-ratelimit-idor.ts` were cleaned up in a `finally` block.
3. **Standalone Script Execution**: `scripts/test-challenger-m2-ratelimit-idor.ts` is excluded from the Next.js production build via `tsconfig.json` so that development and test harnesses do not bloat production bundle size.

---

## 4. Conclusion

**Verdict: PASS (0 Vulnerabilities Found)**.
Milestone 2's implementation of Rate Limiting, IDOR Authorization, and File Upload Security was subjected to 45 live empirical stress attacks and exploit attempts. All attacks were successfully repelled:
- Atomic SQLite UPSERT eliminates TOCTOU race conditions under high concurrency.
- Soft-deleted boards are strictly inaccessible across all endpoints.
- Role-based permissions (owner, editor, viewer) are rigorously enforced across all board, collaborator, and comment APIs.
- Uploaded files are strictly validated via magic bytes and assigned sanitized server names, eliminating stored XSS, polyglots, and path traversal vectors.

Milestone 2 is verified and ready for gating approval.

---

## 5. Verification Method

To independently reproduce the empirical challenge results:

1. **Run the Empirical Challenger Suite**:
   ```bash
   npx tsx scripts/test-challenger-m2-ratelimit-idor.ts
   ```
   *Expected Output*:
   - 45 tests executed across Rate Limiting, IDOR, and Upload Security.
   - 45 passed, 0 failed.
   - Exit code 0.

2. **Run Unit and Integration Test Suites**:
   ```bash
   npm run test:unit
   ```
   *Expected Output*: 20 test files passed (148 passed, 0 failed).

3. **Run Code Quality and Production Build**:
   ```bash
   npm run lint
   npm run build
   ```
   *Expected Output*: Lint passes with 0 warnings/errors; build completes with exit code 0 and 26/26 routes compiled.
