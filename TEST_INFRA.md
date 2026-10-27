# Automated E2E Test Infrastructure & Verification Architecture

**Project**: The Case File (`/Users/hardikrawat/Documents/the-case-file`)  
**Specification**: Requirement-Driven Opaque-Box 4-Tier Automated Verification Architecture  
**Execution Runtime**: Playwright 1.49+ with Chromium Engine & Direct LibSQL Turso DB Connection  
**Integrity Mandate**: Strictly Zero-Bypass (`x-test-bypass` eliminated). Authentic Cryptographic NextAuth v5 Sessions and Direct Remote Turso Cloud Persistence.

---

## 1. Executive Architecture & Core Principles

The test harness for **The Case File** provides automated, requirement-driven verification of all security hardening, cloud database persistence, ReactFlow canvas interactions, collaborator permissions, and gamified reputation systems. 

All test suites follow four strict architectural principles:

1. **Zero-Bypass Authentication (Cryptographic JWE Tokens)**:
   - The test backdoor (`x-test-bypass` header) and mock session interception have been completely eliminated.
   - Authenticated sessions are cryptographically signed using `@auth/core/jwt` (`encode` with `salt: 'authjs.session-token'` and `process.env.AUTH_SECRET`).
   - Generated tokens match the exact JSON Web Encryption (JWE) format produced by NextAuth.js v5 (beta.30), allowing genuine server-side session decryption by Next.js middleware and route handlers (`await auth()`).

2. **Direct Remote Cloud Persistence (Turso DB)**:
   - Tests execute against the live cloud Turso database (`libsql://the-case-file-hardikrawat.aws-ap-south-1.turso.io`) via `@libsql/client`.
   - In-memory fallbacks (`:memory:`) are strictly prohibited and will cause fatal initialization errors.
   - Database mutations are validated through real queries against all 14 schema tables.

3. **Opaque-Box Verification**:
   - Tests operate strictly against external contracts: public HTTP REST endpoints, HTTP status codes, JSON response schemas, ReactFlow canvas DOM elements, and browser events.
   - Tests do not hook into private internal component state, ensuring resilient behavior-based assertions.

4. **Deterministic Isolation & Cascading Teardown**:
   - Standard persistent detective personas (`DETECTIVE_ALPHA`, `DETECTIVE_BETA`, `DETECTIVE_GAMMA`) are seeded into Turso DB with `email_verified_flag: 1`.
   - Ephemeral test entities use prefix conventions (`e2e_board_*`, `[E2E-TEST]`).
   - Dedicated teardown routines cascade-delete all test boards, comments, collaborators, versions, and contributions without touching non-test production records.

---

## 2. Directory Structure & Layout

