# Tier 3 & Tier 4 E2E Test Exploration Report: Cross-Feature Interactions & Real-World Scenarios

**Track**: E2E Testing Track (Milestone M-E2E)  
**Investigator**: Explorer 3 (Tier 3 & Tier 4 Specialist)  
**Date**: September 4, 2026  
**Target Application**: 'The Case File' (Next.js 14, ReactFlow, Turso DB via Drizzle ORM, NextAuth v5)  

---

## 1. Executive Summary

This report establishes the complete formal test specifications for **Tier 3 (Cross-Feature Interactions)** and **Tier 4 (Real-World Application Scenarios)** of 'The Case File' test suite.

While Tier 1 and Tier 2 validate isolated units, single API endpoints, and boundary constraints, **Tier 3** verifies the complex state choreography that emerges when multiple subsystems interact—such as case forking, node creation, collaborator role enforcement, contribution proposals, visual diff computation, smart merging, and multi-step reputation accrual. **Tier 4** validates true end-to-end detective workflows mimicking real-world investigative operations—such as multi-detective homicide case collaboration, public board publication and community starring, court-ready dossier exports (PDF, PNG, JSON), and conflict rollback with optimistic locking.

All test specifications in this document are **requirement-driven, opaque-box, and zero-bypass**, requiring zero mock backdoors (`x-test-bypass` is strictly rejected) and validating genuine persistence against the remote Turso DB database.

---

## 2. Subsystem Architecture & Interaction Analysis

### 2.1 Case Forking and Lineage Architecture
- **Database Model**: `boards.parentId` in `src/lib/schema.ts` establishes the directed acyclic graph (DAG) of case lineage.
- **API Flow**:
  1. `POST /api/boards` receives `{ title, isPublic, content, parentId }`.
  2. The handler sets `parentId: parentId || null` and creates an isolated board instance owned by the current user.
  3. `GET /api/boards/[id]` returns the full board record including `parentId` and `userId`.
- **UI State Behavior**:
  - In `src/components/Board.tsx`, when `parentId` is present and the viewer owns the fork, the UI renders the `<GitPullRequest />` button labeled **"Suggest Changes"**.
  - Clicking "Suggest Changes" initiates `POST /api/contributions` targeting `targetBoardId: parentId`.
  - When `parentId` is null (the root board), the owner sees the **"Review Suggestions"** button displaying the pending contribution badge count.
  - In `BoardCard.tsx`, boards with `parentId !== null` render the `Fork` badge with `Copy` icon.

### 2.2 Canvas Node Model & Edge Physics
- **Supported Evidence Node Types**:
  1. `sticky`: Sticky Note Node (`StickyNoteNode.tsx`), storing `{ label: string, color: string }`.
  2. `link`: Link Evidence Node (`LinkNode.tsx` - Feature 17), storing `{ url: string, title: string, description: string, favicon: string }`.
  3. `text`: Text Annotation Node (`TextNode.tsx`), storing `{ label: string }`.
  4. `image`: Image Evidence Node (`ImageNode.tsx`), storing `{ caption: string, src: string }`.
  5. `article`: Article Snippet Node (`ArticleNode.tsx`), storing `{ title: string, url: string, content?: string }`.
- **Red String Connections**:
  - `StringEdge.tsx` renders custom physics-based red yarn connections using quadratic bezier curves with downward gravity sag:
    $$\text{midY} = \frac{y_1 + y_2}{2} + 0.12 \cdot |x_2 - x_1|$$
  - Includes interactive "Cut String" action button on selected edges, directly synchronizing with `useStore.deleteEdge` and removing the edge ID from board state.

### 2.3 Collaborator Management & RBAC Matrix
Under `src/lib/auth-checks.ts` (`getBoardAccess`) and `src/app/api/boards/[id]/collaborators/route.ts`:
- Three formal roles are supported: `owner`, `editor`, `viewer`.
- **Granular Permissions Matrix**:

