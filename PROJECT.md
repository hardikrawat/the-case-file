# Project: The Case File Remediation & Hardening

## Architecture
- **Framework & Runtime**: Next.js 14 (App Router) with React 18, TypeScript, Tailwind CSS, Lucide icons.
- **Persistence Layer**: Cloud Turso Database (`@libsql/client` with Drizzle ORM) connecting via `libsql://the-case-file-hardikrawat.aws-ap-south-1.turso.io`. In-memory fallbacks (:memory:) are strictly prohibited.
- **Authentication**: NextAuth.js v5 (beta) with JWT strategy and credentials provider; all test bypass backdoors eliminated.
- **State Management**: Zustand store (`src/store/useStore.ts`) for Canvas state (ReactFlow), with clean per-board isolation and strictly preference-only localStorage persistence.
- **Canvas Evidence Board**: ReactFlow with custom evidence nodes (StickyNote, Text, Image, Article, Link) and physics-based red yarn string edges (`StringEdge.tsx`).
- **Panels & Overlays**: CommentsPanel, CollaboratorsPanel, VersionHistory, ExportModal mounted directly in `Board.tsx`.
- **Reputation & Lineage**: Event-driven reputation awards (`awardPoints`) wired into CRUD route handlers; case forking lineage tracking and visual contribution diffing.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Turso Cloud Connection | Strict fail-fast connection to cloud Turso DB, removing `:memory:` fallback | M1 | Survey / R1 |
| 2 | Environment Configuration | `.env.local` populated with cloud credentials; package.json db scripts added | M1 | Survey / R1 |
| 3 | Schema Integrity & Sync | Add notifications, comments.isAnonymous, boards.version, parentId FK, run non-destructive drizzle-kit push | M1 | Survey / R1 |
| 4 | Relational Indexes | Add indexes on FKs, userReputation.points, rateLimits.expiresAt, unique constraint on collaborators | M1 | Survey / R1 |
| 5 | Soft-Delete Support | Respect `deletedAt` in all board queries and implement `DELETE /api/boards/[id]` | M1 | Survey / R1 |
| 6 | Eliminate Test Auth Bypass | Remove all `x-test-bypass` headers and mock board synthesis from auth.ts, auth.config.ts, board/[id]/page.tsx | M2 | Survey / R2 |
| 7 | Route Protection | Guard `/board/*`, `/profile/*`, `/leaderboard` in auth.config.ts middleware | M2 | Survey / R2 |
| 8 | Fix Signup Token Leakage | Remove `verificationToken` from `POST /api/auth/signup` response | M2 | Survey / R2 |
| 9 | Fix Forgot-Password Leakage | Remove `resetToken` from `POST /api/auth/forgot-password` response | M2 | Survey / R2 |
| 10 | Fix Password Hash Leakage | Strip `passwordHash` from `GET /api/me` and `PUT /api/profile/[id]` | M2 | Survey / R2 |
| 11 | Privacy Hardening | Omit email from public profile and search results | M2 | Survey / R2 |
| 12 | SSRF Protection in Preview | Validate URL protocol, resolve DNS, block private IPs (127.0.0.1, 169.254.169.254, RFC1918) | M2 | Survey / R2 |
| 13 | Atomic Rate Limiting | Convert `checkRateLimit` to atomic SQLite UPSERT and protect 12 unprotected endpoints | M2 | Survey / R2 |
| 14 | IDOR Protection | Implement `getBoardAccess` helper to protect comments, contributions, collaborators | M2 | Survey / R2 |
| 15 | File Upload Hardening | Whitelist MIME types, strictly enforce extensions, verify magic numbers | M2 | Survey / R2 |
| 16 | Fix Build Blocker | Restore `connectMode` in store and board components | M3 | Survey / R3 |
| 17 | Link Evidence Node | Implement `LinkNode.tsx` with detective styling and register in Board & Toolbar | M3 | Survey / R3 |
| 18 | Node Deletion UI | Add deletion action to all nodes and cleanup dangling edges in ReactFlow / store | M3 | Survey / R3 |
| 19 | String Cutting Sync | Synchronize edge cutting in `StringEdge.tsx` directly with `useStore.deleteEdge` | M3 | Survey / R3 |
| 20 | Board State Isolation | Isolate Zustand store per board, purge nodes/edges from global localStorage | M3 | Survey / R3 |
| 21 | Optimistic Locking & Auto-Save | Add version check on board save to prevent silent overwrites | M3 | Survey / R3 |
| 22 | Mount CommentsPanel | Mount CommentsPanel in Board UI, join user details in `GET /api/comments` | M3 | Survey / R3 |
| 23 | Mount CollaboratorsPanel | Mount CollaboratorsPanel in Board UI, add email lookup, DELETE and PATCH endpoints | M3 | Survey / R3 |
| 24 | Mount VersionHistory | Mount VersionHistory in Board UI, auto-save versions on board update | M3 | Survey / R3 |
| 25 | Mount ExportModal | Mount ExportModal in Board UI with PNG, PDF, JSON export capabilities | M3 | Survey / R3 |
| 26 | Reputation Engine Wiring | Hook `awardPoints` into board creation, publishing, comments, contributions | M4 | Survey / R4 |
| 27 | Leaderboard User Joins | Join `users` table in `GET /api/leaderboard` to render real detective names and ranks | M4 | Survey / R4 |
| 28 | Unified Rank Titles | Unify rank title thresholds across profile, leaderboard, and reputation lib | M4 | Survey / R4 |
| 29 | Case Lineage Indicators | Return parent board info, show lineage banner in board and fork badges | M4 | Survey / R4 |
| 30 | Contribution Visual Diff | Provide visual diff highlighting (added, modified, unchanged) in ContributionModal | M4 | Survey / R4 |
| 31 | E2E Testing Track | Requirement-driven 4-tier test suite validating security, DB, canvas, and collaboration | M-E2E | Survey / R5 |
| 32 | Quality Gates & Audit | Pass 100% E2E tests, Tier 5 adversarial hardening, forensic audit, build/lint/test passes | M5 | Survey / R5 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Turso DB Cloud Persistence & Schema Integrity | Features 1-5: .env.local, db.ts fail-fast, schema sync, indexes, soft-delete | none | DONE |
| M2 | Security Hardening & Auth Protection | Features 6-15: bypass elimination, credential stripping, SSRF defense, atomic rate limiting, IDOR defense | M1 | DONE |
| M3 | Canvas Board & Orphaned Panels Wiring | Features 16-25: build fix, LinkNode, node delete, string cut sync, board isolation, mount 4 panels | M1, M2 | IN_PROGRESS (9fbe4361-8197-45dd-97fb-cda3d97e6796) |
| M4 | Reputation, Collaboration & Lineage | Features 26-30: reputation triggers, leaderboard join, rank unification, lineage banner, contribution visual diff | M1, M2, M3 | PLANNED |
| M-E2E | E2E Testing Track | Feature 31: Requirement-driven opaque-box 4-tier test suite, runner, TEST_READY.md | none (parallel) | DONE |
| M5 | Quality Gates & Final Hardening | Feature 32: Pass 100% E2E tests, Tier 5 adversarial hardening, Forensic Audit | M1-M4, M-E2E | PLANNED |