```
the-case-file/
├── playwright.config.ts            # Central Playwright configuration (dotenv, baseURL, no bypass headers)
├── package.json                    # Test runner scripts (test:e2e, test:e2e:tier1-4, test:e2e:ui)
├── TEST_INFRA.md                   # This master architecture specification
├── tests/
│   └── e2e/
│       ├── helpers/
│       │   ├── auth.ts             # Cryptographic JWE token generation, cookie injector, UI login
│       │   ├── db.ts               # Direct Turso DB connection, seeder, scoped cleanup, query helpers
│       │   ├── api-client.ts       # Authenticated HTTP REST client wrapper with security assertions
│       │   ├── canvas-helpers.ts   # ReactFlow canvas automation (mount, add/delete node, cut string, panels)
│       │   ├── infra-smoke.spec.ts # Infrastructure smoke validation test (9/9 passing)
│       │   └── index.ts            # Unified barrel export for all helpers
│       ├── tier1-features/         # Tier 1: Feature Coverage (Category-Partition Testing)
│       │   ├── security.spec.ts    # Token leakage, auth guards, passwordHash stripping
│       │   ├── turso-db.spec.ts    # Remote connectivity, schema integrity, soft-delete filtering
│       │   ├── canvas-nodes.spec.ts# 5 node types (Sticky, Text, Image, Article, Link), delete, strings
│       │   └── collaboration.spec.ts# Comments, Collaborators, VersionHistory, ExportModal, Reputation
│       ├── tier2-boundary/         # Tier 2: Boundary & Corner Cases (Boundary Value Analysis)
│       │   ├── ssrf-preview.spec.ts# SSRF vectors (127.0.0.1, 169.254.169.254, RFC1918, malformed)
│       │   ├── input-boundary.spec.ts# Empty/whitespace inputs, min/max limits, oversized payloads
│       │   └── rate-limits.spec.ts # Flood limits (signup, reset, comments, profile) & atomic UPSERT
│       ├── tier3-cross-feature/    # Tier 3: Cross-Feature Combinations (Pairwise / Combinatorial Testing)
│       │   ├── forking-lineage.spec.ts# Fork DAG lineage, parentId, independent modification
│       │   ├── collab-rbac.spec.ts # Granular RBAC matrix (Owner vs Editor vs Viewer vs Public)
│       │   ├── contribution-diff.spec.ts# Suggestion snapshot, visual diff (Added/Modified/Unchanged), merge
│       │   └── reputation-chain.spec.ts # Cumulative points accrual and rank promotion across all actions
│       └── tier4-scenarios/        # Tier 4: Real-World Scenarios (Workload & Workflow Testing)
│           ├── homicide-case.spec.ts# Multi-detective homicide investigation (all 5 nodes, red yarn)
│           ├── discovery-search.spec.ts# Publication, starring counter, and scoped search filtering
│           ├── dossier-export.spec.ts# Case export (JSON/PNG/PDF) & 100% fidelity roundtrip re-import
│           └── conflict-rollback.spec.ts# Version history snapshot, rollback, and optimistic lock (409)
```

---

## 3. The 4-Tier Test Methodology

The verification suite applies four complementary software testing methodologies to ensure complete coverage without redundancy:

```
+-----------------------------------------------------------------------------+
| TIER 4: Real-World Scenarios (Workload & Investigative Workflow Testing)    |
| Multi-detective homicide cases, publication & search, dossier roundtrips    |
+-----------------------------------------------------------------------------+
                                       ^
+-----------------------------------------------------------------------------+
| TIER 3: Cross-Feature Interactions (Pairwise & Combinatorial Testing)       |
| Fork DAG lineage, RBAC matrices, diff & merge, cumulative reputation        |
+-----------------------------------------------------------------------------+
                                       ^
+-----------------------------------------------------------------------------+
| TIER 2: Boundary & Corner Cases (Boundary Value Analysis - BVA)             |
| SSRF attacks, input limits, oversized payloads, burst rate limiting         |
+-----------------------------------------------------------------------------+
                                       ^
+-----------------------------------------------------------------------------+
| TIER 1: Feature Coverage (Category-Partition Testing)                       |
| Security hardening, Turso persistence, 5 canvas nodes, panels, reputation   |
+-----------------------------------------------------------------------------+
```

---

### Tier 1: Feature Coverage (Category-Partition Testing)

**Methodology**: Functional domains are partitioned into orthogonal categories. For each category, parameters, environment conditions, and expected behavioral partitions are verified against project acceptance criteria.

