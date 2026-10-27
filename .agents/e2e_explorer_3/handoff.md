# Handoff Report — Explorer 3: Tier 3 & Tier 4 E2E Test Specifications

## 1. Observation
1. **Case Forking & Lineage**:
   - `src/app/api/boards/route.ts:17-31`: `POST /api/boards` extracts `const { title, isPublic, content, parentId } = body;` and persists `parentId: parentId || null` in the `boards` table.
   - `src/components/Board.tsx:356-366`: Renders the "Suggest Changes" button (`<GitPullRequest />`) if and only if `parentId && !isReadOnly`. If `!parentId`, it renders "Review Suggestions" with `pendingContributionCount`.
   - `src/components/dashboard/BoardCard.tsx:73-77`: Checks `board.parentId` and conditionally renders the `Fork` badge.
2. **Collaborators & RBAC Enforcement**:
   - `src/app/api/boards/[id]/route.ts:31-36`: Verifies `isOwner = board.userId === session.user.id` and `isEditor = collaborator && (collaborator.role === 'editor' || collaborator.role === 'owner')`. Throws 403 Forbidden on `PUT` if neither.
   - `src/app/api/boards/[id]/collaborators/route.ts:67-69`: Verifies `if (board[0].userId !== session.user.id) return NextResponse.json({ error: 'Forbidden: Only board owner can add collaborators' }, { status: 403 });`.
   - `src/app/api/boards/[id]/versions/route.ts:97-99`: Rejects version creation with 403 unless `isOwner` or `collab[0].role === 'editor' || collab[0].role === 'owner'`.
3. **Contribution Lifecycle & Smart Merge**:
   - `src/app/api/contributions/route.ts:51-63`: Accepts `{ targetBoardId, message, snapshot }`, defaults status to `'open'`, and enforces rate limiting (`checkRateLimit('contribution:${userId}', 10, 3600000)`).
   - `src/app/api/contributions/[id]/merge/route.ts:41-43`: Requires `targetBoard.userId === session.user.id`.
   - `src/app/api/contributions/[id]/merge/route.ts:60-87`: Implements node union where snapshot node IDs overwrite target nodes while preserving target-only nodes, and merges edges by unique edge ID.
   - `src/app/api/contributions/[id]/merge/route.ts:94-96`: Updates `contributions.status` to `'merged'`.
   - *Observation of gap*: `awardPoints(contribution.userId, 'contribution_accepted')` is not yet called in `merge/route.ts` (tracked under Feature 26 in `PROJECT.md`).
4. **Reputation Points & Rank Thresholds**:
   - `src/lib/reputation.ts:5-18`: Defines points for `board_created: 10`, `board_made_public: 5`, `board_shared: 3`, `comment_posted: 2`, `profile_completed: 15`.
   - `PROJECT.md:87-96`: Specifies `contribution_accepted: 25` and unified ranks (`Chief Detective` 1000+, `Senior Investigator` 500+, `Private Eye` 200+, `Rookie Cop` 50+, `Patrol Officer` <50).
5. **Real-World Investigation Workflow Components**:
   - `src/components/VersionHistory.tsx:27-42`: Fetches `/api/boards/${boardId}/versions` and restores previous versions via `onRestore?.(version.content)`.
   - `src/lib/export.ts:13-57`: Implements `exportToJSON`, `exportToPNG` (using `html2canvas` at 2x scale with `#1c1917` background), and `exportToPDF` (using `jsPDF`).
   - `src/app/api/search/route.ts:25` & `src/lib/search.ts:50-64`: Filters `isNull(boards.deletedAt)` and limits non-owners to `isPublic == true`.

## 2. Logic Chain
1. By inspecting the API routes (`/api/boards`, `/api/boards/[id]/collaborators`, `/api/contributions`, `/api/comments`, `/api/search`), we established the exact request schemas, authorization rules, and status codes (200, 201, 400, 401, 403, 404, 409).
2. By tracing the case forking flow from `POST /api/boards` through `Board.tsx`, we determined that a forked board maintains lineage via `parentId`, which activates the "Suggest Changes" workflow to proposal snapshots back to `parentId`.
3. By inspecting the collaborator route and permissions checks, we mapped out a 6-role permission matrix across 12 board actions, defining the exact boundaries where 403 Forbidden must be asserted.
4. By analyzing `merge/route.ts` and `reputation.ts`, we designed the complete lifecycle test from proposal, visual diff (added, modified, unchanged), smart merge, and reputation award (+25 pts) causing user rank promotion (e.g. crossing 50 pts to "Rookie Cop").
5. By analyzing `export.ts`, `VersionHistory.tsx`, `search.ts`, and `Board.tsx`, we constructed four end-to-end real-world scenarios:
   - T4.1: Multi-detective homicide investigation (Lead + Forensics + Scribe).
   - T4.2: Public board discovery, starring, and scoped search.
   - T4.3: High-fidelity multi-format case export (JSON, PNG, PDF) with roundtrip JSON re-import.
   - T4.4: Version snapshotting, rollback, and optimistic locking conflict detection.

## 3. Caveats
1. `src/lib/auth-checks.ts` (`getBoardAccess`) is planned under Milestone M2; current route handlers perform inline permission checks. Test specifications are designed against the standard contract so they pass regardless of whether authorization is checked inline or via `getBoardAccess`.
2. `awardPoints(contribution.userId, 'contribution_accepted')` (+25 points) is scheduled to be wired in Milestone M4 (Feature 26). The test specification in T3.6 defines the exact assertion once Feature 26 is landed.
3. Optimistic concurrency locking (HTTP 409 Conflict on stale board `version`) is specified in T4.4 according to Feature 21 (`boards.version` column from M1/M3).
4. No other caveats.

## 4. Conclusion
Tier 3 (Cross-Feature Interactions) and Tier 4 (Real-World Scenarios) specifications are 100% defined and documented in `/Users/hardikrawat/Documents/the-case-file/.agents/e2e_explorer_3/report.md`.
The specifications contain 6 Tier 3 test suites (`T3.1` to `T3.6`) and 4 Tier 4 real-world scenario test suites (`T4.1` to `T4.4`), each equipped with:
- Exact API call sequences and JSON payloads
- Step-by-step role authentication context
- Database mutation assertions
- UI element and state assertions
- Expected HTTP status codes and error responses

## 5. Verification Method
1. **Report Content Inspection**:
   - Inspect `/Users/hardikrawat/Documents/the-case-file/.agents/e2e_explorer_3/report.md`.
   - Verify sections 1 through 7 match the requirements of `ORIGINAL_REQUEST.md`, `PROJECT.md`, and `SCOPE.md`.
2. **Typecheck & Lint Validation**:
   - Run `npm run lint` or inspect TypeScript models in `src/lib/types.ts` and `src/lib/schema.ts` to confirm data structure compatibility.
3. **Invalidation Conditions**:
   - If `boards.parentId` is removed or renamed in `src/lib/schema.ts`, T3.1 and T3.4 specifications would need revision.
   - If the reputation point thresholds change from `PROJECT.md` (e.g. 50 pts for Rookie Cop), T3.6 points summation assertions would need updating.
