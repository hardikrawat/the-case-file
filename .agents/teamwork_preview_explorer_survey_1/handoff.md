# Comprehensive Database & Persistence Investigation Report (R1 & Persistence Gaps)

**Working Directory**: `/Users/hardikrawat/Documents/the-case-file/.agents/teamwork_preview_explorer_survey_1`  
**Focus Area**: Requirement R1 (Cloud Turso DB Persistence & Schema Integrity) and all Database & Persistence issues across 'The Case File' codebase.

---

## 1. Observation

### 1.1 Reference Documentation & Repository History
- Searched workspace for `gap_analysis_report.md` and `bug_analysis_report.md` using `mdfind` and filesystem traversal. The files are not separate disk artifacts; the authoritative requirements and issue categories are codified in `/Users/hardikrawat/Documents/the-case-file/.agents/ORIGINAL_REQUEST.md` (and mirrored at `./ORIGINAL_REQUEST.md`).
- Git log shows recent commits: `260bcec` ("Merge pull request #2 from hardikrawat/improved-linking-functionality-in-board-editor"), `93245c5` ("Hot Fix: Failing npm run build"), and `e749f9f` ("Merge pull request #1 from hardikrawat/improvement-in-existing-functionality"). No uncommitted stashes exist.

### 1.2 Database Client Initialization & Silent Fallback
In `/Users/hardikrawat/Documents/the-case-file/src/lib/db.ts`:
```typescript
5: const url = process.env.TURSO_DATABASE_URL || ':memory:';
6: const authToken = process.env.TURSO_AUTH_TOKEN;
7: 
8: const client = createClient({
9:     url,
10:     authToken,
11: });
12: 
13: export const db = drizzle(client, { schema });
```
- Line 5 quietly falls back to `:memory:` when `TURSO_DATABASE_URL` is undefined, empty, or unset.
- When running in serverless/Next.js routes, every process/worker reload boots a blank in-memory SQLite database, discarding any previously saved data.
- If `TURSO_DATABASE_URL` is set to `libsql://...` but `TURSO_AUTH_TOKEN` is missing, initialization succeeds silently, but the first query crashes at runtime.

### 1.3 Cloud Turso DB Live Connection & Remote Schema
Connection to cloud Turso DB was tested with credentials from `ORIGINAL_REQUEST.md`:
- `TURSO_DATABASE_URL`: `libsql://the-case-file-hardikrawat.aws-ap-south-1.turso.io`
- `TURSO_AUTH_TOKEN`: Valid EdDSA JWT token (expires ~year 2026).
- Result: Live connection established successfully (`SELECT 1` returns `1`).
- Direct inspection of `sqlite_master` on the live Turso DB revealed **31 objects** (13 tables and 18 indexes/autoindexes):
  1. `accounts`: `userId`, `type`, `provider`, `providerAccountId`, `refresh_token`, `access_token`, `expires_at`, `token_type`, `scope`, `id_token`, `session_state`, `PRIMARY KEY (provider, providerAccountId)`, `FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE`.
  2. `boards`: `id` (PK), `userId` (FK users.id ON DELETE CASCADE), `title`, `is_public`, `content`, `thumbnail`, `stars`, `views`, `created_at`, `updated_at`, `parentId`, `deleted_at`.
  3. `contributions`: `id` (PK), `boardId` (FK boards.id ON DELETE CASCADE), `userId` (FK users.id ON DELETE CASCADE), `snapshot`, `message`, `status`, `created_at`.
  4. `sessions`: `sessionToken` (PK), `userId` (FK users.id ON DELETE CASCADE), `expires`.
  5. `users`: `id` (PK), `name`, `email` (UNIQUE), `emailVerified`, `image`, `created_at`, `password_hash`, `email_verified_flag`, `bio`, `avatar_url`.
  6. `verificationToken`: `identifier`, `token`, `expires`, `PRIMARY KEY (identifier, token)`.
  7. `board_collaborators`: `id` (PK), `board_id` (FK boards.id ON DELETE CASCADE), `user_id` (FK users.id ON DELETE CASCADE), `role`, `added_at`.
  8. `board_versions`: `id` (PK), `board_id` (FK boards.id ON DELETE CASCADE), `content`, `created_by` (FK users.id), `created_at`.
  9. `email_verification_tokens`: `id` (PK), `user_id` (FK users.id ON DELETE CASCADE), `token` (UNIQUE), `expires`, `created_at`.
  10. `password_reset_tokens`: `id` (PK), `user_id` (FK users.id ON DELETE CASCADE), `token` (UNIQUE), `expires`, `created_at`.
  11. `user_reputation`: `user_id` (PK, FK users.id ON DELETE CASCADE), `points`, `boards_created`, `contributions_accepted`, `last_updated`.
  12. `rate_limits`: `key` (PK), `count`, `expires_at`.
  13. `notifications`: `id` (PK), `recipient_id` (FK users.id ON DELETE CASCADE), `actor_id` (FK users.id ON DELETE CASCADE), `type`, `reference_id`, `reference_type`, `message`, `is_read`, `created_at`.
  14. `comments`: `id` (PK), `board_id` (FK boards.id ON DELETE CASCADE), `node_id`, `user_id` (FK users.id ON DELETE CASCADE), `content`, `parent_id`, `created_at`, `updated_at`, `is_anonymous` (integer DEFAULT false).