| Action | Unauthenticated | Authenticated Non-Collaborator (Private) | Authenticated Public Viewer | Collaborator: Viewer | Collaborator: Editor | Board Owner |
|---|---|---|---|---|---|---|
| **Read Board (`GET /api/boards/[id]`)** | ❌ 401 | ❌ 403 | ✅ 200 | ✅ 200 | ✅ 200 | ✅ 200 |
| **Save/Update Board (`PUT /api/boards/[id]`)** | ❌ 401 | ❌ 403 | ❌ 403 | ❌ 403 | ✅ 200 | ✅ 200 |
| **Delete Board (`DELETE /api/boards/[id]`)** | ❌ 401 | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 403 | ✅ 200 |
| **List Collaborators (`GET .../collaborators`)** | ❌ 401 | ❌ 403 | ✅ 200 | ✅ 200 | ✅ 200 | ✅ 200 |
| **Add Collaborator (`POST .../collaborators`)** | ❌ 401 | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 403 | ✅ 201 |
| **Change Role (`PATCH .../collaborators`)** | ❌ 401 | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 403 | ✅ 200 |
| **Remove Collaborator (`DELETE .../collaborators`)**| ❌ 401 | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 403 | ✅ 200 |
| **Create Version Snapshot (`POST .../versions`)** | ❌ 401 | ❌ 403 | ❌ 403 | ❌ 403 | ✅ 201 | ✅ 201 |
| **Restore Version (`PUT /api/boards/[id]`)** | ❌ 401 | ❌ 403 | ❌ 403 | ❌ 403 | ✅ 200 | ✅ 200 |
| **Submit Contribution (`POST /api/contributions`)** | ❌ 401 | ❌ 403 | ✅ 201 | ✅ 201 | ✅ 201 | N/A |
| **Merge Contribution (`POST .../merge`)** | ❌ 401 | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 403 | ✅ 200 |
| **Post Comment (`POST /api/comments`)** | ❌ 401 | ❌ 403 | ✅ 201 | ✅ 201 | ✅ 201 | ✅ 201 |

### 2.4 Contribution Lifecycle & Smart Merge Mechanics
1. **Submission**: Fork owner submits `{ targetBoardId, message, snapshot: { nodes, edges } }` via `POST /api/contributions`.
2. **Visual Diff Inspection**:
   - `ContributionModal.tsx` compares `targetBoard.content` with `contribution.snapshot`.
   - Node Categorization:
     - **Added**: Node present in `snapshot` but missing in `target`. Highlighted with **Green** border (`border-green-500`, badge `+ ADDED`).
     - **Modified**: Node ID present in both, but `data.label`, `data.url`, `data.caption`, or coordinates differ. Highlighted with **Amber** border (`border-amber-500`, badge `~ MODIFIED`).
     - **Unchanged**: Node ID and all content fields identical. Rendered with neutral stone styling (`opacity-60`).
3. **Smart Merge Algorithm** (`POST /api/contributions/[id]/merge`):
   - Merged Nodes: For all target nodes, replace with snapshot node if present in snapshot; append all new snapshot-only nodes; retain all target-only nodes.
   - Merged Edges: Union of target edges and snapshot edges by edge `id`.
   - Atomic Database Update: Updates `boards.content` and sets `contributions.status = 'merged'`.
   - **Reputation Trigger**: Calls `awardPoints(contribution.userId, 'contribution_accepted')` (+25 points) and increments `contributionsAccepted`.

### 2.5 Reputation Engine & Gamification Chain
- **Contract Defined in `src/lib/reputation.ts`**:
  - Actions:
    - `board_created`: +10 points
    - `board_made_public`: +5 points
    - `board_shared`: +3 points
    - `comment_posted`: +2 points
    - `contribution_accepted`: +25 points
    - `profile_completed`: +15 points
  - Unified Detective Ranks (`PROJECT.md` & `useUser.ts`):
    - `1000+` points: **Chief Detective**
    - `500+` points: **Senior Investigator**
    - `200+` points: **Private Eye**
    - `50+` points: **Rookie Cop**
    - `<50` points: **Patrol Officer**

---

## 3. Tier 3 Test Specifications: Cross-Feature Interactions

### Test Suite T3.1: Case Forking, Lineage Tracking & State Isolation
- **ID**: `T3.1-CASE-FORK-LINEAGE`
- **Focus**: Verifies that forking creates a genuine database clone with `parentId` lineage, leaves the parent board unmodified, and correctly isolates subsequent modifications.
- **Test Type**: Integration / E2E API Sequence
- **Preconditions**:
  - Two authenticated users: `UserA` (Original Detective), `UserB` (Forking Detective).
