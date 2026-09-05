# Review & Adversarial Stress Test Report: Milestone 1 (Turso DB Cloud Persistence & Schema Integrity)

**Reviewer**: Reviewer 1 (`teamwork_preview_reviewer_m1_1`)  
**Parent**: Sub-Orchestrator M1 (`sub_orch_m1`, `dbefc965-e54e-4106-b236-b0c2e5c3d7ae`)  
**Verdict**: **APPROVE**  
**Date**: 2026-09-04  

---

## 1. Observation

### 1.1 Integrity Violation Audit
- **Check 1: Hardcoded test results or expected outputs**: Searched across `src/lib/db.ts`, `src/lib/schema.ts`, `src/app/api/boards/route.ts`, and `src/app/api/boards/[id]/route.ts`. No hardcoded dummy return values or test stubs found.
- **Check 2: Dummy or facade implementations**: `src/lib/db.ts` genuinely instantiates `@libsql/client` with `createClient({ url, authToken })` and wraps it via Drizzle ORM `drizzle(client, { schema })`.
- **Check 3: Shortcuts or mock bypasses**: No `:memory:` bypasses. No mock database adapters.
- **Check 4: Fabricated verification outputs**: Verification executed directly against remote Turso instance `libsql://the-case-file-hardikrawat.aws-ap-south-1.turso.io`.
- **Finding**: **0 Integrity Violations Detected.**

### 1.2 Fail-Fast Client Enforcement (`src/lib/db.ts` & `drizzle.config.ts`)
- In `src/lib/db.ts` (lines 8-26):
  ```ts
  if (!url || url.trim() === '') {
      throw new Error(
          '[CRITICAL] TURSO_DATABASE_URL is missing. In-memory SQLite fallback (:memory:) is strictly prohibited. Configure TURSO_DATABASE_URL in .env.local.'
      );
  }

  if (url === ':memory:') {
      throw new Error(
          '[CRITICAL] In-memory SQLite database (:memory:) is strictly prohibited. Configure a valid remote Turso database URL in .env.local.'
      );
  }

  const isRemote = url.startsWith('libsql://') || url.startsWith('https://') || url.startsWith('wss://');

  if (isRemote && (!authToken || authToken.trim() === '')) {
      throw new Error(
          `[CRITICAL] TURSO_AUTH_TOKEN is required to connect to remote Turso DB at ${url}. Configure TURSO_AUTH_TOKEN in .env.local.`
      );
  }
  ```
- Executed empirical fail-fast checks:
  1. `TURSO_DATABASE_URL="" npx tsx -e "import('./src/lib/db')"` -> Threw code 1 with: `Error: [CRITICAL] TURSO_DATABASE_URL is missing. In-memory SQLite fallback (:memory:) is strictly prohibited. Configure TURSO_DATABASE_URL in .env.local.`
  2. `TURSO_DATABASE_URL=":memory:" npx tsx -e "import('./src/lib/db')"` -> Threw code 1 with: `Error: [CRITICAL] In-memory SQLite database (:memory:) is strictly prohibited. Configure a valid remote Turso database URL in .env.local.`
  3. `TURSO_DATABASE_URL="libsql://the-case-file-hardikrawat.aws-ap-south-1.turso.io" TURSO_AUTH_TOKEN="" npx tsx -e "import('./src/lib/db')"` -> Threw code 1 with: `Error: [CRITICAL] TURSO_AUTH_TOKEN is required to connect to remote Turso DB at libsql://the-case-file-hardikrawat.aws-ap-south-1.turso.io. Configure TURSO_AUTH_TOKEN in .env.local.`
  4. Valid credentials with `.env.local` -> Exited code 0 with `DB Module Loaded Successfully`.
  5. Tested 9 edge cases (undefined, empty string, `:memory:`, whitespace `"   "`, remote URL with empty token, remote URL with whitespace token, https URL with empty token, wss URL with empty token) via `scripts/adversarial-stress-m1.ts` -> **9/9 passed**.