### 1.4 Schema Discrepancies (`src/lib/schema.ts` vs Live Turso DB & Requirements)
Comparing `/Users/hardikrawat/Documents/the-case-file/src/lib/schema.ts` with Turso DB and application code:
1. **Missing `notifications` Table**: Present on live Turso DB, but completely omitted from `src/lib/schema.ts`. If `drizzle-kit push` is executed, Drizzle will prompt to DROP the existing `notifications` table.
2. **Missing `comments.is_anonymous` Column**: In `src/lib/schema.ts` lines 111-124, `comments` lacks `is_anonymous`, whereas the live Turso DB table contains `is_anonymous integer DEFAULT false`.
3. **Missing Optimistic Locking Column on `boards`**: In `src/lib/schema.ts` lines 57-72, `boards` has no `version: integer('version').default(1).notNull()`. Requirement R3 explicitly mandates "auto-saving with optimistic locking".
4. **Missing Self-Referential Foreign Keys**:
   - `boards.parentId` in `src/lib/schema.ts:63` is `parentId: text('parentId')` without `.references(() => boards.id, { onDelete: 'set null' })`.
   - `comments.parentId` in `src/lib/schema.ts:121` is `parentId: text('parent_id')` without foreign key reference to `comments.id`.
5. **Missing Database-Level Unique Constraint on `board_collaborators`**:
   - In `src/lib/schema.ts` lines 140-150, `boardCollaborators` has primary key `id`, but NO unique constraint or unique index on `(board_id, user_id)`.
6. **Missing Indexes Across the Whole Schema**:
   - In SQLite/Turso, foreign keys do NOT create indexes automatically.
   - `accounts.userId` has no index.
   - `sessions.userId` has no index.
   - `boards.userId` has no index (used in `GET /api/boards`, profile page).
   - `boards.parentId` has no index (lineage).
   - `boards.isPublic` and `boards.deletedAt` have no composite index (used in `src/lib/search.ts:44-52` and `src/app/(authenticated)/discover/page.tsx:28-35`).
   - `boards.updatedAt` has no index (used in `GET /api/boards:62` for sorting).
   - `contributions.boardId` and `contributions.userId` have no index (used in `src/app/api/contributions/route.ts:86, 96, 111`).
   - `comments.boardId`, `comments.nodeId`, and `comments.userId` have no index (used in `src/app/api/comments/route.ts:34-38`).
   - `boardVersions.boardId` has no index (used in `src/app/api/boards/[id]/versions/route.ts:51`).
   - `userReputation.points` has no index (used in `src/app/api/leaderboard/route.ts:14` for `desc(userReputation.points)`).
   - `rateLimits.expiresAt` has no index (used in `src/lib/rate-limit.ts:17` for periodic cleanup: `lt(rateLimits.expiresAt, new Date(now))`).
   - `emailVerificationTokens.userId` and `passwordResetTokens.userId` have no indexes (used in `src/lib/auth-utils.ts:75`).