- **Execution Sequence**:
  1. `UserA` calls `POST /api/boards` with:
     ```json
     {
       "title": "Unsolved Warehouse Arson",
       "isPublic": true,
       "content": {
         "nodes": [
           { "id": "node-1", "type": "sticky", "position": { "x": 100, "y": 100 }, "data": { "label": "Point of origin: Bay 4" } }
         ],
         "edges": []
       }
     }
     ```
     -> Expect `201 Created`, returns `{ id: "board-parent-1" }`.
  2. `UserB` queries `GET /api/boards/board-parent-1` -> Expect `200 OK`, `parentId: null`.
  3. `UserB` calls `POST /api/boards` to fork:
     ```json
     {
       "title": "Copy of Unsolved Warehouse Arson",
       "isPublic": false,
       "parentId": "board-parent-1",
       "content": {
         "nodes": [
           { "id": "node-1", "type": "sticky", "position": { "x": 100, "y": 100 }, "data": { "label": "Point of origin: Bay 4" } }
         ],
         "edges": []
       }
     }
     ```
     -> Expect `201 Created`, returns `{ id: "board-fork-1" }`.
  4. `UserB` modifies the forked board via `PUT /api/boards/board-fork-1`:
     ```json
     {
       "content": {
         "nodes": [
           { "id": "node-1", "type": "sticky", "position": { "x": 100, "y": 100 }, "data": { "label": "Point of origin: Bay 4" } },
           { "id": "node-2", "type": "sticky", "position": { "x": 300, "y": 100 }, "data": { "label": "Suspect seen near Bay 4: Red sedan" } }
         ],
         "edges": [
           { "id": "e1-2", "source": "node-1", "target": "node-2", "type": "string" }
         ]
       }
     }
     ```
     -> Expect `200 OK`.
  5. `UserA` queries `GET /api/boards/board-parent-1`:
     - Assert `content.nodes` has length 1 (unmodified).
     - Assert `content.edges` has length 0 (unmodified).
  6. `UserB` queries `GET /api/boards/board-fork-1`:
     - Assert `parentId === "board-parent-1"`.
     - Assert `content.nodes` has length 2.
     - Assert `content.edges` has length 1.

---

### Test Suite T3.2: Multi-Node Creation (Sticky + Link Node) & Physics Edge Connections
- **ID**: `T3.2-NODES-STICKY-LINK-CONNECTION`
- **Focus**: Verifies adding newly implemented Link Evidence nodes and Sticky Note nodes on forked boards, connecting them via red yarn edges, and cutting strings.
- **Test Type**: Canvas E2E & State Serialization
- **Preconditions**: Authenticated user on forked board `board-fork-1`.
- **Execution Sequence**:
  1. Dispatch node additions to the store/API:
     - Node A (Sticky Note):
       ```json
       {
         "id": "node-sticky-clue",
         "type": "sticky",
         "position": { "x": 150, "y": 200 },
         "data": { "label": "Encrypted thumb drive found in vault", "color": "#fef3c7" }
       }
       ```
     - Node B (Link Node):
       ```json
       {
         "id": "node-link-cipher",
         "type": "link",
         "position": { "x": 500, "y": 200 },
         "data": {
           "url": "https://cyber-records.gov/case/8821",
           "title": "Decryption Registry Database",
           "description": "Public key archive for encrypted hardware",
           "favicon": "https://cyber-records.gov/favicon.ico"
         }
       }
       ```
     - Red Yarn Edge:
       ```json
       {
         "id": "edge-string-1",
         "source": "node-sticky-clue",
         "target": "node-link-cipher",
         "type": "string",
         "sourceHandle": "source",
         "targetHandle": "target"
       }
       ```
  2. Call `PUT /api/boards/board-fork-1` with `{ content: { nodes: [NodeA, NodeB], edges: [Edge1] } }`.
  3. Query `GET /api/boards/board-fork-1`:
     - Assert `nodes` contains 2 nodes: one of type `'sticky'`, one of type `'link'`.
     - Assert Link Node retains complete URL, title, and metadata without corruption.
     - Assert `edges` contains `edge-string-1`.
  4. Perform edge deletion ("cutting the string"):
     - Remove `edge-string-1` from board content and call `PUT /api/boards/board-fork-1`.
     - Query `GET /api/boards/board-fork-1`.
     - Assert `edges` is empty (`[]`).
     - Assert both `node-sticky-clue` and `node-link-cipher` remain on the board intact (cutting string does not delete nodes).

---