### 1.3 Live Cloud Schema & Index Verification
- Queried remote Turso cloud database (`libsql://the-case-file-hardikrawat.aws-ap-south-1.turso.io`) directly via `@libsql/client`:
  - **Tables verified (14 total)**:
    `accounts`, `boards`, `contributions`, `sessions`, `users`, `verificationToken`, `board_collaborators`, `board_versions`, `email_verification_tokens`, `password_reset_tokens`, `user_reputation`, `rate_limits`, `notifications`, `comments`.
  - **`boards` columns verified**:
    `id (TEXT)`, `userId (TEXT)`, `title (TEXT)`, `is_public (INTEGER)`, `content (TEXT)`, `thumbnail (TEXT)`, `stars (INTEGER)`, `views (INTEGER)`, `created_at (INTEGER)`, `updated_at (INTEGER)`, `parentId (TEXT)`, `deleted_at (INTEGER)`, `version (INTEGER, dflt=1, notnull=1)`.
  - **`comments` columns verified**:
    `is_anonymous (INTEGER, dflt=false)`.
  - **`notifications` columns verified**:
    `id (TEXT)`, `recipient_id (TEXT)`, `actor_id (TEXT)`, `type (TEXT)`, `reference_id (TEXT)`, `reference_type (TEXT)`, `message (TEXT)`, `is_read (INTEGER)`, `created_at (INTEGER)`.
  - **Relational and unique indexes verified (21 total)**:
    - `users_email_unique` ON `users(email)`
    - `email_verification_tokens_token_unique` ON `email_verification_tokens(token)`
    - `password_reset_tokens_token_unique` ON `password_reset_tokens(token)`
    - `boards_userId_idx` ON `boards(userId)`
    - `boards_updated_at_idx` ON `boards(updated_at)`
    - `boards_is_public_deleted_at_idx` ON `boards(is_public, deleted_at)`
    - `boards_parent_id_idx` ON `boards(parentId)`
    - `accounts_userId_idx` ON `accounts(userId)`
    - `contributions_boardId_idx` ON `contributions(boardId)`
    - `contributions_userId_idx` ON `contributions(userId)`
    - `sessions_userId_idx` ON `sessions(userId)`
    - `board_collaborators_board_user_idx` (UNIQUE) ON `board_collaborators(board_id, user_id)`
    - `board_versions_board_id_idx` ON `board_versions(board_id)`
    - `email_verification_tokens_user_id_idx` ON `email_verification_tokens(user_id)`
    - `password_reset_tokens_user_id_idx` ON `password_reset_tokens(user_id)`
    - `user_reputation_points_idx` ON `user_reputation(points)`
    - `rate_limits_expires_at_idx` ON `rate_limits(expires_at)`
    - `notifications_recipient_id_is_read_idx` ON `notifications(recipient_id, is_read)`
    - `comments_board_id_idx` ON `comments(board_id)`
    - `comments_node_id_idx` ON `comments(node_id)`
    - `comments_user_id_idx` ON `comments(user_id)`

### 1.4 Adversarial Constraint Stress Tests
- **Collaborator Unique Constraint Stress Test**:
  Attempted inserting duplicate `(board_id, user_id)` pair into `board_collaborators`.
  Direct result: `SQLITE_CONSTRAINT: SQLite error: UNIQUE constraint failed: board_collaborators.board_id, board_collaborators.user_id`.
- **Foreign Key Constraint Stress Test**:
  Attempted inserting board with invalid `parentId`.
  Direct result: `SQLITE_CONSTRAINT: SQLite error: FOREIGN KEY constraint failed`.
- **Soft-Delete Lifecycle Stress Test**:
  1. Inserted test board with `deleted_at: null`.
  2. Queried with `isNull(boards.deletedAt)` -> Successfully returned active board.
  3. Soft-deleted board by updating `deletedAt: new Date()`.
  4. Queried with `isNull(boards.deletedAt)` -> Board omitted (returned null/empty).
  5. Queried physical row `SELECT id, deleted_at FROM boards` -> Row exists with `deleted_at` timestamp `1788534797`.
- **Boards Version Increment Stress Test**:
  1. Created board without explicit version -> Defaulted to `1`.
  2. Incremented version -> Became `2`.
  3. Incremented version again -> Became `3`.
- **Comments isAnonymous Stress Test**:
  1. Created comment without `isAnonymous` -> Defaulted to `false`.
  2. Created comment with `isAnonymous: true` -> Stored as `true`.

### 1.5 Soft-Delete Alignment & API Endpoints
- `src/app/api/boards/[id]/route.ts`:
  - `GET`: Queries with `where: and(eq(boards.id, id), isNull(boards.deletedAt))`, returns 404 if deleted.
  - `PUT`: Checks `where: and(eq(boards.id, id), isNull(boards.deletedAt))` on lookup and updates `where(and(eq(boards.id, id), isNull(boards.deletedAt)))`, returning 404 if deleted.
  - `DELETE`: Verifies session (401), active board (404), ownership (403), sets `deletedAt: new Date()` and `updatedAt: new Date()`.
- `src/app/api/boards/route.ts`:
  - Filters `where(and(eq(boards.userId, session.user.id), isNull(boards.deletedAt)))` and orders by `desc(boards.updatedAt)`.