#### Category 1.1: Security & Authentication Hardening
- **T1-SEC-01 (Signup Zero Token Leakage)**: `POST /api/auth/signup` creates a user and sends an email verification token, but strictly omits `verificationToken`, `token`, and `passwordHash` from the HTTP JSON response body.
- **T1-SEC-02 (Forgot Password Zero Token Leakage)**: `POST /api/auth/forgot-password` creates a reset token in the database, returning `{ success: true, message: "..." }` while strictly omitting `resetToken` or raw tokens from the response body.
- **T1-SEC-03 (Strip `passwordHash` in `/api/me`)**: `GET /api/me` returns the authenticated user's profile and reputation points, with `passwordHash` stripped from the payload.
- **T1-SEC-04 (Strip `passwordHash` in `PUT /api/profile/[id]`)**: Profile update endpoints return updated fields (`name`, `bio`, `avatarUrl`) without leaking the user's password hash.
- **T1-SEC-05 (Public Profile Privacy)**: `GET /api/profile/[id]` hides sensitive fields (`email`, `passwordHash`) from unauthenticated or foreign callers.
- **T1-SEC-06 (Elimination of `x-test-bypass`)**: Sending requests with `x-test-bypass: true` without a valid session cookie returns `401 Unauthorized` or redirects to `/login`. No mock session or synthetic board is generated.
- **T1-SEC-07 (Route Middleware Protection)**: Direct unauthenticated requests to `/cases`, `/discover`, `/board/*`, `/profile/*`, `/leaderboard`, and `/settings` are intercepted by Next.js middleware and redirected to `/login`.
- **T1-SEC-08 (IDOR Protection on Private Boards)**: Non-collaborators attempting to access private boards receive `403 Forbidden` or `404 Not Found`.

#### Category 1.2: Turso DB Cloud Persistence & Schema Integrity
- **T1-DB-01 (Fail-Fast Connection)**: `src/lib/db.ts` throws a fatal error on initialization if `TURSO_DATABASE_URL` is empty or if remote `libsql://` lacks `TURSO_AUTH_TOKEN`. In-memory fallbacks are prohibited.
- **T1-DB-02 (Cloud Schema & Constraints)**: Remote database contains all 14 required tables (`users`, `accounts`, `sessions`, `boards`, `contributions`, `verificationToken`, `password_reset_tokens`, `email_verification_tokens`, `comments`, `board_versions`, `board_collaborators`, `user_reputation`, `rate_limits`, `notifications`) with foreign keys and compound unique constraints.
- **T1-DB-03 (Soft-Delete Support)**: `DELETE /api/boards/[id]` sets `deleted_at = unix_timestamp` rather than hard-deleting the row.
- **T1-DB-04 (Soft-Deleted Boards Excluded from Lists)**: `GET /api/boards` filters out boards where `deleted_at IS NOT NULL`.
- **T1-DB-05 (Soft-Deleted Boards Inaccessible)**: Direct access (`GET /api/boards/[id]`) or update (`PUT /api/boards/[id]`) on soft-deleted boards returns `404 Not Found`.

#### Category 1.3: Canvas Evidence Board & 5 Node Types
- **T1-CANVAS-01 (Sticky Note Node)**: Sticky notes (`type: sticky`) render with pinned rotation, yellow background, and editable text.
- **T1-CANVAS-02 (Text Annotation Node)**: Text nodes (`type: text`) support multiline text annotations and dynamic height adjustment.
- **T1-CANVAS-03 (Image Evidence Node)**: Image nodes (`type: image`) render with polaroid exhibit borders, "EXHIBIT" badge, image rendering, and caption input.
- **T1-CANVAS-04 (Article Evidence Node)**: Article nodes (`type: article`) fetch link metadata via preview API and display newspaper-style clipping headers.
- **T1-CANVAS-05 (Link Evidence Node - Feature 17)**: Link nodes (`type: link`) render with detective badge / magnifying glass styling, external URL link, and metadata display.
- **T1-CANVAS-06 (Node Deletion & Dangling Edge Cleanup)**: Deleting an evidence node removes the node and automatically purges all connected red string edges from ReactFlow state and board content.
- **T1-CANVAS-07 (Red Yarn String Cutting)**: Clicking the cut button on a selected `StringEdge` synchronizes with the Zustand store and removes the edge from persisted board state.