### Test Suite T3.3: Collaborator Invitation, Role Management & Granular RBAC
- **ID**: `T3.3-COLLAB-RBAC-ENFORCEMENT`
- **Focus**: Verifies collaborator invitation, lookup by email, role assignments (`viewer` vs `editor`), and strictly validates the permissions matrix across all board operations.
- **Test Type**: Multi-Actor Integration / RBAC Test
- **Actors**:
  - `UserA` (`owner`): Creator of `private-case-board`
  - `UserB` (`invited_editor`): Invited as `editor`
  - `UserC` (`invited_viewer`): Invited as `viewer`
  - `UserD` (`uninvited_intruder`): Unrelated user
- **Execution Sequence**:
  1. `UserA` creates private board `POST /api/boards` (`isPublic: false`) -> `private-case-board`.
  2. **Owner adds Editor**: `UserA` calls `POST /api/boards/private-case-board/collaborators`:
     ```json
     { "userEmail": "userB@test.com", "role": "editor" }
     ```
     -> Expect `201 Created`. Returns `{ id, userId: "userB-id", role: "editor" }`.
  3. **Owner adds Viewer**: `UserA` calls `POST /api/boards/private-case-board/collaborators`:
     ```json
     { "userEmail": "userC@test.com", "role": "viewer" }
     ```
     -> Expect `201 Created`. Returns `{ id, userId: "userC-id", role: "viewer" }`.
  4. **Duplicate Prevention**: `UserA` attempts to re-add `userB@test.com`:
     -> Expect `400 Bad Request` (`"User is already a collaborator"`).
  5. **Non-Owner Invitation Rejection**: `UserB` (Editor) attempts `POST /api/boards/private-case-board/collaborators`:
     -> Expect `403 Forbidden` (`"Only board owner can add collaborators"`).
  6. **Read Access Enforcement**:
     - `UserA` queries `GET /api/boards/private-case-board` -> Expect `200 OK`.
     - `UserB` queries `GET /api/boards/private-case-board` -> Expect `200 OK`.
     - `UserC` queries `GET /api/boards/private-case-board` -> Expect `200 OK`.
     - `UserD` queries `GET /api/boards/private-case-board` -> Expect `403 Forbidden`.
  7. **Edit Access Enforcement (`PUT /api/boards/private-case-board`)**:
     - `UserB` (Editor) updates content -> Expect `200 OK`.
     - `UserC` (Viewer) attempts update -> Expect `403 Forbidden`.
     - `UserD` (Intruder) attempts update -> Expect `403 Forbidden`.
  8. **Role Mutation (`PATCH .../collaborators`)**:
     - `UserA` promotes `UserC` to `'editor'`.
     - `UserC` now attempts `PUT /api/boards/private-case-board` -> Expect `200 OK`.
  9. **Collaborator Removal (`DELETE .../collaborators`)**:
     - `UserA` removes `UserC`.
     - `UserC` attempts `GET /api/boards/private-case-board` -> Expect `403 Forbidden`.

---