## Interface Contracts

### Turso DB Client Contract (`src/lib/db.ts`)
- Exports `db`: Drizzle ORM client connected to remote Turso via `@libsql/client`.
- Throws fatal error on import if `TURSO_DATABASE_URL` is empty or if remote URL lacks `TURSO_AUTH_TOKEN`.
- Zero fallback to `:memory:`.

### Board Access Authorization Contract (`src/lib/auth-checks.ts`)
- Function: `getBoardAccess(boardId: string, userId?: string)`
- Returns: `{ board: BoardData | null, canView: boolean, canEdit: boolean, isOwner: boolean }`
- Logic:
  - If board does not exist or `board.deletedAt !== null` -> `board: null, canView: false, canEdit: false, isOwner: false`
  - If `board.isPublic` -> `canView: true`
  - If `userId && board.userId === userId` -> `canView: true, canEdit: true, isOwner: true`
  - If `userId` in `boardCollaborators`:
    - role == 'owner' -> `canView: true, canEdit: true, isOwner: true`
    - role == 'editor' -> `canView: true, canEdit: true, isOwner: false`
    - role == 'viewer' -> `canView: true, canEdit: false, isOwner: false`

### Collaborators API Contract (`src/app/api/boards/[id]/collaborators`)
- `GET`: Returns `{ id, userId, role, addedAt, userName, userEmail }[]` (Requires `canView`).
- `POST`: Accepts `{ userEmail: string, role: string }` OR `{ userId: string, role: string }` (Requires `isOwner`). Looks up user if email supplied.
- `DELETE`: `DELETE /api/boards/[id]/collaborators?collaboratorId=<id>` OR `?userId=<id>` (Requires `isOwner`).
- `PATCH`: Accepts `{ collaboratorId: string, role: 'viewer' | 'editor' }` (Requires `isOwner`).

### Comments API Contract (`src/app/api/comments`)
- `GET`: Accepts `?boardId=<id>&nodeId=<id>`. Validates `canView`. Left-joins `users` to return `{ id, boardId, nodeId, userId, content, parentId, createdAt, updatedAt, userName, userImage }[]`.
- `POST`: Accepts `{ boardId, nodeId, content, parentId }`. Validates `canView`. Calls `awardPoints(session.user.id, 'comment_posted')`.

### Reputation Engine Contract (`src/lib/reputation.ts`)
- Actions: `'board_created' | 'board_made_public' | 'board_shared' | 'comment_posted' | 'contribution_accepted' | 'profile_completed'`
- Points: `board_created: 10, board_made_public: 5, comment_posted: 2, contribution_accepted: 25, profile_completed: 15`
- Ranks:
  - 1000+: "Chief Detective"
  - 500+: "Senior Investigator"
  - 200+: "Private Eye"
  - 50+: "Rookie Cop"
  - <50: "Patrol Officer"

## Code Layout
- `src/lib/db.ts`: Remote Turso database client (fail-fast)
- `src/lib/schema.ts`: Drizzle schema definitions, indexes, relations
- `src/lib/auth-checks.ts`: Shared authorization & permission helper
- `src/lib/rate-limit.ts`: Atomic SQLite rate limiting
- `src/lib/reputation.ts`: Gamification & reputation engine
- `src/components/Board.tsx`: Main canvas view, panel mounting, auto-save
- `src/components/nodes/`: Evidence nodes (StickyNote, Text, Image, Article, Link)
- `src/components/edges/StringEdge.tsx`: Red string physics & cut action
- `src/store/useStore.ts`: ReactFlow Zustand store (isolated, unpolluted)
- `src/components/CommentsPanel.tsx`: Mounted comments panel
- `src/components/CollaboratorsPanel.tsx`: Mounted collaborators panel
- `src/components/VersionHistory.tsx`: Mounted version history panel
- `src/components/ExportModal.tsx`: Mounted export modal
- `tests/e2e/`: Opaque-box E2E test suite (Tiers 1-4)
- `tests/unit/` & `tests/integration/`: Unit and integration test suites