#### Category 1.4: Board State Isolation & Panels
- **T1-STORE-01 (Per-Board State Isolation)**: Opening Board A, adding nodes, and then navigating to Board B loads Board B's isolated state without showing stale nodes or edges from Board A. Global localStorage keys do not pollute board data.
- **T1-STORE-02 (Optimistic Locking & Auto-Save)**: `PUT /api/boards/[id]` increments the board `version`. Submitting an update with a stale version number returns `409 Conflict`.
- **T1-PANEL-01 (CommentsPanel Mounted & User Join)**: CommentsPanel is mounted on `Board.tsx`. `GET /api/comments` left-joins `users` to provide detective names and avatars.
- **T1-PANEL-02 (CollaboratorsPanel Mounted & Management API)**: CollaboratorsPanel is mounted on `Board.tsx`. Supports listing collaborators, adding by email (`POST`), updating role (`PATCH`), and removing (`DELETE`).
- **T1-PANEL-03 (VersionHistory Mounted & Snapshot Restore)**: VersionHistory is mounted on `Board.tsx`. Listing versions shows timestamps, and clicking "Restore" rolls back canvas state.
- **T1-PANEL-04 (ExportModal Mounted)**: ExportModal is mounted on `Board.tsx`, offering JSON, PNG, and PDF download formats.

#### Category 1.5: Reputation Engine & Leaderboard
- **T1-REP-01 (Gamification Points Allocation)**: `board_created` (+10), `board_made_public` (+5), `board_shared` (+3), `comment_posted` (+2), `contribution_accepted` (+25), `profile_completed` (+15).
- **T1-REP-02 (Unified Detective Rank Thresholds)**: Unified across UI and backend: 1000+ ("Chief Detective"), 500+ ("Senior Investigator"), 200+ ("Private Eye"), 50+ ("Rookie Cop"), <50 ("Patrol Officer").
- **T1-REP-03 (Leaderboard Real User Joins)**: `GET /api/leaderboard` joins the `users` table, returning detective names, avatars, and rank titles instead of bare user IDs.

---

### Tier 2: Boundary & Corner Cases (Boundary Value Analysis - BVA)

**Methodology**: Boundaries, extremums, malformed structures, and overload conditions are tested to verify that the application fails safely with clear HTTP error codes rather than crashing or leaking internal details.

#### Suite 2.1: SSRF Defense & Protocol Boundaries (`/api/preview`)
- **T2-SSRF-01 (Loopback IPv4/IPv6)**: `http://127.0.0.1`, `http://localhost`, `http://0.0.0.0`, `http://[::1]` return `400 Bad Request`.
- **T2-SSRF-02 (Cloud Instance Metadata Service - IMDS)**: `http://169.254.169.254/latest/meta-data/` returns `400 Bad Request` without initiating outbound requests.
- **T2-SSRF-03 (RFC 1918 Private Subnets)**: `10.0.0.0/8`, `172.16.0.0/12`, and `192.168.0.0/16` addresses return `400 Bad Request`.
- **T2-SSRF-04 (Non-HTTP Scheme Rejection)**: `file:///etc/passwd`, `ftp://...`, `javascript:...`, `data:...` return `400 Bad Request`.
- **T2-SSRF-05 (Obfuscated & Alternative IP Formats)**: Decimal IPs (`http://2130706433`), octal (`http://0177.0.0.1`), hex (`http://0x7f000001`), and IPv6-mapped IPv4 return `400 Bad Request`.
- **T2-SSRF-06 (Malformed & Truncated URLs)**: `http://`, `https://`, `not-a-url`, `http://.` return `400 Bad Request` without 500 crashes.

#### Suite 2.2: Input Validation & Boundary Limits
- **T2-INP-01 (Empty & Whitespace Board Titles)**: Submitting empty or whitespace-only titles either falls back to `"Untitled Case"` or returns `400 Bad Request`.
- **T2-INP-02 (Empty & Whitespace Comments)**: Empty or whitespace comment submissions return `400 Bad Request`.
- **T2-INP-03 (Registration Field Boundaries)**: Missing names, malformed emails, passwords < 8 characters, or passwords lacking mixed characters return `400 Bad Request` with field error details.
- **T2-INP-04 (Oversized Payloads)**: Comments > 5,000 characters, bios > 500 characters, and file uploads > 5MB return `400 Bad Request` or `413 Payload Too Large`.

