# Milestone 1 Explorer 2 Handoff: Schema Modifications & Safe Migration Analysis

**Author**: Explorer 2 (`teamwork_preview_explorer_m1_2`)  
**Parent**: Sub-Orchestrator M1 (`sub_orch_m1`, `dbefc965-e54e-4106-b236-b0c2e5c3d7ae`)  
**Scope**: Schema modifications in `src/lib/schema.ts`, configuration in `drizzle.config.ts`, index optimization, relation verification, and non-destructive `drizzle-kit push` procedure.

---

## 1. Observation

### 1.1 Live Turso Database Inventory & State
Inspection of the cloud database (`libsql://the-case-file-hardikrawat.aws-ap-south-1.turso.io`) via `@libsql/client` executed against `sqlite_master`:
- **Existing Rows**:
  - `users`: 8 rows
  - `boards`: 15 rows
  - `contributions`: 7 rows
  - `comments`: 7 rows
  - `notifications`: 6 rows
  - `rate_limits`: 11 rows
  - `email_verification_tokens`: 2 rows
  - `password_reset_tokens`: 1 rows
  - `accounts`: 0 rows
  - `sessions`: 0 rows
  - `board_versions`: 0 rows
  - `board_collaborators`: 0 rows
  - `user_reputation`: 0 rows

- **Remote Table Structure Verbatim Findings**:
  1. `notifications` table exists in remote DB with 6 rows:
     ```sql
     CREATE TABLE `notifications` (
     	`id` text PRIMARY KEY NOT NULL,
     	`recipient_id` text NOT NULL,
     	`actor_id` text,
     	`type` text NOT NULL,
     	`reference_id` text NOT NULL,
     	`reference_type` text NOT NULL,
     	`message` text NOT NULL,
     	`is_read` integer DEFAULT false,
     	`created_at` integer DEFAULT (strftime('%s', 'now')),
     	FOREIGN KEY (`recipient_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
     	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
     )
     ```
  2. `comments` in remote DB already includes `is_anonymous`:
     ```sql
     `is_anonymous` integer DEFAULT false
     ```
  3. `boards` in remote DB:
     - Contains: `id`, `userId`, `title`, `is_public`, `content`, `thumbnail`, `stars`, `views`, `created_at`, `updated_at`, `parentId`, `deleted_at`.
     - Lacks `version` column.
     - `parentId` is defined as `parentId text` with NO foreign key constraint referencing `boards(id)`.
  4. `board_collaborators` in remote DB:
     - Lacks a unique constraint or index on `(board_id, user_id)`.
  5. **Existing Indexes in Remote DB**:
     Only 3 user-defined indexes exist:
     - `users_email_unique` ON `users(email)`
     - `email_verification_tokens_token_unique` ON `email_verification_tokens(token)`
     - `password_reset_tokens_token_unique` ON `password_reset_tokens(token)`
     All foreign keys across all 13 tables are completely unindexed.

### 1.2 Inspection of `src/lib/schema.ts`
File path: `/Users/hardikrawat/Documents/the-case-file/src/lib/schema.ts` (264 lines).
- **Line 1**:
  ```typescript
  import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';
  ```
  Lacks `index` and `uniqueIndex` imports.
- **Lines 57-72 (`boards`)**:
  `boards` lacks `version: integer('version').default(1).notNull()`.
  Line 63 defines `parentId: text('parentId')` without `.references((): any => boards.id, { onDelete: 'set null' })`.
  No index configuration function is passed (third argument to `sqliteTable`).
- **Lines 111-124 (`comments`)**:
  `comments` lacks `isAnonymous: integer('is_anonymous', { mode: 'boolean' }).default(false)`.
  No indexes defined on `board_id`, `node_id`, or `user_id`.
- **Lines 140-150 (`boardCollaborators`)**:
  Has primary key `id`, but no unique index or constraint on `(boardId, userId)`.
- **Lines 163-256 (`relations`)**:
  Completely missing `notificationsRelations`.
  Missing `receivedNotifications` and `triggeredNotifications` in `usersRelations`.
  Missing `parent` and `forks` self-referential relations in `boardsRelations`.

### 1.3 Inspection of `drizzle.config.ts`
File path: `/Users/hardikrawat/Documents/the-case-file/drizzle.config.ts`:
```typescript
import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