### Test Suite T3.4: Contribution Lifecycle: Suggestion, Visual Diff & Smart Merge
- **ID**: `T3.4-CONTRIBUTION-DIFF-SMART-MERGE`
- **Focus**: Verifies end-to-end pull-request style contribution: submitting snapshot from forked board, verifying visual diff categories (added, modified, unchanged), executing smart merge, and validating database content.
- **Actors**: `UserA` (Target Board Owner), `UserB` (Contributor).
- **Execution Sequence**:
  1. `UserA` board content currently contains:
     ```json
     {
       "nodes": [
         { "id": "node-base-1", "type": "sticky", "data": { "label": "Initial suspect: John Doe" } },
         { "id": "node-base-2", "type": "text", "data": { "label": "Alibi: At cinema" } }
       ],
       "edges": [
         { "id": "e-base-1", "source": "node-base-1", "target": "node-base-2" }
       ]
     }
     ```
  2. `UserB` forks the board, and makes changes:
     - Keeps `node-base-1` unchanged.
     - Modifies `node-base-2`: change label to `"Alibi DISPROVEN: Cinema ticket was forged"`.
     - Adds new node `node-contrib-3`: `{ "id": "node-contrib-3", "type": "link", "data": { "url": "https://cctv-logs.city/cam-4", "title": "CCTV Footage" } }`.
     - Adds new edge `e-contrib-2`: `{ "id": "e-contrib-2", "source": "node-base-2", "target": "node-contrib-3" }`.
  3. `UserB` calls `POST /api/contributions`:
     ```json
     {
       "targetBoardId": "board-parent-1",
       "message": "Disproved John Doe alibi with CCTV link",
       "snapshot": {
         "nodes": [
           { "id": "node-base-1", "type": "sticky", "data": { "label": "Initial suspect: John Doe" } },
           { "id": "node-base-2", "type": "text", "data": { "label": "Alibi DISPROVEN: Cinema ticket was forged" } },
           { "id": "node-contrib-3", "type": "link", "data": { "url": "https://cctv-logs.city/cam-4", "title": "CCTV Footage" } }
         ],
         "edges": [
           { "id": "e-base-1", "source": "node-base-1", "target": "node-base-2" },
           { "id": "e-contrib-2", "source": "node-base-2", "target": "node-contrib-3" }
         ]
       }
     }
     ```
     -> Expect `201 Created`, returns `{ id: "contrib-101" }`.
  4. **Visual Diff Inspection Assertions**:
     - Query `GET /api/contributions?boardId=board-parent-1`.
     - Assert `contrib-101` has `status: 'open'`.
     - Compute diff between `targetBoard.content` and `snapshot`:
       - `node-base-1`: Identified as **UNCHANGED**.
       - `node-base-2`: Identified as **MODIFIED** (`label` differed).
       - `node-contrib-3`: Identified as **ADDED**.
  5. **Unauthorized Merge Blocked**:
     - `UserB` calls `POST /api/contributions/contrib-101/merge` -> Expect `403 Forbidden` (only target board owner can merge).
  6. **Owner Merge Execution**:
     - `UserA` calls `POST /api/contributions/contrib-101/merge` -> Expect `200 OK`, `{ success: true, mergedNodesCount: 3 }`.
  7. **Verify Merged Board Content (`GET /api/boards/board-parent-1`)**:
     - Node count is 3.
     - `node-base-2` now reads: `"Alibi DISPROVEN: Cinema ticket was forged"`.
     - `node-contrib-3` is present.
     - Edges count is 2 (`e-base-1` and `e-contrib-2`).
  8. **Verify Contribution Status**:
     - `GET /api/contributions?boardId=board-parent-1` returns `contrib-101` with `status: 'merged'`.
  9. **Prevent Duplicate Merge**:
     - Calling `POST /api/contributions/contrib-101/merge` again -> Expect `400 Bad Request` (`"Already merged"`).

---

### Test Suite T3.5: Contribution Rejection & Immutability Flow
- **ID**: `T3.5-CONTRIBUTION-REJECT-IMMUTABLE`
- **Focus**: Verifies rejecting an invalid or conflicting contribution: target board content remains strictly unmodified, status transitions to `rejected`, and rejected contributions cannot be merged.
- **Execution Sequence**:
  1. `UserB` submits contribution `contrib-102` with spam/invalid nodes.
  2. `UserA` calls `POST /api/contributions/contrib-102/reject` -> Expect `200 OK`.
  3. Contribution status in DB is `'rejected'`.
  4. Target board content is verified via `GET /api/boards/board-parent-1` to be 100% identical to pre-submission state.
  5. `UserA` attempts `POST /api/contributions/contrib-102/merge` -> Expect `400 Bad Request` (`"Contribution is not open"`).

---

### Test Suite T3.6: End-to-End Reputation Award Chain
- **ID**: `T3.6-REPUTATION-CHAIN-POINTS`
- **Focus**: Verifies the cumulative points calculation and rank promotion across all gamified detective actions.
- **Preconditions**: Fresh users `Det1` and `Det2` with 0 initial points ("Patrol Officer").
- **Point Verification Steps**:
  1. **User Registration**: `getUserPoints(Det1.id)` -> Expect `0`. Rank: `"Patrol Officer"`.
  2. **Board Creation (+10 pts)**: `Det1` calls `POST /api/boards`.
     - DB check `user_reputation` for `Det1`: `points == 10`, `boardsCreated == 1`.
  3. **Publish Board (+5 pts)**: `Det1` calls `PUT /api/boards/[id]` setting `isPublic: true`.
     - DB check: `points == 15`.
  4. **Post Comment (+2 pts)**: `Det2` calls `POST /api/comments` on `Det1`'s public board.
     - DB check `Det2`: `points == 2`.
  5. **Fork Board (+10 pts)**: `Det2` calls `POST /api/boards` with `parentId: Det1.boardId`.
     - DB check `Det2`: `points == 12` ($2 + 10$), `boardsCreated == 1`.
  6. **Accepted Contribution (+25 pts)**: `Det2` submits contribution to `Det1`. `Det1` calls `POST .../merge`.
     - DB check `Det2`: `points == 37` ($12 + 25$), `contributionsAccepted == 1`.
  7. **Complete Bio/Profile (+15 pts)**: `Det2` updates bio and avatar via profile API.
     - DB check `Det2`: `points == 52` ($37 + 15$).
  8. **Rank Promotion Assertion**:
     - `Det2` points = 52. Threshold $\ge 50$ promotes `Det2` from `"Patrol Officer"` to **"Rookie Cop"**.
     - Verify `GET /api/me` returns `rank: "Rookie Cop"`.
  9. **Leaderboard Ordering Assertion**:
     - Query `GET /api/leaderboard`.
     - First place: `Det2` with 52 points, Rank 1.
     - Second place: `Det1` with 15 points, Rank 2.
     - User names and avatars joined and populated.