#### Suite 2.3: Rate Limiting & Concurrency Boundaries
- **T2-RATE-01 (Signup Rate Limit Flood)**: 6th signup request from the same IP within 1 hour receives `429 Too Many Requests`.
- **T2-RATE-02 (Forgot Password Flood)**: 4th password reset request within 1 hour receives `429 Too Many Requests`.
- **T2-RATE-03 (Comment Flood)**: 31st comment within 1 minute receives `429 Too Many Requests`.
- **T2-RATE-04 (Atomic SQLite UPSERT Concurrency)**: 20 simultaneous rate-limit checks with a limit of 5 produce exactly 5 successes and 15 rate-limited responses, proving atomic database counter updates.

#### Suite 2.4: Token Boundary & Auth Edge Cases
- **T2-AUTH-01 (Forged or Tampered JWE)**: Tampered session token signatures return `401 Unauthorized`.
- **T2-AUTH-02 (Expired Reset Token)**: Submitting an expired password reset token returns `400 Bad Request`.
- **T2-AUTH-03 (Replay of Verification Token)**: Using an already consumed email verification token returns `400 Bad Request`.

---

### Tier 3: Cross-Feature Interactions (Pairwise / Combinatorial Testing)

**Methodology**: Systematic verification of multi-subsystem choreography where state transitions in one domain propagate to dependent domains.

- **T3.1 (Case Forking, Lineage Tracking & State Isolation)**:
  - Lead Detective A creates a public master board with 1 node.
  - Detective B forks the board via `POST /api/boards` with `parentId = master.id`.
  - Detective B adds new nodes and string edges to the fork.
  - Verification: Master board remains strictly unmodified; forked board records `parentId`; UI displays the "Fork" badge and "Suggest Changes" button.
- **T3.2 (Sticky & Link Node Creation with Physics String Cutting)**:
  - Adds Sticky Note and newly implemented Link Evidence Node to the canvas.
  - Connects both nodes with a red yarn bezier edge (`StringEdge.tsx`).
  - Cuts the string connection via the scissors action.
  - Verification: Edge is purged from the database upon save, while both nodes remain intact on the canvas.
- **T3.3 (Collaborator Invitation, Role Management & Granular RBAC)**:
  - Tests 4 distinct actors (`Owner`, `Editor`, `Viewer`, `Intruder`) against a private board.
  - Owner invites Editor and Viewer via email lookup (`POST .../collaborators`).
  - Read Access: Owner, Editor, Viewer can read; Intruder receives `403`.
  - Edit Access: Owner and Editor can update board content; Viewer and Intruder receive `403`.
  - Collaborator Management: Only Owner can invite, promote (`PATCH`), or remove (`DELETE`) collaborators.
- **T3.4 (Contribution Lifecycle: Diff & Smart Merge)**:
  - Contributor forks board, modifies 1 node, adds 1 Link node, and submits suggestion (`POST /api/contributions`).
  - Owner opens ContributionModal and verifies visual diff categorizations:
    - Added node highlighted in **Green** (`+ ADDED`).
    - Modified node highlighted in **Amber** (`~ MODIFIED`).
    - Unchanged node rendered in neutral stone (`UNCHANGED`).
  - Owner executes merge (`POST .../merge`).
  - Verification: Target board incorporates changes; contribution status becomes `merged`; Contributor is awarded +25 reputation points.
- **T3.5 (Contribution Rejection & Immutability)**:
  - Owner rejects contribution (`POST .../reject`).
  - Verification: Target board content remains completely untouched; status transitions to `rejected`; duplicate merge attempts return `400`.
- **T3.6 (Cumulative Reputation Award Chain & Rank Promotion)**:
  - Detective performs sequence: Register (0 pts) -> Create Board (+10) -> Make Public (+5) -> Post Comment (+2) -> Fork Board (+10) -> Accepted Contribution (+25).
  - Total reaches 52 points ($\ge 50$), automatically promoting the detective from "Patrol Officer" to **"Rookie Cop"**.
  - Verification: `GET /api/me` and `GET /api/leaderboard` reflect updated points and rank title.