export default defineConfig({
    schema: './src/lib/schema.ts',
    out: './drizzle',
    dialect: 'turso',
    dbCredentials: {
        url: process.env.TURSO_DATABASE_URL!,
        authToken: process.env.TURSO_AUTH_TOKEN!,
    },
});
```
- Drizzle Kit version is `0.31.8` (`package.json:60`).
- Dialect is explicitly configured as `'turso'`.
- `dotenv.config({ path: '.env.local' })` automatically reads credentials if `.env.local` exists.

### 1.4 Test Run & Dialect Behavior on Live Schema Replica
A faithful replica of the live Turso DB schema was created in a test environment with seeded rows and evaluated against the updated schema:
- **With `dialect: 'turso'`**:
  Command: `npx drizzle-kit push --dialect=turso ...`
  Output:
  ```text
  Warning  You are about to execute current statements:

  ALTER TABLE `boards` ADD `version` integer DEFAULT 1 NOT NULL;
  CREATE INDEX `boards_userId_idx` ON `boards` (`userId`);
  CREATE INDEX `boards_updated_at_idx` ON `boards` (`updated_at`);
  CREATE INDEX `boards_is_public_deleted_at_idx` ON `boards` (`is_public`,`deleted_at`);
  CREATE INDEX `boards_parent_id_idx` ON `boards` (`parentId`);
  ALTER TABLE `boards` ALTER COLUMN "parentId" TO "parentId" text REFERENCES boards(id) ON DELETE set null ON UPDATE no action;
  CREATE INDEX `accounts_userId_idx` ON `accounts` (`userId`);
  CREATE INDEX `contributions_boardId_idx` ON `contributions` (`boardId`);
  CREATE INDEX `contributions_userId_idx` ON `contributions` (`userId`);
  CREATE INDEX `sessions_userId_idx` ON `sessions` (`userId`);
  CREATE UNIQUE INDEX `board_collaborators_board_user_idx` ON `board_collaborators` (`board_id`,`user_id`);
  CREATE INDEX `board_versions_board_id_idx` ON `board_versions` (`board_id`);
  CREATE INDEX `email_verification_tokens_user_id_idx` ON `email_verification_tokens` (`user_id`);
  CREATE INDEX `password_reset_tokens_user_id_idx` ON `password_reset_tokens` (`user_id`);
  CREATE INDEX `user_reputation_points_idx` ON `user_reputation` (`points`);
  CREATE INDEX `rate_limits_expires_at_idx` ON `rate_limits` (`expires_at`);
  CREATE INDEX `notifications_recipient_id_is_read_idx` ON `notifications` (`recipient_id`,`is_read`);
  CREATE INDEX `comments_board_id_idx` ON `comments` (`board_id`);
  CREATE INDEX `comments_node_id_idx` ON `comments` (`node_id`);
  CREATE INDEX `comments_user_id_idx` ON `comments` (`user_id`);

  [✓] Changes applied
  ```
- **Data Integrity Verification**:
  All existing records in `users`, `boards`, `comments`, and `notifications` remained intact.
  `boards` rows acquired `version = 1`.
  `comments` rows preserved `is_anonymous = 0`.
  Total database indexes increased from 3 to 21.
  A subsequent run output: `[i] No changes detected` (fully idempotent).

---

## 2. Logic Chain

1. **Premise**: Schema synchronization with remote Turso DB must preserve all existing tables and data (15 boards, 7 comments, 6 notifications, 8 users).
   - *Observation*: Live database has `notifications` and `comments.is_anonymous`. In `src/lib/schema.ts`, both were missing.
   - *Inference*: Running `drizzle-kit push` without `notifications` would cause Drizzle to detect `notifications` as a dropped table and drop or refuse to migrate it. Adding `notifications` and `comments.isAnonymous` into `schema.ts` ensures parity and prevents destructive drops.
   - *Conclusion*: `notifications` and `comments.isAnonymous` must be added to `schema.ts` before running push.

2. **Premise**: Adding `version` to `boards` is required for optimistic locking (Requirement R3, Feature 21).
   - *Observation*: SQLite supports `ALTER TABLE boards ADD COLUMN version integer NOT NULL DEFAULT 1;`.
   - *Inference*: When Drizzle Kit runs with `dialect: 'turso'`, it generates `ALTER TABLE boards ADD version integer DEFAULT 1 NOT NULL;`. Existing rows immediately receive default value `1`.
   - *Conclusion*: Defining `version: integer('version').default(1).notNull()` in `boards` executes smoothly and non-destructively.

3. **Premise**: Case lineage and board forking requires `parentId` self-reference (Requirement R4, Feature 29).
   - *Observation*: In TypeScript, directly referencing `boards.id` inside the `boards` initializer produces TS7022 ("implicitly has type any").
   - *Inference*: Using `parentId: text('parentId').references((): any => boards.id, { onDelete: 'set null' })` breaks the circular type inference loop and allows Drizzle to generate the foreign key.
   - *Conclusion*: Use explicit return type `(): any => boards.id` with `onDelete: 'set null'`.

4. **Premise**: Collaborator uniqueness must be enforced at the database level to prevent duplicate records (Requirement R1, Feature 4).
   - *Observation*: `board_collaborators` has 0 rows and lacks a composite unique constraint on `(board_id, user_id)`.
   - *Inference*: Adding `uniqueIndex('board_collaborators_board_user_idx').on(table.boardId, table.userId)` generates `CREATE UNIQUE INDEX board_collaborators_board_user_idx ON board_collaborators (board_id, user_id);`.
   - *Conclusion*: Add the composite unique index to `boardCollaborators`.

5. **Premise**: Drizzle relational queries (`db.query`) require explicit, unambiguous relation definitions.
   - *Observation*: `notifications` has two foreign keys referencing `users.id` (`recipientId` and `actorId`).
   - *Inference*: In Drizzle ORM, multiple relations between the same pair of tables require explicit `relationName` parameters. Without `relationName`, Drizzle throws an ambiguous relation error. Similarly, self-referencing `boards` (`parent` and `forks`) requires `relationName: 'board_forks'`.
   - *Conclusion*: Define `relationName: 'user_notifications_received'` and `'user_notifications_sent'` for notifications, and `'board_forks'` for boards lineage.

---

## 3. Caveats

- **Network Access & Auth Token**: Running `drizzle-kit push` requires an active internet connection to Turso cloud and valid credentials in `.env.local`. If credentials are invalid, Drizzle Kit exits with an authentication error.
- **Dialect Requirement**: Drizzle configuration MUST retain `dialect: 'turso'`. Running with `dialect: 'sqlite'` triggers table rebuild scripts (`__new_boards`) that can hit column mismatch issues.
- **Pre-existing Data Integrity**: The 15 existing boards in the database currently have `parentId: null` or valid IDs. All 15 existing rows will safely default to `version = 1`.

---

## 4. Conclusion & Concrete Specifications

### 4.1 Artifacts Prepared
Two ready-to-use artifacts have been generated in this directory:
1. `/Users/hardikrawat/Documents/the-case-file/.agents/teamwork_preview_explorer_m1_2/proposed_schema.ts` — Fully validated, production-ready schema.
2. `/Users/hardikrawat/Documents/the-case-file/.agents/teamwork_preview_explorer_m1_2/schema.patch` — Unified diff patch applicable via `patch` or `git apply`.

### 4.2 Exact Schema Code Changes in `src/lib/schema.ts`

#### A. Imports (Line 1)
```typescript
// BEFORE:
import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';

