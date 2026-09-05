# E2E Exploration Report: Tier 1 Feature Coverage & Tier 2 Boundary/Corner Cases

**Track**: E2E Testing Track (M-E2E)  
**Agent**: Explorer 2 (`e2e_explorer_2`)  
**Parent**: `sub_orch_e2e` (`6bd03dee-8755-41ec-b6a0-6e521bb5b5b5`)  
**Date**: 2026-09-04  
**Project**: The Case File Remediation & Hardening  

---

## Executive Summary

This report delivers a comprehensive code inspection and opaque-box test specification for **Tier 1 (Feature Coverage)** and **Tier 2 (Boundary & Corner Cases)** of 'The Case File'. The analysis confirms the existence of critical architectural vulnerabilities and implementation gaps across all core application areas:
1. **Security & Auth**: Active test bypass backdoors (`x-test-bypass`) in `src/auth.ts`, `src/auth.config.ts`, and `src/app/(authenticated)/board/[id]/page.tsx`; token leakage in `POST /api/auth/signup` and `POST /api/auth/forgot-password`; full `passwordHash` exposure in `GET /api/me` and `PUT /api/profile/[id]`; SSRF vulnerability in `GET /api/preview`; unprotected route paths (`/board/*`, `/profile/*`, `/leaderboard`) in middleware.
2. **Persistence & Schema**: Fallback to `:memory:` in `src/lib/db.ts`; lack of soft-delete checking (`deletedAt`) across board route handlers; missing `DELETE /api/boards/[id]`.
3. **Canvas & State**: Missing `LinkNode.tsx` component and registration in `Board.tsx`/`Toolbar.tsx`; absence of node deletion controls and edge cutting synchronization in `StringEdge.tsx`; global localStorage state leakage across boards in `src/store/useStore.ts`.
4. **Panels & Overlays**: All four core panels (`CommentsPanel`, `CollaboratorsPanel`, `VersionHistory`, `ExportModal`) are completely unmounted and orphaned from `Board.tsx`; missing `DELETE` and `PATCH` endpoints in `/api/boards/[id]/collaborators`; missing user join and permission checks in `/api/comments`; missing user join in `/api/leaderboard`; reputation points not awarded on board creation, comments, or contribution merges.

Based on these findings, this report defines **38 Tier 1 Feature Coverage Test Specifications** and **26 Tier 2 Boundary & Corner Case Test Specifications** designed to test the system in an opaque-box manner without relying on any test backdoors.

---

## Part 1: Codebase Exploration & Architectural Findings

### 1. Database Persistence Layer (`src/lib/db.ts`, `src/lib/schema.ts`)
- **Current State (`src/lib/db.ts`)**:
  - Line 5: `const url = process.env.TURSO_DATABASE_URL || ':memory:';`
  - Silent fallback to in-memory SQLite masks absent or invalid credentials, violating Project Requirement R1.
  - Contract requirement: Must fail-fast and throw a fatal error on import if `TURSO_DATABASE_URL` is undefined, empty, or if remote `libsql://` lacks `TURSO_AUTH_TOKEN`.
- **Current Schema (`src/lib/schema.ts`)**:
  - Tables present: `users`, `accounts`, `sessions`, `verificationTokens`, `boards`, `contributions`, `passwordResetTokens`, `emailVerificationTokens`, `comments`, `boardVersions`, `boardCollaborators`, `userReputation`, `rateLimits`.
  - Gaps:
    - `boards` table lacks soft-delete enforcement in queries: `GET /api/boards` (line 62) and `GET /api/boards/[id]` (line 69) do not check `isNull(boards.deletedAt)`.
    - No `DELETE /api/boards/[id]` route exists for setting `deletedAt = new Date()`.
    - Missing `comments.isAnonymous`, `boards.version` (for optimistic locking), and relational indexes on FKs/reputation points.

### 2. Authentication, Authorization & Information Leakage
- **Test Auth Backdoor (`x-test-bypass`)**:
  - `src/auth.ts` lines 116–126: Checks `headerList.get('x-test-bypass') === 'true'` and returns a fake session (`test-user-123`, `test@example.com`).
  - `src/auth.config.ts` lines 11–13: Bypasses route guards if `headers.get('x-test-bypass') === 'true'`.
  - `src/app/(authenticated)/board/[id]/page.tsx` lines 23 & 37–47: Synthesizes a mock board object out of thin air when `x-test-bypass` is present.
- **Sensitive Token Leakage**:
  - `src/app/api/auth/signup/route.ts` lines 73–79: Returns `verificationToken` directly in response body `{ success: true, userId, verificationToken }`.
  - `src/app/api/auth/forgot-password/route.ts` lines 41–46: Returns `resetToken: token` in response body.
- **Password Hash Exposure**:
  - `src/app/api/me/route.ts` lines 30–35: Returns `{ ...user, reputationPoints, ... }` without stripping `passwordHash`.
  - `src/app/api/profile/[id]/route.ts` line 117: In `PUT`, returns `updated[0]` directly from `db.update(users).returning()`, returning the updated user record including `passwordHash`.
  - `src/app/api/profile/[id]/route.ts` line 48: In public `GET`, returns `email: user.email` to unauthenticated callers.
- **Route Protection Gaps**:
  - `src/auth.config.ts` line 16 defines `protectedPaths = ['/cases', '/discover', '/settings', '/starred']`.
  - Routes `/board/*`, `/profile/*`, `/leaderboard` are NOT protected in middleware, allowing unauthenticated requests to reach backend handlers.