---

### Tier 4: Real-World Application Scenarios (Workload & Workflow Testing)

**Methodology**: Complex, end-to-end user workflows modeling real investigative operations under realistic operational conditions.

- **T4.1 ("The Blackwood Manor Mystery" - Collaborative Homicide Investigation)**:
  - **Narrative**: Lead Investigator Vance, Forensics Specialist Dr. Aris, and Rookie Scribe Officer Mills collaborate on a homicide case.
  - Vance creates the case with Polaroid Image evidence (crime scene photo) and Sticky Note (initial clues).
  - Vance adds Dr. Aris as `editor` and Mills as `viewer`.
  - Dr. Aris adds Toxicology Sticky Note and Nephew Suspect Text Node, connecting them with red yarn.
  - Mills is blocked from tampering with nodes (`403 Forbidden`), but adds threaded forensic comments on the Toxicology node.
  - Vance attaches Link Node to the probate registry database and finalizes the board.
  - Direct Turso DB verification confirms 5 nodes, 2 edges, 2 collaborators, and 1 threaded comment.
- **T4.2 (Public Discovery, Starring, and Scoped Search)**:
  - Private board is published (`isPublic: true`), awarding +5 reputation points.
  - Board appears in public discovery feed (`/discover`).
  - Discovering investigator stars the case (`POST /api/boards/[id]/star`), incrementing star count.
  - Scoped global search (`GET /api/search?q=...`) confirms public users see only public cases, board owners see their private cases, and soft-deleted boards are excluded.
- **T4.3 (Courtroom Case Dossier Archival & Roundtrip Portability)**:
  - Canvas with Sticky, Text, Image, and Link nodes is exported to JSON, PNG, and PDF.
  - JSON payload schema is validated for complete preservation of coordinates and metadata.
  - JSON payload is imported onto a fresh canvas and saved to Turso DB.
  - Deep comparison confirms 100% byte-level parity of nodes and edge topology.
- **T4.4 (Accidental Deletion Rollback & Optimistic Lock Conflict Handling)**:
  - Detective creates milestone Version 1 in `board_versions`.
  - An errant edit corrupts the board by deleting clues.
  - Detective restores Version 1 from VersionHistory, returning the canvas to its intact state.
  - Concurrent edit simulation: Detective B saves version 5, bumping DB version to 6. Detective A attempts to save with stale version 5.
  - System rejects stale save with `409 Conflict`, preventing silent data overwrite.

---

## 4. Detective Personas & Database Seeding Protocol

### Standard Test Detective Personas

All tests share three standard deterministic personas defined in `tests/e2e/helpers/auth.ts`:

| Persona Constant | User ID | Email | Password | Baseline Role Title | Verified |
|---|---|---|---|---|---|
| `DETECTIVE_ALPHA` | `e2e-user-alpha` | `alpha@testcasefile.dev` | `DetectivePass123!` | Chief Detective | `1` (true) |
| `DETECTIVE_BETA` | `e2e-user-beta` | `beta@testcasefile.dev` | `DetectivePass123!` | Senior Investigator | `1` (true) |
| `DETECTIVE_GAMMA` | `e2e-user-gamma` | `gamma@testcasefile.dev` | `DetectivePass123!` | Patrol Officer | `1` (true) |

### Seeding Protocol (`seedTestUsers()`)
- Idempotently verifies or inserts the 3 personas in the `users` table.
- Encrypts passwords using bcrypt (`10` rounds).
- Sets `email_verified_flag = 1` to ensure credentials login functions properly.
- Ensures a baseline row exists in `user_reputation` with initial 0 counters.

### Scoped Cascading Teardown (`cleanupTestData()`)
- Identifies test boards using filter:
  `id LIKE 'e2e_%' OR id LIKE 'test_%' OR title LIKE '%[E2E-TEST]%' OR title LIKE 'E2E %' OR userId IN ('e2e-user-alpha', 'e2e-user-beta', 'e2e-user-gamma')`