---

## 4. Tier 4 Test Specifications: Real-World Scenarios

### Test Suite T4.1: Real-World Multi-Detective Homicide Investigation
- **Scenario Title**: "The Blackwood Manor Mystery"
- **ID**: `T4.1-HOMICIDE-INVESTIGATION-WORKFLOW`
- **Focus**: Multi-actor collaborative investigation with simultaneous evidence gathering, red yarn string hypothesis mapping, comment-based forensics discussion, and RBAC lockdown.
- **Narrative & Entities**:
  - **Lead Investigator (Owner)**: Detective Vance (`id: vance-lead`)
  - **Forensics Specialist (Editor)**: Dr. Aris (`id: aris-forensics`)
  - **Rookie Scribe (Viewer)**: Officer Mills (`id: mills-scribe`)
  - **Crime Scene Board**: "The Blackwood Manor Mystery"
- **Step-by-Step Test Sequence**:
  1. **Board Creation & Initial Scene Setup**:
     - Vance creates board with Victim Node (Image: `blackwood-body.jpg`, caption: `"Lord Blackwood found at 0600 in library"`) and Crime Scene Node (Sticky: `"No signs of forced entry. Window latch unfastened."`).
     - Vance saves board (`PUT /api/boards/[id]`).
  2. **Forming the Task Force**:
     - Vance invites Dr. Aris as `'editor'`.
     - Vance invites Officer Mills as `'viewer'`.
  3. **Forensic Evidence Addition by Editor**:
     - Dr. Aris logs in and fetches board -> `200 OK`.
     - Dr. Aris adds:
       - Evidence Node 3 (Sticky): `"Toxicology report: Trace belladonna alkaloids in brandy snifter"`.
       - Suspect Node 4 (Text): `"Lord Blackwood's Nephew (Sole Beneficiary)"`.
       - String Edge connects Node 3 (toxicology) to Node 4 (nephew).
     - Dr. Aris saves board (`PUT /api/boards/[id]`) -> Expect `200 OK`.
  4. **Viewer Attempted Tampering Blocked**:
     - Officer Mills logs in, attempts `PUT /api/boards/[id]` with altered notes -> Expect `403 Forbidden`.
  5. **Collaborative Forensic Discussion via Comments**:
     - Officer Mills calls `POST /api/comments`:
       ```json
       {
         "boardId": "blackwood-manor-id",
         "nodeId": "node-3-tox",
         "content": "Pharmacy records show Nephew purchased belladonna tincture last Tuesday under an alias."
       }
       ```
       -> Expect `201 Created`.
     - Vance fetches comments `GET /api/comments?boardId=blackwood-manor-id&nodeId=node-3-tox`:
       - Assert comment is returned with author name `"Officer Mills"`.
  6. **Lead Detective Finalizes Hypotheses**:
     - Vance adds Link Node: `"https://city-archives.org/deeds/blackwood-will"` (Will & Testament).
     - Vance links Will to Nephew and saves.
  7. **Persistence Verification**:
     - Query DB directly for board `blackwood-manor-id`.
     - Verify: 5 total nodes, 2 string edges, 2 collaborators, 1 threaded comment, `isPublic: false`.

---