- `src/app/(authenticated)/discover/page.tsx` & `src/app/page.tsx`:
  - Filters `where: and(eq(boards.isPublic, true), isNull(boards.deletedAt))`.
- `src/app/api/profile/[id]/route.ts`:
  - Filters `where: and(eq(boards.userId, params.id), isNull(boards.deletedAt))` for `boardsCount`.
- `src/lib/search.ts`:
  - Filters `and(..., isNull(boards.deletedAt))`.

### 1.6 Unit Tests & Linting
- `npm run test:unit`: 16 test files passed, 107 tests passed (0 failures).
- `npm run lint`: `✔ No ESLint warnings or errors`.
- `npm run db:check`: `Everything's fine 🐶🔥`.
- `npm run db:test`: `✅ Connection Successful!`.

---

## 2. Logic Chain

1. **Premise**: In-memory database fallback (`:memory:`) allowed ephemeral data loss.
   - *Observation*: `src/lib/db.ts` lines 8-18 throws fatal errors if `TURSO_DATABASE_URL` is empty, whitespace, or `:memory:`. Lines 22-26 requires `TURSO_AUTH_TOKEN` for remote URLs.
   - *Inference*: The application can never silently default to ephemeral memory or unauthenticated remote URLs.

2. **Premise**: Cloud schema synchronization must support all entity fields, relations, and performance constraints without data loss.
   - *Observation*: Live database inspection on Turso verified 14 tables and 21 indexes, including `boards.version`, `boards.parentId`, `comments.isAnonymous`, `notifications`, and composite unique index on `boardCollaborators(boardId, userId)`.
   - *Inference*: Schema integrity is complete and actively enforced by Turso SQLite engine.

3. **Premise**: Soft-deleted boards must remain physically preserved for audit while being completely invisible across user-facing routes.
   - *Observation*: Direct ORM tests confirmed that updating `deletedAt` removes the board from `isNull(boards.deletedAt)` queries while retaining the row and timestamps in Turso.
   - *Inference*: Soft delete implementation satisfies both data retention and UI isolation requirements.

---

## 3. Caveats

- Pre-existing compilation blocker in `src/components/Board.tsx` (missing `connectMode` in `RFState`) is an untouched frontend issue scheduled for Milestone 3 (Feature 16). All files modified in Milestone 1 pass TypeScript verification with 0 errors.
- Milestone 2 will implement the unified `getBoardAccess` helper and remove `x-test-bypass` headers from auth files and `board/[id]/page.tsx`.

---

## 4. Conclusion

**Verdict: APPROVE**

The work submitted for Milestone 1 strictly fulfills all requirements of `SCOPE.md`, `PROJECT.md`, and `ORIGINAL_REQUEST.md`:
1. Environment configuration is complete and functional (`.env.local`, db scripts in `package.json`).
2. `src/lib/db.ts` eliminates `:memory:` fallback, validates remote auth tokens, and fails fast.
3. Schema synchronization against cloud Turso DB succeeded with 14 tables and 21 indexes verified.
4. Soft delete logic and `DELETE /api/boards/[id]` endpoint are fully implemented and verified.
5. 0 integrity violations; 107/107 unit tests passed; 0 lint errors.

---

## 5. Verification Method

To independently reproduce this verification:

```bash
# 1. Run unit test suite
npm run test:unit

# 2. Run linter
npm run lint

# 3. Verify Drizzle schema against DB definition
npm run db:check

# 4. Verify live Turso DB connectivity
npm run db:test

# 5. Run full adversarial stress test suite (fail-fast + live constraints)
npx tsx scripts/adversarial-stress-m1.ts

# 6. Verify fail-fast behavior directly
TURSO_DATABASE_URL="" npx tsx -e "import('./src/lib/db')"
TURSO_DATABASE_URL=":memory:" npx tsx -e "import('./src/lib/db')"
TURSO_DATABASE_URL="libsql://the-case-file-hardikrawat.aws-ap-south-1.turso.io" TURSO_AUTH_TOKEN="" npx tsx -e "import('./src/lib/db')"
```

### Invalidation Conditions
- If `TURSO_DATABASE_URL="" npx tsx -e "import('./src/lib/db')"` does not exit with code 1, verification is invalid.
- If `TURSO_DATABASE_URL=":memory:" npx tsx -e "import('./src/lib/db')"` connects without throwing, verification is invalid.
- If duplicate inserts on `boardCollaborators(boardId, userId)` succeed without throwing `SQLITE_CONSTRAINT`, verification is invalid.
- If soft-deleted boards are returned by `GET /api/boards` or `GET /api/boards/[id]`, verification is invalid.