### 1.5 Soft-Delete (`deletedAt`) Inconsistencies
Although `boards.deletedAt` exists in `src/lib/schema.ts:69`:
1. `GET /api/boards` (`src/app/api/boards/route.ts:62`):
   ```typescript
   .where(eq(boards.userId, session.user.id)).orderBy(boards.updatedAt)
   ```
   Does not check `isNull(boards.deletedAt)`. Soft-deleted boards are returned to users.
2. `GET /api/boards/[id]` (`src/app/api/boards/[id]/route.ts:68-73`):
   Does not check `isNull(boards.deletedAt)`. Users can fetch soft-deleted boards.
3. `PUT /api/boards/[id]` (`src/app/api/boards/[id]/route.ts:19-24`):
   Does not check `isNull(boards.deletedAt)`. Users can edit soft-deleted boards.
4. `DELETE /api/boards/[id]`:
   Completely missing from `src/app/api/boards/[id]/route.ts`. No endpoint exists to delete or soft-delete a board.
5. `GET /api/profile/[id]` (`src/app/api/profile/[id]/route.ts:35-37`):
   ```typescript
   const userBoards = await db.select().from(boards).where(eq(boards.userId, params.id));
   ```
   Counts soft-deleted boards in `boardsCount`.
6. `src/app/(authenticated)/discover/page.tsx:28-35`:
   Queries `where: eq(boards.isPublic, true)` without checking `isNull(boards.deletedAt)`. Soft-deleted public boards appear in the discovery feed.
7. `src/app/page.tsx:39-46`:
   Queries `where: eq(boards.isPublic, true)` without checking `isNull(boards.deletedAt)`. Soft-deleted featured cases appear on the landing page.

### 1.6 Reputation System Disconnect
In `/Users/hardikrawat/Documents/the-case-file/src/lib/reputation.ts`:
- `awardPoints(userId, action)` defines points for `board_created` (+10), `board_made_public` (+5), `board_shared` (+3), `comment_posted` (+2), and `profile_completed` (+15).
- Search across the entire codebase revealed that `awardPoints` is ONLY called in `tests/unit/reputation.test.ts`.
- It is NEVER invoked in:
  - `POST /api/boards`: `awardPoints(userId, 'board_created')` is missing.
  - `PUT /api/boards/[id]`: `awardPoints(userId, 'board_made_public')` is missing.
  - `POST /api/comments`: `awardPoints(userId, 'comment_posted')` is missing.
  - `POST /api/contributions/[id]/merge`: Contributor reputation (+points and +`contributionsAccepted`) is missing.
  - `PUT /api/profile/[id]`: `awardPoints(userId, 'profile_completed')` is missing.
- `GET /api/leaderboard` (`src/app/api/leaderboard/route.ts:12-15`):
  Queries `userReputation` without joining `users`. The client (`src/app/(authenticated)/leaderboard/page.tsx:65`) displays `"Detective #" + entry.userId.slice(0, 8)` because the user's name and image are missing from the API payload.

### 1.7 Collaborators API Disconnect
In `src/app/api/boards/[id]/collaborators/route.ts`:
- Validates input with Zod schema: `z.object({ userId: z.string().min(1), role: z.enum(...) })`.
- In `src/components/CollaboratorsPanel.tsx:50`:
  Frontend submits `{ userEmail: newEmail, role: newRole }`. The API fails with validation error `User ID is required`.