### 3. Preview Endpoint SSRF Vulnerability (`src/app/api/preview/route.ts`)
- Line 13: Only checks `if (!url.startsWith('http'))`.
- Lines 17–22: Directly executes `fetch(url)` using server context.
- Vulnerabilities:
  - Internal network SSRF: `http://127.0.0.1`, `http://localhost`, `http://0.0.0.0`, `http://[::1]`.
  - Cloud Instance Metadata Service (IMDS): `http://169.254.169.254/latest/meta-data/`.
  - Private subnet access: RFC 1918 addresses (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`).
  - Alternative scheme bypass: `http://127.0.0.1:22` (port scanning), non-HTTP protocols (`file:`, `ftp:`, `data:`).
  - Malformed URL crashes: Unhandled exceptions on invalid URI structures.

### 4. Canvas Evidence Board & Node Types
- **Node Components (`src/components/nodes/`)**:
  - Existing: `StickyNoteNode.tsx`, `TextNode.tsx`, `ImageNode.tsx`, `ArticleNode.tsx`.
  - Missing: `LinkNode.tsx` does NOT exist.
- **Board & Toolbar Registration**:
  - `src/components/Board.tsx` lines 34–39:
    ```ts
    const nodeTypes = {
        sticky: StickyNoteNode,
        image: ImageNode,
        text: TextNode,
        article: ArticleNode,
    };
    ```
    `link` is completely omitted.
  - `src/components/ui/Toolbar.tsx`: Defines `addSticky`, `addText`, `addImage`, `addArticle`, but no `addLink`.
- **Node Deletion & Edge Cleanup**:
  - No delete button exists within any node component UI. Users can only clear the whole board via toolbar trash button.
  - `StringEdge.tsx` lines 27–29: Edge cut handler calls `setEdges((edges) => edges.filter(...))` directly from `useReactFlow()`, bypassing the Zustand store `deleteEdge` method.

### 5. Board State Isolation & Store Contamination (`src/store/useStore.ts`)
- Lines 134–147: `useStore` uses `persist` middleware with a single static localStorage key `case-file-storage`.
- Nodes, edges, boardTitle, and metadata are saved globally.
- Bug: When navigating from Board A to Board B, the store rehydrates Board A's nodes and edges into Board B if not explicitly cleared or isolated by `boardId`.
- Line 64 of `Board.tsx` references `connectMode`, but `connectMode` is omitted from `RFState` in `useStore.ts`.

### 6. Orphaned Panels & Overlay Wiring
- **Panels implemented but unmounted**:
  - `CommentsPanel.tsx`: Floating button and expandable panel for board/node comments. Never imported or rendered in `Board.tsx`.
  - `CollaboratorsPanel.tsx`: Panel for listing, adding, and removing collaborators. Never imported or rendered in `Board.tsx`.
  - `VersionHistory.tsx`: Drawer for listing snapshots and restoring past states. Never imported or rendered in `Board.tsx`.
  - `ExportModal.tsx`: Modal for exporting to JSON, PNG, or PDF via `src/lib/export.ts`. Never imported or rendered in `Board.tsx`.
- **Collaborator API Mismatch**:
  - `CollaboratorsPanel.tsx` line 70 sends `DELETE /api/boards/${boardId}/collaborators/${collaboratorId}`, but the backend route is `src/app/api/boards/[id]/collaborators/route.ts` which expects query parameters (`?collaboratorId=...`) and currently has NO `DELETE` or `PATCH` handler implemented.
  - `CollaboratorsPanel.tsx` line 50 sends `POST` with `{ userEmail, role }`, but `src/app/api/boards/[id]/collaborators/route.ts` lines 9–12 only accepts `{ userId, role }` and lacks user lookup by email.

### 7. Reputation Engine & Leaderboard
- **Reputation Action Coverage (`src/lib/reputation.ts`)**:
  - Type `ReputationAction` only defines `'board_created' | 'board_made_public' | 'board_shared' | 'comment_posted' | 'profile_completed'`.
  - Missing: `'contribution_accepted'` (contract specifies 25 points).
- **Gamification Wiring Missing**:
  - `POST /api/boards` creates a board but does NOT call `awardPoints(userId, 'board_created')`.
  - `POST /api/comments` creates a comment but does NOT call `awardPoints(userId, 'comment_posted')`.
  - `POST /api/contributions/[id]/merge` merges a contribution but does NOT call `awardPoints(contributorId, 'contribution_accepted')`.
- **Leaderboard Joins (`src/app/api/leaderboard/route.ts`)**:
  - Lines 12–16: Queries `userReputation` directly with NO join on `users` table. Returns anonymous `userId`s without detective names or avatars.
- **Rank Titles**:
  - Contract thresholds: 1000+ ("Chief Detective"), 500+ ("Senior Investigator"), 200+ ("Private Eye"), 50+ ("Rookie Cop"), <50 ("Patrol Officer").

---

## Part 2: Tier 1 Feature Coverage Test Design

All Tier 1 tests are opaque-box specifications executable via **Vitest** (API / Integration) and **Playwright** (Canvas / UI). They require valid credentials or authenticated session fixtures without `x-test-bypass`.

### Suite 1.1: Security & Auth Hardening (Tests T1-SEC-01 to T1-SEC-08)

#### T1-SEC-01: Signup Zero Token Leakage
- **Target**: `POST /api/auth/signup`
- **Preconditions**: User with email does not exist.
- **Input**:
  ```json
  {
    "name": "Detective Miller",
    "email": "miller@precinct.org",
    "password": "SecurePassword123!"
  }
  ```
- **Assertions**:
  - HTTP Status: `201 Created`
  - Body contains: `success: true`, `userId: string`
  - Body strictly DOES NOT contain: `verificationToken`, `token`, `passwordHash`, `password`
  - Database verification: Record exists in `emailVerificationTokens` table with valid hash and expiration; `users.emailVerifiedFlag === false`.

#### T1-SEC-02: Forgot Password Zero Token Leakage
- **Target**: `POST /api/auth/forgot-password`
- **Preconditions**: User `miller@precinct.org` registered.
- **Input**:
  ```json
  { "email": "miller@precinct.org" }
  ```
- **Assertions**:
  - HTTP Status: `200 OK`
  - Body contains: `{ success: true, message: string }`
  - Body strictly DOES NOT contain: `resetToken`, `token`, `id`
  - Database verification: Record created in `passwordResetTokens` for user ID.

#### T1-SEC-03: User Profile Strips `passwordHash` in `/api/me`
- **Target**: `GET /api/me`
- **Preconditions**: Authenticated session as Detective Miller.
- **Assertions**:
  - HTTP Status: `200 OK`
  - Body contains: `id`, `name`, `email`, `reputationPoints`, `boardsCreated`
  - Assertion: `expect(body).not.toHaveProperty('passwordHash')`
  - Assertion: `expect(JSON.stringify(body)).not.toContain('passwordHash')`

#### T1-SEC-04: User Profile Strips `passwordHash` in `PUT /api/profile/[id]`
- **Target**: `PUT /api/profile/:id`
- **Preconditions**: Authenticated session as user `:id`.
- **Input**:
  ```json
  { "name": "Chief Miller", "bio": "Lead investigator on cold cases" }
  ```
- **Assertions**:
  - HTTP Status: `200 OK`
  - Response body contains updated `name` and `bio`
  - Response body strictly DOES NOT contain `passwordHash`.

#### T1-SEC-05: Public Profile Privacy Protection
- **Target**: `GET /api/profile/:id`
- **Preconditions**: Unauthenticated caller requesting user `:id` public profile.
- **Assertions**:
  - HTTP Status: `200 OK`
  - Body contains: `id`, `name`, `bio`, `avatarUrl`, `boardsCount`, `reputation`
  - Assertion: `expect(body.email).toBeUndefined()` (email must not leak publicly).

#### T1-SEC-06: Elimination of All Test Bypasses (`x-test-bypass`)
- **Target**: `GET /api/me`, `GET /board/:boardId`, `GET /api/boards`
- **Preconditions**: No active session cookie; send request with header `x-test-bypass: true`.
- **Assertions**:
  - `GET /api/me` with `x-test-bypass: true` -> `401 Unauthorized`
  - Navigation to `/board/:id` with `x-test-bypass: true` -> Redirect to `/login` (or 401)
  - No synthetic boards or fake user identities (`test-user-123`) generated.

#### T1-SEC-07: Route Middleware Protection
- **Target**: Route requests without session cookie:
  1. `GET /cases`
  2. `GET /discover`
  3. `GET /board/b123`
  4. `GET /profile/u123`
  5. `GET /leaderboard`
  6. `GET /settings`
- **Assertions**:
  - All requests must be intercepted and redirected to `/login?callbackUrl=...` (HTTP 307/308 redirect or 401).
  - Unauthenticated access to protected pages is strictly denied.

#### T1-SEC-08: Forbidden Access on Unowned Private Boards
- **Target**: `GET /api/boards/:id`
- **Preconditions**: Board `:id` created by User A with `isPublic: false`. Request made by authenticated User B (not a collaborator).
- **Assertions**:
  - HTTP Status: `403 Forbidden` (or `404 Not Found`).
  - Response does not leak board contents or metadata.

---

### Suite 1.2: Turso DB Cloud Persistence & Schema Integrity (Tests T1-DB-01 to T1-DB-05)

#### T1-DB-01: Fail-Fast Client Connection
- **Target**: `src/lib/db.ts`
- **Condition A (Missing URL)**: Set `process.env.TURSO_DATABASE_URL = ''`. Importing `db` throws `Fatal: TURSO_DATABASE_URL is required`. Zero fallback to `:memory:`.
- **Condition B (Cloud URL without Token)**: Set `process.env.TURSO_DATABASE_URL = 'libsql://the-case-file-hardikrawat.aws-ap-south-1.turso.io'` with empty `TURSO_AUTH_TOKEN`. Importing `db` throws fatal error requiring auth token.
- **Condition C (Valid Credentials)**: Database client connects to cloud endpoint and executes `SELECT 1`.

#### T1-DB-02: Cloud Table Schema & Constraint Verification
- **Target**: Remote Turso DB schema
- **Assertions**:
  - Tables verified to exist: `users`, `accounts`, `sessions`, `verificationToken`, `boards`, `contributions`, `password_reset_tokens`, `email_verification_tokens`, `comments`, `board_versions`, `board_collaborators`, `user_reputation`, `rate_limits`.
  - Foreign key constraints active (`boards.userId -> users.id CASCADE`, `comments.boardId -> boards.id CASCADE`).
  - Unique constraints active (`users.email`, `board_collaborators (board_id, user_id)` compound unique index).

#### T1-DB-03: Soft-Delete Support in `DELETE /api/boards/[id]`
- **Target**: `DELETE /api/boards/:id`
- **Preconditions**: Authenticated user owns board `:id`.
- **Assertions**:
  - HTTP Status: `200 OK` or `204 No Content`.
  - Database verification: Board record remains in database, with `deletedAt !== null` (`deletedAt <= new Date()`).

#### T1-DB-04: Soft-Deleted Boards Excluded from User List Queries
- **Target**: `GET /api/boards`
- **Preconditions**: User owns 2 active boards and 1 soft-deleted board (`deletedAt` is set).
- **Assertions**:
  - Response array contains exactly the 2 active boards.
  - Soft-deleted board is filtered out from the response list.

#### T1-DB-05: Soft-Deleted Boards Inaccessible Directly
- **Target**: `GET /api/boards/:deletedId`
- **Preconditions**: Board `:deletedId` has `deletedAt !== null`.
- **Assertions**:
  - HTTP Status: `404 Not Found` (treated as deleted).
  - Calling `PUT /api/boards/:deletedId` returns `404 Not Found`.

---

### Suite 1.3: Canvas Evidence Board & 5 Node Types (Tests T1-CANVAS-01 to T1-CANVAS-07)

#### T1-CANVAS-01: Sticky Note Evidence Node Creation & Editing
- **Target**: Board Canvas UI (`/board/:id`)
- **Action**:
  1. Click "Sticky" button on Toolbar.
  2. A sticky note node (`type: sticky`) appears on canvas with pinned rotation, yellow background, and thumb-tack.
  3. Type clue text: "Suspect seen leaving warehouse at 22:45".
- **Assertions**:
  - ReactFlow node created with ID `sticky-...`.
  - Node contains textarea with inputted value.
  - Inspecting node store confirms `node.data.label === "Suspect seen leaving warehouse at 22:45"`.

#### T1-CANVAS-02: Text Evidence Node Creation & Auto-Resize
- **Target**: Board Canvas UI
- **Action**:
  1. Click "Text" button on Toolbar.
  2. Node (`type: text`) appears with label placeholder.
  3. Type multiline header: "PRIME SUSPECTS\nPERSON OF INTEREST".
- **Assertions**:
  - Text node renders with bold styling.
  - Textarea height dynamically adapts to content.

#### T1-CANVAS-03: Image Evidence Node & Exhibit Framing
- **Target**: Board Canvas UI
- **Action**:
  1. Click "Image" button on Toolbar.
  2. Polaroid frame appears with "EXHIBIT A" badge and upload dropzone.
  3. Upload sample image or set `data.src` to a valid image URL; enter caption: "Footprint at scene".
- **Assertions**:
  - Node renders `next/image` with polaroid depth shadow.
  - Caption input binds to `node.data.caption`.

#### T1-CANVAS-04: Article Evidence Node & Automated Preview Fetch
- **Target**: Board Canvas UI
- **Action**:
  1. Click "Article" button on Toolbar.
  2. Newspaper-clipping framed node appears.
  3. Enter URL: `https://en.wikipedia.org/wiki/Forensic_science`.
- **Assertions**:
  - Client triggers `GET /api/preview?url=...`.
  - Title and description hydrate into newspaper masthead style.
  - "Read Full Story" link opens target URL in new tab.

#### T1-CANVAS-05: Link Evidence Node Creation & Detective Styling (Feature 17)
- **Target**: Board Canvas UI & Toolbar
- **Action**:
  1. Click "Link" button on Toolbar.
  2. Link node (`type: link`) mounts on canvas with detective badge / magnifying glass styling.
  3. Enter URL and title.
- **Assertions**:
  - Node type `link` registered in `nodeTypes` in `Board.tsx`.
  - Node renders clickable external hyperlink icon and detective metadata.

#### T1-CANVAS-06: Individual Node Deletion & Dangling Edge Purging (Feature 18)
- **Target**: Board Canvas UI
- **Action**:
  1. Create Node A and Node B.
  2. Draw yarn connection edge between Node A and Node B.
  3. Select Node A and click its node delete action (or press Delete key with node selected).
- **Assertions**:
  - Node A is removed from ReactFlow state.
  - Connecting edge between Node A and Node B is automatically removed.
  - Node B remains unaffected on canvas.

#### T1-CANVAS-07: Red Yarn String Cutting Synchronization (Feature 19)
- **Target**: Board Canvas UI (`StringEdge.tsx`)
- **Action**:
  1. Create two nodes connected by `StringEdge`.
  2. Click edge to select it; red scissors/X cut button appears at midpoint sag.
  3. Click the cut button.
- **Assertions**:
  - Edge is removed from ReactFlow canvas.
  - Zustand store `useStore.getState().edges` no longer contains the edge ID.
  - Changes persist upon board auto-save.

---

### Suite 1.4: Board State Isolation (Tests T1-STORE-01 to T1-STORE-02)

#### T1-STORE-01: Cross-Board LocalStorage Purging (Feature 20)
- **Target**: Zustand Store & LocalStorage
- **Action**:
  1. User opens Board 1 (`id: board-alpha`), adds 3 sticky notes and 2 edges, and saves.
  2. User navigates back to `/cases` and opens Board 2 (`id: board-beta`), which has 0 nodes.
- **Assertions**:
  - Board 2 loads with 0 nodes and 0 edges.
  - Board 1's nodes are NOT displayed on Board 2.
  - `localStorage` does NOT mix nodes from different boards under a generic unpartitioned key.

#### T1-STORE-02: Optimistic Locking & Auto-Save Versioning (Feature 21)
- **Target**: `PUT /api/boards/[id]`
- **Action**:
  1. Client fetches board with `version: 3`.
  2. Client submits update with `{ version: 3, content: { nodes: [...], edges: [...] } }`.
  3. Simulated concurrent client updates board to `version: 4`.
  4. Original client attempts another update with stale `version: 3`.
- **Assertions**:
  - First update succeeds, incrementing version to 4.
  - Stale update receives `409 Conflict` ("Board has been modified by another session").

---

### Suite 1.5: Comments System & Panel (Tests T1-COMM-01 to T1-COMM-04)

#### T1-COMM-01: `GET /api/comments` Joins User Details & Checks Permissions
- **Target**: `GET /api/comments?boardId=:id`
- **Preconditions**: User has `canView` permission on board `:id`.
- **Assertions**:
  - HTTP Status: `200 OK`.
  - Each comment object returns `{ id, boardId, nodeId, userId, content, parentId, createdAt, userName, userImage }`.
  - User details (`userName`, `userImage`) are joined, not null.
  - If unauthenticated user requests comments for private board -> `401/403`.

#### T1-COMM-02: `POST /api/comments` Awards Reputation Points
- **Target**: `POST /api/comments`
- **Input**:
  ```json
  {
    "boardId": "board-123",
    "content": "Check the tire marks on Exhibit B."
  }
  ```
- **Assertions**:
  - HTTP Status: `201 Created`.
  - Comment persisted to database.
  - Author's `userReputation.points` increases by 2 (`comment_posted`).

#### T1-COMM-03: Node-Specific Threaded Comments
- **Target**: `GET /api/comments?boardId=:id&nodeId=:nodeId`
- **Assertions**:
  - Returns only comments associated with the specified `nodeId`.
  - Nested replies correctly link via `parentId`.

#### T1-COMM-04: CommentsPanel Mounting & UI Interaction (Feature 22)
- **Target**: Board UI (`CommentsPanel.tsx`)
- **Action**:
  1. Verify Comments toggle button is visible on `Board.tsx` (bottom-right).
  2. Click "💬 Comments" button; panel expands with comment feed.
  3. Type comment and submit; comment immediately displays in feed with user avatar.
- **Assertions**:
  - Comments panel is mounted and interactive.
  - New comment displays without full page reload.

---

### Suite 1.6: Collaborator Management & Panel (Tests T1-COL-01 to T1-COL-05)

#### T1-COL-01: Collaborators Panel Mounting (Feature 23)
- **Target**: Board UI (`CollaboratorsPanel.tsx`)
- **Assertions**:
  - "Team" / Collaborators button is visible on `Board.tsx`.
  - Clicking button opens slide-over panel displaying current collaborators with roles (Owner, Editor, Viewer).

#### T1-COL-02: Add Collaborator via Email Lookup
- **Target**: `POST /api/boards/:id/collaborators`
- **Preconditions**: Requesting user is board owner.
- **Input**:
  ```json
  { "userEmail": "partner@precinct.org", "role": "editor" }
  ```
- **Assertions**:
  - HTTP Status: `201 Created`.
  - Backend looks up user ID by email and inserts into `boardCollaborators`.
  - Returns collaborator record with `role: "editor"`.

#### T1-COL-03: Update Collaborator Role
- **Target**: `PATCH /api/boards/:id/collaborators`
- **Preconditions**: Requesting user is board owner.
- **Input**:
  ```json
  { "collaboratorId": "collab-123", "role": "viewer" }
  ```
- **Assertions**:
  - HTTP Status: `200 OK`.
  - Role updated from `editor` to `viewer`.

#### T1-COL-04: Remove Collaborator
- **Target**: `DELETE /api/boards/:id/collaborators?collaboratorId=:collabId`
- **Preconditions**: Requesting user is board owner.
- **Assertions**:
  - HTTP Status: `200 OK`.
  - Record removed from `boardCollaborators`.
  - Removed user no longer has editor/viewer access to private board.

#### T1-COL-05: Non-Owner Cannot Modify Collaborators
- **Target**: `POST /api/boards/:id/collaborators`
- **Preconditions**: Requesting user has `editor` role (not owner).
- **Assertions**:
  - HTTP Status: `403 Forbidden` ("Only board owner can manage collaborators").

---

### Suite 1.7: Version History & Restore (Tests T1-VER-01 to T1-VER-03)

#### T1-VER-01: Version History Panel Mounting (Feature 24)
- **Target**: Board UI (`VersionHistory.tsx`)
- **Assertions**:
  - "History" button is visible on `Board.tsx`.
  - Clicking button opens version history drawer listing past timestamps and version numbers.

#### T1-VER-02: Automatic Snapshot Creation on Board Save
- **Target**: `POST /api/boards/:id/versions`
- **Action**: Saving board updates creates an entry in `boardVersions` table storing current `content` snapshot, `createdBy`, and `createdAt`.
- **Assertions**:
  - `GET /api/boards/:id/versions` returns array of chronological snapshots.

#### T1-VER-03: Version Restore Workflow
- **Target**: Version History UI
- **Action**: Click "Restore This Version" on a previous snapshot.
- **Assertions**:
  - ReactFlow canvas reloads nodes and edges from historical snapshot.
  - Toast notification confirms successful restoration.

---

### Suite 1.8: Export Capabilities (Tests T1-EXP-01 to T1-EXP-03)

#### T1-EXP-01: Export Modal Mounting (Feature 25)
- **Target**: Board UI (`ExportModal.tsx`)
- **Action**: Trigger Export action from board toolbar or header.
- **Assertions**:
  - Modal appears with 3 options: JSON, PNG Image, and PDF Document.

#### T1-EXP-02: Export Board as JSON
- **Target**: `exportToJSON` in `src/lib/export.ts`
- **Action**: Select JSON format and click "Export".
- **Assertions**:
  - Browser initiates file download `case-file-<timestamp>.json`.
  - Parsed JSON matches current `{ nodes, edges }` state.

#### T1-EXP-03: Export Board as PNG and PDF
- **Target**: `exportToPNG`, `exportToPDF` in `src/lib/export.ts`
- **Action**: Select PNG / PDF and trigger export.
- **Assertions**:
  - Generates valid binary Blob with MIME `image/png` and `application/pdf`.

---

### Suite 1.9: Reputation Engine & Leaderboard (Tests T1-REP-01 to T1-REP-04)

#### T1-REP-01: Gamification Points Allocation on Core Actions (Feature 26)
- **Target**: `src/lib/reputation.ts`
- **Actions and Expected Deltas**:
  - `board_created`: +10 points
  - `board_made_public`: +5 points
  - `board_shared`: +3 points
  - `comment_posted`: +2 points
  - `contribution_accepted`: +25 points
  - `profile_completed`: +15 points
- **Assertions**:
  - Each action increments `userReputation.points` by the exact defined amount.

#### T1-REP-02: Unified Detective Rank Title Thresholds (Feature 28)
- **Target**: Rank evaluation across `reputation.ts`, `profile/[id]/page.tsx`, `useUser.ts`
- **Thresholds**:
  - Points >= 1000 -> "Chief Detective"
  - Points >= 500  -> "Senior Investigator"
  - Points >= 200  -> "Private Eye"
  - Points >= 50   -> "Rookie Cop"
  - Points < 50    -> "Patrol Officer"
- **Assertions**:
  - All components and hooks return identical rank strings for any given point value.

#### T1-REP-03: Leaderboard Real User Details Join (Feature 27)
- **Target**: `GET /api/leaderboard?limit=10`
- **Assertions**:
  - HTTP Status: `200 OK`.
  - Response array contains objects with:
    `{ userId, points, boardsCreated, contributionsAccepted, name, image, rankTitle }`.
  - Does NOT return bare ID records without detective names.

#### T1-REP-04: Contribution Merge Awards Points
- **Target**: `POST /api/contributions/:id/merge`
- **Preconditions**: Owner merges a contribution submitted by Contributor.
- **Assertions**:
  - Contributor's reputation points increase by +25 (`contribution_accepted`).
  - `contributionsAccepted` counter increments by 1.

---

## Part 3: Tier 2 Boundary & Corner Cases Test Design

All Tier 2 tests are adversarial and edge-case boundary tests verifying that malformed, excessive, or hostile inputs are cleanly rejected with appropriate error statuses.

### Suite 2.1: SSRF Defense & Protocol Validation (Tests T2-SSRF-01 to T2-SSRF-06)

#### T2-SSRF-01: Loopback IPv4 Probing
- **Endpoint**: `GET /api/preview?url=http://127.0.0.1:80`
- **Additional Probes**: `http://127.0.0.1:22`, `http://127.0.0.2`, `http://0.0.0.0`, `http://localhost`
- **Expected Status**: `400 Bad Request`
- **Expected Body**: `{ "error": "Invalid URL" }` or `{ "error": "Restricted address" }`
- **Verification Criteria**: Server does NOT initiate connection to loopback interface.

#### T2-SSRF-02: Cloud Instance Metadata Service (IMDS) Probing
- **Endpoint**: `GET /api/preview?url=http://169.254.169.254/latest/meta-data/`
- **Additional Probes**: `http://169.254.169.254/latest/user-data/`, `http://[fd00:ec2::254]` (AWS IPv6 IMDS)
- **Expected Status**: `400 Bad Request`
- **Verification Criteria**: Immediate rejection without DNS resolution or HTTP request.

#### T2-SSRF-03: RFC 1918 Private Subnet Probing
- **Endpoints**:
  - `http://10.0.0.1/admin` (10.0.0.0/8)
  - `http://172.16.0.1/secret` (172.16.0.0/12)
  - `http://192.168.1.1/router` (192.168.0.0/16)
- **Expected Status**: `400 Bad Request`

#### T2-SSRF-04: Non-HTTP Scheme Rejection
- **Endpoints**:
  - `file:///etc/passwd`
  - `file://C:/Windows/win.ini`
  - `ftp://ftp.example.com/file.txt`
  - `javascript:alert(1)`
  - `data:text/html,<script>alert(1)</script>`
- **Expected Status**: `400 Bad Request` ("Invalid URL protocol")

#### T2-SSRF-05: Obfuscated & Alternative IP Formats
- **Endpoints**:
  - Decimal IP: `http://2130706433` (evaluates to 127.0.0.1)
  - Octal IP: `http://0177.0.0.1`
  - Hex IP: `http://0x7f.0x0.0x0.0x1`
  - IPv6 Loopback: `http://[::1]`
  - IPv6-Mapped IPv4: `http://[::ffff:127.0.0.1]`
- **Expected Status**: `400 Bad Request`

#### T2-SSRF-06: Malformed & Truncated URL Strings
- **Endpoints**:
  - `GET /api/preview?url=not-a-valid-url`
  - `GET /api/preview?url=http://`
  - `GET /api/preview?url=https://`
  - `GET /api/preview?url=http://.`
  - `GET /api/preview?url=http://[invalid-ipv6]`
- **Expected Status**: `400 Bad Request`
- **Verification Criteria**: No uncaught exceptions or 500 Internal Server Error.

---

### Suite 2.2: Input Validation & Empty/Whitespace Boundaries (Tests T2-INP-01 to T2-INP-06)

#### T2-INP-01: Empty & Whitespace-Only Board Titles
- **Endpoint**: `POST /api/boards`
- **Inputs**:
  - `{ "title": "" }`
  - `{ "title": "   " }`
  - `{ "title": "\t\n\r" }`
- **Expected Status**: `201 Created` with fallback title `'Untitled Case'` OR `400 Bad Request`.
- **Verification Criteria**: Database does not store blank whitespace titles.

#### T2-INP-02: Empty & Whitespace Comments
- **Endpoint**: `POST /api/comments`
- **Inputs**:
  - `{ "boardId": "b1", "content": "" }`
  - `{ "boardId": "b1", "content": "    " }`
- **Expected Status**: `400 Bad Request`
- **Expected Body**: `{ "error": "Invalid input", "details": [...] }`

#### T2-INP-03: Malformed Registration Fields
- **Endpoint**: `POST /api/auth/signup`
- **Inputs**:
  - Missing name: `{ "email": "test@test.com", "password": "Pass1234!" }`
  - Invalid email: `{ "name": "Bob", "email": "not-an-email", "password": "Pass1234!" }`
  - Short password (<8 chars): `{ "name": "Bob", "email": "bob@b.com", "password": "Sh1!" }`
  - Password missing numbers/symbols: `{ "name": "Bob", "email": "bob@b.com", "password": "AllLettersHere" }`
- **Expected Status**: `400 Bad Request` with detailed field errors.

#### T2-INP-04: Missing Target Board on Contribution
- **Endpoint**: `POST /api/contributions`
- **Input**:
  ```json
  { "targetBoardId": "", "snapshot": { "nodes": [], "edges": [] } }
  ```
- **Expected Status**: `400 Bad Request` ("Target board ID is required").

#### T2-INP-05: Missing Parameter on Collaborator Removal
- **Endpoint**: `DELETE /api/boards/:id/collaborators` (missing query parameters `collaboratorId` and `userId`)
- **Expected Status**: `400 Bad Request`.

#### T2-INP-06: Empty Search Query
- **Endpoint**: `GET /api/search?q=` or `GET /api/search?q=a` (<2 characters)
- **Expected Status**: `400 Bad Request` ("Query must be at least 2 characters").

---

### Suite 2.3: Rate Limiting & Rapid Action Floods (Tests T2-RATE-01 to T2-RATE-05)

#### T2-RATE-01: Signup Flood Exceeding 5 Requests / Hour
- **Endpoint**: `POST /api/auth/signup`
- **Action**: Send 6 signup requests from the same IP address in rapid succession (<5 seconds).
- **Assertions**:
  - Requests 1–5: Processed normally (`201` or `400`/`409`).
  - Request 6: Receives `429 Too Many Requests`.
  - Body: `{ "error": "Too many signup attempts. Please try again later." }`.

#### T2-RATE-02: Forgot Password Flood Exceeding 3 Requests / Hour
- **Endpoint**: `POST /api/auth/forgot-password`
- **Action**: Send 4 reset requests from the same IP.
- **Assertions**:
  - Request 4: Receives `429 Too Many Requests`.

#### T2-RATE-03: Comment Spam Exceeding 30 Requests / Minute
- **Endpoint**: `POST /api/comments`
- **Action**: Send 31 comment creation requests under the same user session.
- **Assertions**:
  - Request 31: Receives `429 Too Many Requests`.

#### T2-RATE-04: Profile Update Flood Exceeding 10 Requests / Minute
- **Endpoint**: `PUT /api/profile/:id`
- **Action**: Send 11 profile update requests within 60 seconds.
- **Assertions**:
  - Request 11: Receives `429 Too Many Requests`.

#### T2-RATE-05: Atomic UPSERT Under Concurrency
- **Target**: `src/lib/rate-limit.ts`
- **Action**: Fire 20 parallel requests to `checkRateLimit('burst-key', 5, 60000)` simultaneously using `Promise.all`.
- **Assertions**:
  - Exactly 5 requests return `{ success: true }`.
  - Exactly 15 requests return `{ success: false }`.
  - No database race conditions or counter overwrites.

---

### Suite 2.4: Token Boundary & Auth Edge Cases (Tests T2-AUTH-01 to T2-AUTH-04)

#### T2-AUTH-01: Forged or Tampered Session JWT
- **Endpoint**: `GET /api/me`
- **Input**: Send request with cookie `authjs.session-token` containing a tampered JWT signature.
- **Expected Status**: `401 Unauthorized`.

#### T2-AUTH-02: Expired Password Reset Token
- **Endpoint**: `POST /api/auth/reset-password`
- **Preconditions**: Token expired in database (`expires < Date.now()`).
- **Input**:
  ```json
  { "token": "expired-token-val", "password": "NewStrongPass123!" }
  ```
- **Expected Status**: `400 Bad Request` ("Invalid or expired reset token").
- **Verification**: Token is deleted and password is NOT changed.

#### T2-AUTH-03: Replay of Used Email Verification Token
- **Endpoint**: `GET /api/auth/verify-email?token=:token`
- **Action**: Call endpoint twice with the same token.
- **Assertions**:
  - Call 1: `200 OK` ("Email verified successfully").
  - Call 2: `400 Bad Request` ("Invalid or expired verification token").

#### T2-AUTH-04: Non-Existent User ID in Profile Route
- **Endpoint**: `GET /api/profile/non-existent-user-id`
- **Expected Status**: `404 Not Found`.

---

### Suite 2.5: Large Payloads & Boundary Value Analysis (Tests T2-PAY-01 to T2-PAY-04)

#### T2-PAY-01: Excessive Comment Length (>5000 Characters)
- **Endpoint**: `POST /api/comments`
- **Input**: `{ "boardId": "b1", "content": "A".repeat(5001) }`
- **Expected Status**: `400 Bad Request` ("Content too long").

#### T2-PAY-02: Excessive Profile Bio Length (>500 Characters)
- **Endpoint**: `PUT /api/profile/:id`
- **Input**: `{ "bio": "B".repeat(501) }`
- **Expected Status**: `400 Bad Request` ("Bio must be less than 500 characters").

#### T2-PAY-03: Oversized File Upload (>5MB)
- **Endpoint**: `POST /api/upload`
- **Input**: Multi-part form data with 6MB image file.
- **Expected Status**: `400 Bad Request` ("File too large. Maximum size is 5MB.").

#### T2-PAY-04: Massive Board State Payload (>10MB)
- **Endpoint**: `PUT /api/boards/:id`
- **Input**: JSON payload with 10,000 synthetic nodes (~12MB).
- **Expected Behavior**: Clean response (either `413 Payload Too Large` or successful storage if within limits), without unhandled memory spikes or server crash.

---

## Part 4: Test Implementation Matrix

| Test ID | Tier | Target Endpoint / Component | Test Type | Preconditions | Inputs / Trigger | Expected Status / Outcome | Assertion Details |
|---|---|---|---|---|---|---|---|
| **T1-SEC-01** | 1 | `POST /api/auth/signup` | Integration | New user | Valid signup JSON | `201 Created` | Zero tokens returned; `verificationToken` omitted |
| **T1-SEC-02** | 1 | `POST /api/auth/forgot-password` | Integration | User exists | `{ email }` | `200 OK` | `resetToken` omitted from response body |
| **T1-SEC-03** | 1 | `GET /api/me` | Integration | Authenticated | Session cookie | `200 OK` | `body.passwordHash === undefined` |
| **T1-SEC-04** | 1 | `PUT /api/profile/[id]` | Integration | User session | Update name/bio | `200 OK` | `passwordHash` omitted from updated return |
| **T1-SEC-05** | 1 | `GET /api/profile/[id]` | Integration | Unauthenticated | User ID | `200 OK` | `body.email === undefined` |
| **T1-SEC-06** | 1 | Core API & Routes | Integration | No auth | `x-test-bypass: true` | `401 Unauthorized` | Test bypass rejected completely |
| **T1-SEC-07** | 1 | Middleware routes | E2E | Unauthenticated | Visit `/cases`, `/board/*` | `307/401 Redirect` | Redirect to `/login` |
| **T1-SEC-08** | 1 | `GET /api/boards/[id]` | Integration | User B | Private board of User A | `403 Forbidden` | Access denied |
| **T1-DB-01** | 1 | `src/lib/db.ts` | Unit | No env vars | Import db client | Throws Error | Zero fallback to `:memory:` |
| **T1-DB-02** | 1 | Remote Turso DB | Integration | Cloud Turso URL | Query SQLite schema | 13 tables exist | FK & compound unique constraints active |
| **T1-DB-03** | 1 | `DELETE /api/boards/[id]` | Integration | Board Owner | `DELETE /api/boards/:id` | `200 OK` | `deletedAt !== null` |
| **T1-DB-04** | 1 | `GET /api/boards` | Integration | Soft-deleted board | Fetch user boards | `200 OK` | Soft-deleted boards filtered out |
| **T1-CANVAS-01** | 1 | Canvas Board UI | E2E | Board open | Add Sticky Note | Node created | Type `sticky`, text editable |
| **T1-CANVAS-02** | 1 | Canvas Board UI | E2E | Board open | Add Text Node | Node created | Type `text`, auto-resizable |
| **T1-CANVAS-03** | 1 | Canvas Board UI | E2E | Board open | Add Image Node | Node created | Type `image`, polaroid exhibit frame |
| **T1-CANVAS-04** | 1 | Canvas Board UI | E2E | Board open | Add Article Node | Node created | Type `article`, auto-fetches preview |
| **T1-CANVAS-05** | 1 | Canvas Board UI | E2E | Board open | Add Link Node | Node created | Type `link`, detective badge icon |
| **T1-CANVAS-06** | 1 | Canvas Board UI | E2E | Nodes connected | Delete Node A | Node deleted | Connected edges cleanly removed |
| **T1-CANVAS-07** | 1 | Canvas Board UI | E2E | Edge connected | Click Cut String button | Edge removed | Synced with Zustand store |
| **T1-STORE-01** | 1 | Zustand Store | E2E | Board 1 has data | Open Board 2 | Clean canvas | 0 nodes from Board 1 leak into Board 2 |
| **T1-STORE-02** | 1 | `PUT /api/boards/[id]` | Integration | Version 3 | Save stale version | `409 Conflict` | Optimistic locking prevents overwrite |
| **T1-COMM-01** | 1 | `GET /api/comments` | Integration | Viewer access | `?boardId=:id` | `200 OK` | Left-joins users (userName, userImage) |
| **T1-COMM-02** | 1 | `POST /api/comments` | Integration | Viewer access | Valid comment | `201 Created` | Awards +2 reputation points |
| **T1-COMM-04** | 1 | `CommentsPanel.tsx` | E2E | Board open | Click Comments button | Panel opens | Submitting comment updates UI |
| **T1-COL-01** | 1 | `CollaboratorsPanel.tsx` | E2E | Board open | Click Team button | Panel opens | Lists collaborators with roles |
| **T1-COL-02** | 1 | `POST /api/boards/[id]/collaborators` | Integration | Owner | `{ userEmail, role }` | `201 Created` | Looks up user by email |
| **T1-COL-03** | 1 | `PATCH /api/boards/[id]/collaborators` | Integration | Owner | `{ collaboratorId, role }` | `200 OK` | Updates role |
| **T1-COL-04** | 1 | `DELETE /api/boards/[id]/collaborators` | Integration | Owner | `?collaboratorId=:id` | `200 OK` | Removes collaborator |
| **T1-VER-01** | 1 | `VersionHistory.tsx` | E2E | Board open | Click History button | Drawer opens | Lists historical snapshots |
| **T1-EXP-01** | 1 | `ExportModal.tsx` | E2E | Board open | Click Export button | Modal opens | Offers JSON, PNG, and PDF formats |
| **T1-REP-01** | 1 | `src/lib/reputation.ts` | Unit | Any user | Award actions | Points update | +10, +5, +3, +2, +25, +15 |
| **T1-REP-02** | 1 | Rank title logic | Unit | User points | 0, 50, 200, 500, 1000 | Correct Rank | Patrol Officer -> Chief Detective |
| **T1-REP-03** | 1 | `GET /api/leaderboard` | Integration | Seeded users | Fetch leaderboard | `200 OK` | Left-joins users for detective names |
| **T2-SSRF-01** | 2 | `GET /api/preview` | Integration | Any caller | `?url=http://127.0.0.1` | `400 Bad Request` | Loopback address blocked |
| **T2-SSRF-02** | 2 | `GET /api/preview` | Integration | Any caller | `?url=http://169.254.169.254` | `400 Bad Request` | Cloud IMDS address blocked |
| **T2-SSRF-03** | 2 | `GET /api/preview` | Integration | Any caller | `?url=http://10.0.0.1` | `400 Bad Request` | RFC 1918 private subnets blocked |
| **T2-SSRF-04** | 2 | `GET /api/preview` | Integration | Any caller | `?url=file:///etc/passwd` | `400 Bad Request` | Non-HTTP schemes blocked |
| **T2-SSRF-06** | 2 | `GET /api/preview` | Integration | Any caller | `?url=not-a-url` | `400 Bad Request` | Malformed URLs safely handled |
| **T2-INP-02** | 2 | `POST /api/comments` | Integration | Authenticated | `{ content: "   " }` | `400 Bad Request` | Whitespace-only content rejected |
| **T2-RATE-01** | 2 | `POST /api/auth/signup` | Integration | Single IP | 6 requests in 1s | `429 Too Many Requests` | 6th request rate-limited |
| **T2-RATE-02** | 2 | `POST /api/auth/forgot-password` | Integration | Single IP | 4 requests in 1s | `429 Too Many Requests` | 4th request rate-limited |
| **T2-AUTH-01** | 2 | `GET /api/me` | Integration | Invalid token | Forged session JWT | `401 Unauthorized` | Invalid signature rejected |
| **T2-AUTH-02** | 2 | `POST /api/auth/reset-password` | Integration | User | Expired reset token | `400 Bad Request` | Expired token rejected |
| **T2-PAY-01** | 2 | `POST /api/comments` | Integration | Authenticated | 5,001 char content | `400 Bad Request` | Exceeds max length constraint |
| **T2-PAY-03** | 2 | `POST /api/upload` | Integration | Authenticated | 6MB image file | `400 Bad Request` | File size exceeds 5MB limit |