// AFTER:
import { sqliteTable, text, integer, primaryKey, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
```

#### B. `accounts` Table Indexes
```typescript
export const accounts = sqliteTable('accounts', {
    userId: text('userId')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('providerAccountId').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
}, (account) => ({
    compoundKey: primaryKey({ columns: [account.provider, account.providerAccountId] }),
    userIdIdx: index('accounts_userId_idx').on(account.userId),
}));
```

#### C. `sessions` Table Index
```typescript
export const sessions = sqliteTable('sessions', {
    sessionToken: text('sessionToken').primaryKey(),
    userId: text('userId')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    expires: integer('expires', { mode: 'timestamp_ms' }).notNull(),
}, (session) => ({
    userIdIdx: index('sessions_userId_idx').on(session.userId),
}));
```

#### D. `boards` Table Modifications (version, parentId FK, indexes)
```typescript
export const boards = sqliteTable('boards', {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    userId: text('userId')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    parentId: text('parentId').references((): any => boards.id, { onDelete: 'set null' }),
    isPublic: integer('is_public', { mode: 'boolean' }).default(false),
    content: text('content', { mode: 'json' }).$type<Record<string, unknown>>().default({}),
    thumbnail: text('thumbnail'),
    stars: integer('stars').default(0),
    views: integer('views').default(0),
    version: integer('version').default(1).notNull(),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (board) => ({
    userIdIdx: index('boards_userId_idx').on(board.userId),
    updatedAtIdx: index('boards_updated_at_idx').on(board.updatedAt),
    publicDeletedIdx: index('boards_is_public_deleted_at_idx').on(board.isPublic, board.deletedAt),
    parentIdIdx: index('boards_parent_id_idx').on(board.parentId),
}));
```

#### E. `contributions` Table Indexes
```typescript
export const contributions = sqliteTable('contributions', {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    boardId: text('boardId')
        .notNull()
        .references(() => boards.id, { onDelete: 'cascade' }),
    userId: text('userId')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    snapshot: text('snapshot', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
    message: text('message'),
    status: text('status', { enum: ['open', 'merged', 'rejected'] }).default('open'),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (contribution) => ({
    boardIdIdx: index('contributions_boardId_idx').on(contribution.boardId),
    userIdIdx: index('contributions_userId_idx').on(contribution.userId),
}));
```

#### F. Token Tables Indexes
```typescript
export const passwordResetTokens = sqliteTable('password_reset_tokens', {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    userId: text('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),
    expires: integer('expires', { mode: 'timestamp' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (prt) => ({
    userIdIdx: index('password_reset_tokens_user_id_idx').on(prt.userId),
}));

export const emailVerificationTokens = sqliteTable('email_verification_tokens', {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    userId: text('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),
    expires: integer('expires', { mode: 'timestamp' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (evt) => ({
    userIdIdx: index('email_verification_tokens_user_id_idx').on(evt.userId),
}));
```

#### G. `comments` Table Modifications (isAnonymous & indexes)
```typescript
export const comments = sqliteTable('comments', {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    boardId: text('board_id')
        .notNull()
        .references(() => boards.id, { onDelete: 'cascade' }),
    nodeId: text('node_id'),
    userId: text('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    parentId: text('parent_id'),
    isAnonymous: integer('is_anonymous', { mode: 'boolean' }).default(false),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (comment) => ({
    boardIdIdx: index('comments_board_id_idx').on(comment.boardId),
    nodeIdIdx: index('comments_node_id_idx').on(comment.nodeId),
    userIdIdx: index('comments_user_id_idx').on(comment.userId),
}));
```

#### H. `boardVersions` Table Index
```typescript
export const boardVersions = sqliteTable('board_versions', {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    boardId: text('board_id')
        .notNull()
        .references(() => boards.id, { onDelete: 'cascade' }),
    content: text('content', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
    createdBy: text('created_by')
        .notNull()
        .references(() => users.id),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (bv) => ({
    boardIdIdx: index('board_versions_board_id_idx').on(bv.boardId),
}));
```

#### I. `boardCollaborators` Table Unique Index
```typescript
export const boardCollaborators = sqliteTable('board_collaborators', {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    boardId: text('board_id')
        .notNull()
        .references(() => boards.id, { onDelete: 'cascade' }),
    userId: text('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['owner', 'editor', 'viewer'] }).notNull(),
    addedAt: integer('added_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
    boardUserIdx: uniqueIndex('board_collaborators_board_user_idx').on(table.boardId, table.userId),
}));
```

#### J. `userReputation` Table Index
```typescript
export const userReputation = sqliteTable('user_reputation', {
    userId: text('user_id')
        .primaryKey()
        .references(() => users.id, { onDelete: 'cascade' }),
    points: integer('points').default(0),
    boardsCreated: integer('boards_created').default(0),
    contributionsAccepted: integer('contributions_accepted').default(0),
    lastUpdated: integer('last_updated', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (ur) => ({
    pointsIdx: index('user_reputation_points_idx').on(ur.points),
}));
```

#### K. `notifications` Table (New Table & Index)
```typescript
export const notifications = sqliteTable('notifications', {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    recipientId: text('recipient_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    actorId: text('actor_id')
        .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    referenceId: text('reference_id').notNull(),
    referenceType: text('reference_type').notNull(),
    message: text('message').notNull(),
    isRead: integer('is_read', { mode: 'boolean' }).default(false),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
}, (notification) => ({
    recipientIsReadIdx: index('notifications_recipient_id_is_read_idx').on(notification.recipientId, notification.isRead),
}));
```

#### L. `rateLimits` Table Index
```typescript
export const rateLimits = sqliteTable('rate_limits', {
    key: text('key').primaryKey(),
    count: integer('count').default(0),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
}, (rl) => ({
    expiresAtIdx: index('rate_limits_expires_at_idx').on(rl.expiresAt),
}));
```

#### M. Relations Definitions
```typescript
export const usersRelations = relations(users, ({ one, many }) => ({
    accounts: many(accounts),
    sessions: many(sessions),
    boards: many(boards),
    contributions: many(contributions),
    comments: many(comments),
    boardVersions: many(boardVersions),
    collaborators: many(boardCollaborators),
    reputation: one(userReputation),
    receivedNotifications: many(notifications, { relationName: 'user_notifications_received' }),
    triggeredNotifications: many(notifications, { relationName: 'user_notifications_sent' }),
}));

export const boardsRelations = relations(boards, ({ one, many }) => ({
    author: one(users, {
        fields: [boards.userId],
        references: [users.id],
    }),
    parent: one(boards, {
        fields: [boards.parentId],
        references: [boards.id],
        relationName: 'board_forks',
    }),
    forks: many(boards, {
        relationName: 'board_forks',
    }),
    contributions: many(contributions),
    comments: many(comments),
    versions: many(boardVersions),
    collaborators: many(boardCollaborators),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
    recipient: one(users, {
        fields: [notifications.recipientId],
        references: [users.id],
        relationName: 'user_notifications_received',
    }),
    actor: one(users, {
        fields: [notifications.actorId],
        references: [users.id],
        relationName: 'user_notifications_sent',
    }),
}));
```

---

### 4.3 Step-by-Step Non-Destructive `drizzle-kit push` Execution Procedure

To execute the database synchronization safely without dropping tables or losing data:

1. **Step 1: Ensure `.env.local` is present**  
   Confirm `.env.local` contains:
   ```env
   TURSO_DATABASE_URL=libsql://the-case-file-hardikrawat.aws-ap-south-1.turso.io
   TURSO_AUTH_TOKEN=eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9...
   ```
2. **Step 2: Apply Schema Changes to `src/lib/schema.ts`**  
   Copy `/Users/hardikrawat/Documents/the-case-file/.agents/teamwork_preview_explorer_m1_2/proposed_schema.ts` over `src/lib/schema.ts` (or apply `schema.patch`).
3. **Step 3: Validate with Dry-Run Export**  
   Execute:
   ```bash
   npx drizzle-kit export --sql --schema=./src/lib/schema.ts --dialect=turso
   ```
   Verify that all tables and indexes are generated with 0 syntax or type errors.
4. **Step 4: Execute Safe Push**  
   Execute:
   ```bash
   npx drizzle-kit push --config=drizzle.config.ts --verbose
   ```
   *Safety Rule*: Do NOT pass `--force`.
   Drizzle Kit will output the statements to be executed (`ALTER TABLE boards ADD version...` and `CREATE INDEX...`).
   Verify there are NO `DROP TABLE` statements in the prompt.
   Confirm with `[y]` if prompted, or observe `[✓] Changes applied`.
5. **Step 5: Verify Post-Push Remote Schema & Row Counts**  
   Run a verification query against the cloud database to confirm:
   - 21 indexes exist in `sqlite_master`.
   - `boards` has 15 rows with `version = 1`.
   - `notifications` retains all 6 existing rows.
   - `comments` retains all 7 existing rows.

---

## 5. Verification Method

### 5.1 Pre-Push Verification Commands
```bash
# Verify schema export matches expected SQL
npx drizzle-kit export --sql --schema=./src/lib/schema.ts --dialect=turso

# Verify type correctness
npx tsc --noEmit --skipLibCheck ./src/lib/schema.ts
```

### 5.2 Post-Push Verification Command
Run against the live Turso DB:
```bash
node -e '
const { createClient } = require("@libsql/client");
const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});
async function verify() {
  const tables = await client.execute("SELECT name FROM sqlite_master WHERE type=\"table\" AND name NOT LIKE \"sqlite_%\";");
  console.log("Total Tables:", tables.rows.length, "(Expected: 13)");
  
  const indexes = await client.execute("SELECT name FROM sqlite_master WHERE type=\"index\" AND sql IS NOT NULL;");
  console.log("Total Indexes:", indexes.rows.length, "(Expected: 21)");
  
  const boards = await client.execute("SELECT COUNT(*) as count, MIN(version) as minVer, MAX(version) as maxVer FROM boards;");
  console.log("Boards:", boards.rows[0]);
  
  const notifs = await client.execute("SELECT COUNT(*) as count FROM notifications;");
  console.log("Notifications:", notifs.rows[0]);
}
verify().catch(console.error);
'
```

### 5.3 Invalidation Conditions
- If `npx drizzle-kit push` produces any `DROP TABLE` statement, execution must abort immediately.
- If the count of rows in `notifications` drops below 6, or `boards` drops below 15, verification fails.
- If `board_collaborators_board_user_idx` does not exist as a UNIQUE index, verification fails.
- If `boards.version` is missing or contains null values, verification fails.
- If TypeScript reports any circular type reference on `boards.parentId`, verification fails.