### Test Suite T4.2: Case Publication, Community Discovery, Starring & Scoped Search
- **Scenario Title**: "Public Board Community Discovery & Cold Case Crowdsourcing"
- **ID**: `T4.2-DISCOVERY-STAR-SEARCH`
- **Focus**: Transitioning private investigation to public, feed rendering in `/discover`, board starring, and search scoping (excluding soft-deleted and private records).
- **Actors**: Detective Vance (Owner), Detective Stone (Discovering Investigator).
- **Step-by-Step Test Sequence**:
  1. **Publication**:
     - Vance updates "The Blackwood Manor Mystery" setting `isPublic: true`.
     - Verified: `awardPoints(vance-lead, 'board_made_public')` called (+5 pts).
  2. **Public Discovery Feed**:
     - Detective Stone (or unauthenticated user) visits `GET /api/boards?isPublic=true` (or renders `/discover`).
     - Assert "The Blackwood Manor Mystery" appears in public feed.
     - Assert author name and avatar are rendered.
  3. **Board Starring**:
     - Detective Stone stars the board via `POST /api/boards/[id]/star` (or star toggle endpoint).
     - DB check: `boards.stars` incremented from 0 to 1.
     - Querying board returns `stars: 1`.
  4. **Scoped Global Search (`GET /api/search?q=Blackwood`)**:
     - Public user queries `q=Blackwood`:
       - Results include "The Blackwood Manor Mystery".
     - Vance creates private board "Blackwood Secret Wiretaps" (`isPublic: false`).
     - Public user queries `q=Blackwood`:
       - Returns ONLY the public board; "Blackwood Secret Wiretaps" is excluded.
     - Vance queries `q=Blackwood`:
       - Returns BOTH public board and Vance's own private board.
  5. **Soft-Delete Filtering in Search & Feeds**:
     - Vance soft-deletes "The Blackwood Manor Mystery" (`DELETE /api/boards/[id]` sets `deletedAt = NOW()`).
     - Query `GET /api/search?q=Blackwood`:
       - Zero results returned (`isNull(boards.deletedAt)` filter strictly enforced).
     - Query `GET /discover`:
       - Board no longer listed.

---

### Test Suite T4.3: High-Fidelity Multi-Format Case Dossier Export & Re-Import
- **Scenario Title**: "Courtroom Case Dossier Archival & Roundtrip Portability"
- **ID**: `T4.3-CASE-DOSSIER-EXPORT-ROUNDTRIP`
- **Focus**: Verifies exporting complex evidence boards to JSON, PNG, and PDF, and tests roundtrip portability (re-importing JSON onto a fresh canvas reconstitutes exact layout).
- **Test Type**: Utility & Canvas Roundtrip Integration
- **Execution Sequence**:
  1. **Prepare Complex Board**:
     - 4 nodes (Sticky, Text, Link, Image) with absolute coordinates, colors, and content.
     - 3 string edges with custom sag weights.
  2. **JSON Export Verification**:
     - Execute `exportToJSON(boardData)`.
     - Parse generated JSON payload:
       - Validate schema: `{ id, title, nodes: [...], edges: [...] }`.
       - Assert all 4 node IDs, positions, and nested data properties are preserved byte-for-byte.
       - Assert all 3 edges are preserved.
  3. **JSON Roundtrip Re-Import**:
     - Initialize empty board `board-fresh-new`.
     - Ingest exported JSON payload into `useStore.setNodes` and `useStore.setEdges`.
     - Save via `PUT /api/boards/board-fresh-new`.
     - Query `GET /api/boards/board-fresh-new`:
       - Compare deep equality with original board content.
       - Result: 100% parity in node count, types, coordinates, and edge connections.
  4. **PNG Image Export Verification**:
     - Mock DOM element representing ReactFlow canvas (dimensions $1920 \times 1080$).
     - Call `exportToPNG(canvasElement)`.
     - Assert `html2canvas` invoked with:
       - `backgroundColor: '#1c1917'`
       - `scale: 2` (retina resolution)
       - `useCORS: true`
     - Assert `saveAs` triggered with filename pattern `<title>-<timestamp>.png`.
  5. **PDF Document Dossier Verification**:
     - Call `exportToPDF(canvasElement)`.
     - Assert `jsPDF` constructor initialized with landscape orientation when width > height.
     - Assert generated PDF file saved with filename pattern `<title>-<timestamp>.pdf`.

---