- In `src/components/CollaboratorsPanel.tsx:70`:
  Frontend calls `DELETE /api/boards/${boardId}/collaborators/${collaboratorId}`, but no DELETE handler exists, resulting in HTTP 404.
- Role updates (PATCH/PUT) are completely unimplemented.

### 1.8 Version History Persistence Gap
In `src/app/api/boards/[id]/versions/route.ts`:
- `POST /api/boards/[id]/versions` exists at line 62, but search across `src/` revealed it is NEVER called.
- In `src/components/Board.tsx:151-172` (`handleSave`), boards are saved via `PUT /api/boards/${boardId}`, but no version snapshot is recorded in `boardVersions`.
- As a result, `src/components/VersionHistory.tsx` always displays "No version history yet".

### 1.9 Comments API User Join Gap
In `src/app/api/comments/route.ts:40-45`:
- `GET /api/comments` selects directly from `comments` table without joining `users`.
- In `src/components/CommentsPanel.tsx:109`:
  UI attempts to render `comment.userName || 'Anonymous'`. Since `userName` is never joined or returned, every comment displays as "Anonymous".

### 1.10 Rate Limiting Atomicity & Schema Gap
In `src/lib/rate-limit.ts`:
- `checkRateLimit` reads record via `db.select().from(rateLimits).where(eq(rateLimits.key, key))` and then updates/inserts in a subsequent call.
- This creates a race condition where concurrent requests read the same count and bypass rate limits.
- The cleanup query `db.delete(rateLimits).where(lt(rateLimits.expiresAt, new Date(now)))` does a table scan because `rate_limits.expires_at` has no index.

### 1.11 Cross-Board State Contamination in Zustand
In `src/store/useStore.ts:134-147`:
- Store persistence middleware uses a static key: `name: 'case-file-storage'`.
- It saves current `nodes`, `edges`, `boardTitle`, `parentId`, and `isPublic` to localStorage under that single key.
- Navigating between boards loads stale nodes and edges from previously visited boards before network responses arrive, causing cross-board data contamination.

### 1.12 Drizzle Configuration & Tooling Scripts
In `drizzle.config.ts`:
```typescript
5: export default defineConfig({
6:     schema: './src/lib/schema.ts',
7:     out: './drizzle',
8:     dialect: 'turso',
9:     dbCredentials: {
10:         url: process.env.TURSO_DATABASE_URL!,
11:         authToken: process.env.TURSO_AUTH_TOKEN!,
12:     },
13: });
```
- `drizzle-kit push` natively supports `--dialect turso`.
- In `package.json`, there are NO database management scripts (no `db:push`, `db:generate`, `db:migrate`, `db:studio`).
- `.env.local` is currently missing from the workspace root (ignored by `.gitignore`).

---

## 2. Logic Chain