- Deletes related entries in cascading order:
  1. `comments`
  2. `board_collaborators`
  3. `board_versions`
  4. `contributions`
  5. `boards`
- Purges orphaned comments and contributions submitted by test user IDs.
- Resets test persona reputation counters in `user_reputation` to `0`.
- Deletes temporary ephemeral test users (`@test-ephemeral.com`, `@test-temp.com`).
- **Strictly preserves all production and existing non-test database records.**

---

## 5. Test Runner Commands & Execution Scripts

All test commands are configured in `package.json` and executed via the Playwright test runner.

### Execution Commands

| Command | Target Scope | Description |
|---|---|---|
| `npm run test:e2e` | `tests/e2e` | Runs the complete E2E test suite across all 4 tiers |
| `npm run test:e2e:tier1` | `tests/e2e/tier1-features` | Executes Tier 1 Feature Coverage test specs |
| `npm run test:e2e:tier2` | `tests/e2e/tier2-boundary` | Executes Tier 2 Boundary & Corner Cases specs |
| `npm run test:e2e:tier3` | `tests/e2e/tier3-cross-feature` | Executes Tier 3 Cross-Feature Combinations specs |
| `npm run test:e2e:tier4` | `tests/e2e/tier4-scenarios` | Executes Tier 4 Real-World Application Scenarios specs |
| `npm run test:e2e:headed` | `tests/e2e` | Runs tests in a visible Chromium browser window |
| `npm run test:e2e:ui` | `tests/e2e` | Opens the interactive Playwright UI Runner |
| `npx playwright test tests/e2e/helpers/infra-smoke.spec.ts` | `infra-smoke` | Validates authentication and Turso DB test helpers |

### Debugging & Failure Artifacts
- When tests fail, Playwright automatically saves traces, screenshots, and video recordings in the `test-results/` directory.
- Inspect detailed traces with:
  ```bash
  npx playwright show-trace test-results/<test-run-folder>/trace.zip
  ```

---

## 6. Environment & Configuration Requirements

The following environment variables must be present in `.env.local` or process environment:

| Variable | Description | Sample / Required Value |
|---|---|---|
| `TURSO_DATABASE_URL` | Remote cloud Turso database connection URL | `libsql://the-case-file-hardikrawat.aws-ap-south-1.turso.io` |
| `TURSO_AUTH_TOKEN` | Turso database authentication JWT | Valid JWT token for cloud database |
| `AUTH_SECRET` | Secret key for signing NextAuth v5 session tokens | `the-case-file-super-secret-key-development-2026` |
| `NEXTAUTH_URL` | Base URL for application server | `http://localhost:3000` |

### Playwright WebServer Lifecycle
In `playwright.config.ts`, the `webServer` block automatically starts Next.js if port 3000 is not already running:
```typescript
webServer: {
    command: process.env.CI ? 'npm run start' : 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120000,
    stdout: 'pipe',
    stderr: 'pipe',
}
```

---

## 7. Forensic Audit & Verification Checklist

To independently verify the test infrastructure:

1. **Check Zero Test Bypass**:
   ```bash
   grep -rn "x-test-bypass" playwright.config.ts tests/e2e/helpers/
   ```
   *Expected output: 0 matches (except code comments explicitly stating zero bypasses).*

2. **Verify Cryptographic Session Generation**:
   - `createSessionToken()` uses `@auth/core/jwt` with `AUTH_SECRET` and `salt: 'authjs.session-token'`.
   - NextAuth decrypts the token without relying on fake session mocking.

3. **Verify Remote Turso DB Persistence**:
   ```bash
   npx playwright test tests/e2e/helpers/infra-smoke.spec.ts
   ```
   *Expected output: 9 passed.*

4. **Verify Database Seeding & Clean Teardown**:
   - Seeded detectives exist in Turso DB with `email_verified_flag = 1`.
   - Ephemeral test boards (`e2e_board_*`) are deleted during teardown while production users are preserved.