### Test Suite T4.4: Version History Snapshotting, Rollback & Optimistic Lock Conflict Handling
- **Scenario Title**: "Accidental Evidence Deletion & Conflict Rollback"
- **ID**: `T4.4-VERSION-SNAPSHOT-CONFLICT-ROLLBACK`
- **Focus**: Snapshotting board milestones in `board_versions`, restoring previous states upon corruption, and validating optimistic lock conflict detection (`409 Conflict`) during simultaneous edits.
- **Actors**: Detective A (Lead), Detective B (Collaborator).
- **Execution Sequence**:
  1. **Milestone Version 1 Creation**:
     - Detective A populates board with 4 verified clues.
     - Calls `POST /api/boards/[id]/versions` with `{ content }` -> Creates Version 1 (`v1-id`).
  2. **Accidental Corrupt Edit**:
     - An errant edit deletes 3 of the 4 clues and clears all edges.
     - Corrupt board saved via `PUT /api/boards/[id]`.
     - Board currently has only 1 node.
  3. **Version Inspection**:
     - Detective A calls `GET /api/boards/[id]/versions`.
     - Expect array with 1 version record: `{ id: "v1-id", createdAt, createdBy: DetA.id, content: { nodes: [4 items] } }`.
  4. **Rollback Execution**:
     - Detective A selects Version 1 and triggers restore (`PUT /api/boards/[id]` with Version 1 content).
     - Query `GET /api/boards/[id]`:
       - Assert board content restored to exactly 4 nodes and all original edges.
  5. **Optimistic Locking Conflict Simulation (Feature 21 / `boards.version`)**:
     - Current board version in DB is `version = 5`.
     - Detective A loads board at version 5.
     - Detective B loads board at version 5.
     - Detective B saves new clue: `PUT /api/boards/[id]` with `{ content, version: 5 }`.
       - DB increments board `version` to 6 -> Expect `200 OK`.
     - Detective A attempts to save: `PUT /api/boards/[id]` with `{ content, version: 5 }` (stale version).
       - Backend checks: `currentVersion (6) !== submittedVersion (5)`.
       - Returns `409 Conflict` (`"Board has been modified by another detective. Please refresh to inspect latest changes."`).
     - Assert Detective B's work was NOT silently overwritten.

---

## 5. Test Implementation Guidelines & Runner Mapping

### 5.1 Test Framework Allocation
- **Vitest Integration Tests** (`tests/integration/`):
  - Best suited for T3.1, T3.3, T3.4 (API parts), T3.5, T3.6, T4.2 (API parts), T4.4 (API parts).
  - Direct HTTP request testing against route handlers with real or mocked Turso database.
- **Playwright Browser E2E Tests** (`tests/e2e/`):
  - Best suited for T3.2 (Canvas visual nodes & drag/drop), T3.4 (Visual diff modal UI), T4.1 (Full multi-user browser flow), T4.3 (Canvas export triggers).

### 5.2 Test Data Isolation Discipline
- All test fixtures must generate unique CUIDs or UUIDs for test users, boards, and nodes (e.g. prefix `t3_fork_`, `t4_homicide_`).
- In `afterEach` / `afterAll`, teardown routines must cascade-delete created test boards and user reputation rows.

---

## 6. Verification & Quality Matrix

| Test Suite ID | Scenario / Feature | Expected Status Codes | Key DB Verification | Key UI Verification |
|---|---|---|---|---|
| `T3.1` | Forking & Lineage | `201`, `200` | `boards.parentId == parent.id` | "Fork" badge, "Suggest Changes" btn |
| `T3.2` | Sticky & Link Nodes | `200`, `201` | Nodes JSON array in `boards.content` | Sticky paper + Link card rendered |
| `T3.3` | Collaborator RBAC | `201`, `400`, `403` | `board_collaborators` rows | Role badges, Edit/View restrictions |
| `T3.4` | Contribution Diff & Merge | `201`, `200`, `403` | `contributions.status = 'merged'` | Green/Amber/Stone diff badges |
| `T3.5` | Contribution Reject | `200`, `400` | `contributions.status = 'rejected'` | Board content remains identical |
| `T3.6` | Reputation Chain | `200`, `201` | `user_reputation.points` matches sum | Leaderboard rank & profile badge |
| `T4.1` | Homicide Investigation | `200`, `201`, `403` | Multi-user nodes & comments in DB | Threaded node comment cards |
| `T4.2` | Discovery & Starring | `200`, `404` | `boards.stars` increment, `deletedAt` filter | Discover grid, Star counter |
| `T4.3` | Multi-Format Export | `200` (client action) | Deep equality on JSON roundtrip | Download trigger, Canvas scale 2x |
| `T4.4` | Rollback & Optimistic Lock | `200`, `201`, `409` | `board_versions` rows, `version` bump | "Restore" action, Conflict prompt |

---

## 7. Conclusion & Next Steps

This exploration concludes that all Tier 3 and Tier 4 interaction scenarios are mathematically and architecturally specified. Test implementers have complete API payloads, assertion checklists, RBAC matrices, and sequence steps ready to transcribe into Vitest and Playwright test suites.