1. **Premise**: Remote persistence on cloud Turso DB is required with zero silent fallback to in-memory databases (R1, Acceptance Criteria #47, #49).
   - **Observation Ref**: `src/lib/db.ts:5` assigns `url = process.env.TURSO_DATABASE_URL || ':memory:'`.
   - **Inference**: An unconfigured environment silently operates on a transient in-memory SQLite database, causing loss of data across worker recycles and masking configuration errors.
   - **Action**: Modify `src/lib/db.ts` to strictly validate `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`, throwing immediate descriptive errors at module evaluation if missing.

2. **Premise**: Schema synchronization via `drizzle-kit push` against cloud Turso DB must maintain schema integrity without data loss or table dropping.
   - **Observation Ref**: Turso DB contains `notifications` and `comments.is_anonymous`, but `src/lib/schema.ts` lacks both.
   - **Inference**: Running `drizzle-kit push` with the current `schema.ts` will prompt to drop the `notifications` table and drop the `is_anonymous` column on `comments`.
   - **Action**: Add `notifications` table definition, relations, and `comments.isAnonymous` column into `src/lib/schema.ts` before running schema push.

3. **Premise**: Query performance, relational consistency, and referential integrity require foreign key indexes and unique constraints.
   - **Observation Ref**: SQLite does not automatically index foreign keys; `board_collaborators` has no unique constraint on `(board_id, user_id)`.
   - **Inference**: Concurrent collaborator additions can create duplicate records; queries on `userId`, `boardId`, `status`, and `points` will degrade into sequential table scans as the dataset grows.
   - **Action**: Define explicit indexes and composite unique constraints using `index()` and `uniqueIndex()` in `src/lib/schema.ts`.

4. **Premise**: Soft-delete semantics (`deletedAt`) must be consistently respected across all read and write query paths.
   - **Observation Ref**: `boards.deletedAt` exists, but `GET /api/boards`, `GET /api/boards/[id]`, `PUT /api/boards/[id]`, `GET /api/profile/[id]`, and public board queries lack `isNull(boards.deletedAt)`. No DELETE route exists.
   - **Inference**: Deleting a board (or marking `deletedAt`) currently does not prevent it from being queried, edited, or listed in feeds.
   - **Action**: Implement `DELETE /api/boards/[id]` setting `deletedAt = new Date()`, and append `isNull(boards.deletedAt)` to all boards queries.

5. **Premise**: User reputation must reflect user actions in real time across the platform (R4).
   - **Observation Ref**: `awardPoints` in `src/lib/reputation.ts` is never called by any API route; leaderboard does not join `users`.
   - **Inference**: User reputation points remain static (0) regardless of board creations, public releases, comments, or accepted contributions.
   - **Action**: Hook `awardPoints` into `POST /api/boards`, `PUT /api/boards/[id]`, `POST /api/comments`, and `POST /api/contributions/[id]/merge`. Join `users` in `GET /api/leaderboard`.

6. **Premise**: Zustand client state must be scoped per board to prevent cross-board state leakage.
   - **Observation Ref**: `useStore.ts:135` persists with global key `'case-file-storage'`.
   - **Inference**: Opening board B immediately renders board A's cached nodes and edges from localStorage before remote data arrives.
   - **Action**: Provide a reset action (`resetBoardState`) when mounting a board, and isolate or bypass localStorage persistence during cross-board navigation.

---

## 3. Caveats

- **Existing Data Safety**: The cloud Turso database has existing tables and schema structures. Running `drizzle-kit push` must be done carefully to ensure non-destructive synchronization (adding missing indexes and columns without dropping tables).
- **OAuth Credentials**: The database contains tables for OAuth accounts (`accounts`, `sessions`), but only GitHub and Google client IDs are conditionally loaded in `src/auth.ts`. Credentials authentication with JWT sessions is the primary active path.
- **Node Modules & Local Dependencies**: `node_modules` was cleanly installed during investigation via `npm ci`. The environment is ready for build and migration tasks.

---

## 4. Conclusion

The application's persistence architecture can be fully aligned with cloud Turso DB and all 124 feature gaps/157 bugs addressed by executing a structured implementation across 5 phases:

### Phase 1: Environment & Tooling Configuration
1. Populate `.env.local` with the verified cloud Turso credentials and application secrets:
   ```env
   TURSO_DATABASE_URL=libsql://the-case-file-hardikrawat.aws-ap-south-1.turso.io
   TURSO_AUTH_TOKEN=eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODg1MzI4OTIsImlkIjoiZTc1YzQzZjktNGNlYy00ZmQyLWE1YzgtNTY4ZDFlM2I5MTRkIiwia2lkIjoiMWJvLWNfaVFSb010THZkcVVQc09ZSTByeWVIM2x0VEstcFBYU1AxTldJcyIsInJpZCI6IjE1ZGRjNDM1LWY2ZjgtNDJjMi04YjM0LTg2ZTE5NDc4NDc3MCJ9.NLQbA_6E0u-z3TFYSESi_K0L0ayZKxbRDYb8fsUx7a39Qm0UvL1PYo3h89laelUIADXl7GUb-BfkOVvhoNTaCw
   AUTH_SECRET=the-case-file-super-secret-key-development-2026
   NEXTAUTH_URL=http://localhost:3000
   ```
2. Add database maintenance scripts to `package.json`:
   ```json
   "db:generate": "drizzle-kit generate",
   "db:push": "drizzle-kit push",
   "db:migrate": "drizzle-kit migrate",
   "db:studio": "drizzle-kit studio",
   "db:check": "drizzle-kit check"
   ```

### Phase 2: Client Fail-Fast & Memory Fallback Elimination
Update `/Users/hardikrawat/Documents/the-case-file/src/lib/db.ts`:
```typescript
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
    throw new Error(
        '[CRITICAL] TURSO_DATABASE_URL is missing. In-memory SQLite fallback (:memory:) is completely disabled. Configure TURSO_DATABASE_URL in .env.local.'
    );
}

if ((url.startsWith('libsql://') || url.startsWith('https://')) && !authToken) {
    throw new Error(
        '[CRITICAL] TURSO_AUTH_TOKEN is required to connect to remote Turso DB at ' + url
    );
}

const client = createClient({
    url,
    authToken,
});

export const db = drizzle(client, { schema });
```

### Phase 3: Schema Synchronization & Performance Hardening
Update `/Users/hardikrawat/Documents/the-case-file/src/lib/schema.ts`:
1. Add `isAnonymous` to `comments`:
   ```typescript
   isAnonymous: integer('is_anonymous', { mode: 'boolean' }).default(false),
   ```
2. Add `version` (for optimistic locking) and self-reference to `boards`:
   ```typescript
   version: integer('version').default(1).notNull(),
   parentId: text('parentId').references((): any => boards.id, { onDelete: 'set null' }),
   ```
3. Add `notifications` table:
   ```typescript
   export const notifications = sqliteTable('notifications', {
       id: text('id').primaryKey().$defaultFn(() => createId()),
       recipientId: text('recipient_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
       actorId: text('actor_id').references(() => users.id, { onDelete: 'cascade' }),
       type: text('type').notNull(),
       referenceId: text('reference_id').notNull(),
       referenceType: text('reference_type').notNull(),
       message: text('message').notNull(),
       isRead: integer('is_read', { mode: 'boolean' }).default(false),
       createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
   });
   ```
4. Add all missing indexes and unique constraints:
   - `uniqueIndex('board_collaborators_board_user_idx').on(boardCollaborators.boardId, boardCollaborators.userId)`
   - `index('accounts_user_id_idx').on(accounts.userId)`
   - `index('sessions_user_id_idx').on(sessions.userId)`
   - `index('boards_user_id_idx').on(boards.userId)`
   - `index('boards_public_deleted_idx').on(boards.isPublic, boards.deletedAt)`
   - `index('boards_updated_at_idx').on(boards.updatedAt)`
   - `index('contributions_board_id_idx').on(contributions.boardId)`
   - `index('contributions_user_id_idx').on(contributions.userId)`
   - `index('comments_board_id_idx').on(comments.boardId)`
   - `index('comments_node_id_idx').on(comments.nodeId)`
   - `index('board_versions_board_id_idx').on(boardVersions.boardId)`
   - `index('user_reputation_points_idx').on(userReputation.points)`
   - `index('rate_limits_expires_at_idx').on(rateLimits.expiresAt)`
   - `index('notifications_recipient_idx').on(notifications.recipientId, notifications.isRead)`
5. Run `npx drizzle-kit push` to apply these indexes and columns directly to the remote Turso DB.

### Phase 4: API Routes & Soft-Delete Alignment
1. **Boards (`/api/boards`, `/api/boards/[id]`)**:
   - In `GET /api/boards`: Add `isNull(boards.deletedAt)`. Call `awardPoints(userId, 'board_created')` on `POST`.
   - In `GET /api/boards/[id]`: Filter out `isNull(boards.deletedAt)`.
   - In `PUT /api/boards/[id]`: Validate optimistic locking (`version`). If `version` mismatch, return 409 Conflict. Auto-create a `boardVersions` entry on save.
   - In `DELETE /api/boards/[id]`: Create DELETE handler setting `deletedAt = new Date()`.
2. **Collaborators (`/api/boards/[id]/collaborators`)**:
   - In `POST`: Accept either `userId` OR `userEmail` (look up user by email if provided).
   - Implement `DELETE /api/boards/[id]/collaborators/[collaboratorId]/route.ts` (or query param) to delete a collaborator.
   - Implement role update (PATCH/PUT).
3. **Comments (`/api/comments`)**:
   - In `GET /api/comments`: Left-join `users` table to return `userName: users.name` and `userImage: users.image`.
   - In `POST /api/comments`: Invoke `awardPoints(userId, 'comment_posted')`.
4. **Contributions (`/api/contributions/[id]/merge`)**:
   - On successful merge, invoke reputation award for the contributor (`contributions_accepted` +1, `points` +15).
   - Create a version in `boardVersions`.
5. **Leaderboard (`/api/leaderboard`)**:
   - Left-join `users` to return `userName: users.name` and `avatarUrl: users.avatarUrl`.
6. **Rate Limiting (`src/lib/rate-limit.ts`)**:
   - Implement atomic SQLite upsert using `sql` template with `ON CONFLICT(key) DO UPDATE SET ...` to prevent race conditions.

### Phase 5: Client Store & UI Isolation
1. In `src/store/useStore.ts`:
   - Add `clearBoard()` action to reset `nodes: []`, `edges: []`, `boardTitle: 'Untitled Case'`, `parentId: null`.
   - Call `clearBoard()` upon entering `Board.tsx` with a new `boardId` to prevent cross-board state leakage.

---

## 5. Verification Method

### 5.1 Remote Database Verification Commands
1. Verify credentials and live connectivity:
   ```bash
   npx tsx scripts/test-db.ts
   ```
   **Expected**: `✅ Connection Successful!` with rows returned.

2. Inspect remote Turso table definitions and verify index creation:
   ```bash
   node -e "
   const { createClient } = require('@libsql/client');
   const client = createClient({
     url: process.env.TURSO_DATABASE_URL,
     authToken: process.env.TURSO_AUTH_TOKEN
   });
   client.execute(\"SELECT name, type FROM sqlite_master WHERE type IN ('table', 'index')\").then(res => {
     console.log('Total DB objects:', res.rows.length);
     console.table(res.rows);
   });
   "
   ```
   **Expected**: Confirms all 13 tables and newly added indexes (`board_collaborators_board_user_idx`, `boards_public_deleted_idx`, etc.).

3. Verify fail-fast behavior:
   ```bash
   TURSO_DATABASE_URL="" node -e "require('./src/lib/db.ts')"
   ```
   **Expected**: Process exits with exception: `[CRITICAL] TURSO_DATABASE_URL is missing. In-memory SQLite fallback (:memory:) is completely disabled.`

### 5.2 Automated Test Commands
1. Run existing unit & integration test suite:
   ```bash
   npm run test:unit
   ```
   **Expected**: 16 test files pass (107 tests passing).

2. Verify production build with remote Turso environment variables:
   ```bash
   npm run build
   ```
   **Expected**: Next.js compiles all static and dynamic pages with 0 errors.

3. Verify linting:
   ```bash
   npm run lint
   ```
   **Expected**: 0 lint errors.

### 5.3 Invalidation Conditions
- If any API endpoint returns data from a soft-deleted board (`deletedAt IS NOT NULL`), verification fails.
- If `TURSO_DATABASE_URL` is omitted and the application starts without throwing an error (fallback to `:memory:` occurs), verification fails.
- If concurrent requests to `checkRateLimit` exceed the specified window limit, atomicity verification fails.
- If navigating from Board A to Board B displays Board A's nodes during loading, state isolation verification fails.
