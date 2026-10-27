# Forensic Survey & Implementation Plan: Canvas Evidence Board (R3) & Detective Reputation, Collaboration, and Lineage (R4)

**Explorer**: Explorer Survey 3  
**Working Directory**: `/Users/hardikrawat/Documents/the-case-file/.agents/teamwork_preview_explorer_survey_3`  
**Target Scope**: R3 (Canvas Evidence Board & UI Component Wiring) and R4 (Reputation, Collaboration & Lineage)  
**Date**: 2026-09-04  

---

## 1. Observation

Direct code observations, verbatim compiler/test outputs, file paths, line numbers, and commit histories gathered during read-only investigation.

### 1.1 Reference Documentation & Git History Analysis
- Search for `gap_analysis_report.md` and `bug_analysis_report.md` using `find /Users/hardikrawat/Documents/the-case-file -name "*gap_analysis*" -o -name "*bug_analysis*"` returned `0 results`. Neither file exists on disk.
- Git history reveals commits:
  - `260bcec` *Merge pull request #2 from hardikrawat/improved-linking-functionality-in-board-editor*
  - `c358c21` *improved readme.md file & added screenshots of the application*
  - `6bd924d` *removed dead test case and dead dev code*
  - `d0a4e8d` *improved linking functionality in the board editor*
- Commit `6bd924d` stripped `connectMode`, `toggleConnectMode`, `sourceNodeId`, and `setSourceNodeId` out of `src/store/useStore.ts` and `src/components/ui/Toolbar.tsx`, but left them in `src/components/Board.tsx` (lines 64–66).
- Running `npm run build` immediately fails with:
  ```
  Failed to compile.
  ./src/components/Board.tsx:64:51
  Type error: Property 'connectMode' does not exist on type 'RFState'.
    62 | const onConnect = useStore((state) => state.onConnect);
    63 | const theme = useStore((state) => state.theme);
  > 64 | const connectMode = useStore((state) => state.connectMode);
       |                                               ^
    65 | const sourceNodeId = useStore((state) => state.sourceNodeId);
    66 | const setSourceNodeId = useStore((state) => state.setSourceNodeId);
    67 | const setEdges = useStore((state) => state.setEdges);
  ```
- Running `npx tsc --noEmit` fails with 11 errors across `Board.tsx`, `useStore.test.ts`, `Toolbar.test.tsx`, `tests/integration/boards.test.ts`, and `tests/integration/comments.test.ts`.

---

### 1.2 Canvas Evidence Board & Evidence Node Types (`src/components/...`)
- **Missing Link Node**:
  - `src/components/nodes/LinkNode.tsx` does NOT exist.
  - `src/components/Board.tsx` lines 34–39:
    ```typescript
    const nodeTypes = {
        sticky: StickyNoteNode,
        image: ImageNode,
        text: TextNode,
        article: ArticleNode,
    };
    ```
    No `link` node registered.
  - `src/components/ui/Toolbar.tsx` lines 167–170:
    ```tsx
    <button onClick={addSticky} ...>Sticky</button>
    <button onClick={addText} ...>Text</button>
    <button onClick={addImage} ...>Image</button>
    <button onClick={addArticle} ...>Article</button>
    ```
    No `addLink` function or Link button exists.
  - `src/components/dashboard/ContributionModal.tsx` line 166:
    ```tsx
    nodeTypes={{ sticky: StickyNoteNode, image: ImageNode, text: TextNode, article: ArticleNode }}
    ```
    Missing `link` node type here as well.
- **Node Deletion**:
  - `src/components/nodes/StickyNoteNode.tsx`, `TextNode.tsx`, `ImageNode.tsx`, `ArticleNode.tsx`: None of the node components have a delete button, trash icon, or deletion callback.
  - `src/components/Board.tsx` lines 405–421: `<ReactFlow>` does not provide `onNodesDelete`, `onEdgesDelete`, or delete key bindings.
  - `src/store/useStore.ts` line 124:
    ```typescript
    deleteNode: (id) =>
        set({
            nodes: get().nodes.filter((node) => node.id !== id),
            edges: get().edges.filter(
                (edge) => edge.source !== id && edge.target !== id
            ),
        }),
    ```
    `deleteNode` is defined in `useStore.ts` and tested in `useStore.test.ts`, but grep confirms it is NEVER called anywhere in `src/components/`.
  - In `src/store/useStore.ts` lines 104–108:
    ```typescript
    onNodesChange: (changes: NodeChange[]) => {
        set({
            nodes: applyNodeChanges(changes, get().nodes),
        });
    },
    ```
    When ReactFlow removes a node via keyboard shortcut, `applyNodeChanges` deletes the node from `nodes` but leaves connected edges in `edges` untouched, creating dangling edges with non-existent source/target handles.
- **Red String Physics & Texture**:
  - `src/app/layout.tsx` lines 31–48 defines an SVG filter `<filter id="yarn-texture">` with `feTurbulence`, `feDisplacementMap`, `feGaussianBlur`, and `feComposite`.
  - `src/components/edges/StringEdge.tsx` lines 19–22:
    ```typescript
    const midX = (sourceX + targetX) / 2;
    const midY = (sourceY + targetY) / 2 + Math.abs(targetX - sourceX) * 0.12; // Natural dip based on distance
    const edgePath = `M ${sourceX},${sourceY} Q ${midX},${midY} ${targetX},${targetY}`;
    ```
    Calculates gravity dip via quadratic curve.
- **String Cutting State De-synchronization**:
  - `src/components/edges/StringEdge.tsx` lines 15, 26–29:
    ```typescript
    const { setEdges } = useReactFlow();
    ...
    const onEdgeClick = (evt: React.MouseEvent) => {
        evt.stopPropagation();
        setEdges((edges) => edges.filter((e) => e.id !== id));
    };
    ```
  - Calling `useReactFlow().setEdges` updates ReactFlow's local component state but DOES NOT update `useStore.getState().edges`.
  - In `src/components/Board.tsx` line 155:
    ```typescript
    const content = { nodes, edges };
    const res = await fetch(`/api/boards/${boardId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
    });
    ```
    `Board.tsx` reads `edges` from `useStore`. The cut string is NOT removed from `useStore.edges`, so saving the board or re-rendering resurrects the cut string.

---

### 1.3 Zustand Store & Cross-Board State Bleeding (`src/store/useStore.ts`)
- **Single Global LocalStorage Key**:
  `src/store/useStore.ts` lines 134–147:
  ```typescript
  persist(
      (set, get) => ({ ... }),
      {
          name: 'case-file-storage',
          storage: safeStorage as never,
          partialize: (state) => ({
              nodes: state.nodes,
              edges: state.edges,
              theme: state.theme,
              activeColor: state.activeColor,
              boardTitle: state.boardTitle,
              isPublic: state.isPublic,
              parentId: state.parentId,
          }),
      }
  )
  ```
  - The store persists board-specific canvas content (`nodes`, `edges`, `boardTitle`, `parentId`) into a single global key `'case-file-storage'`.
  - It does NOT track `boardId` in the store or in `partialize`.
- **Stale Board Data Bleed on Navigation**:
  In `src/components/Board.tsx` lines 92–104:
  ```typescript
  const fetchBoard = useCallback(async () => {
      setIsBoardLoading(true);
      try {
          const res = await fetch(`/api/boards/${boardId}`);
          if (res.ok) {
              const data = await res.json();
              if (data.content) {
                  setNodes(data.content.nodes || []);
                  setEdges(data.content.edges || []);
              }
              setBoardMetadata(data.title, data.isPublic, data.parentId);
  ```
  - When switching from Board 1 to Board 2:
    1. Board 1's nodes and edges remain in Zustand in-memory state and in `localStorage['case-file-storage']`.
    2. Board 2 mounts and immediately renders Board 1's nodes and edges.
    3. If Board 2 is empty (`data.content` is null, undefined, or `{}`), `data.content.nodes` check evaluates to false; `setNodes` is NOT CALLED! Board 2 permanently adopts Board 1's evidence!
    4. There is no `resetBoard()` or cleanup on unmount/mount.
- **SafeStorage TypeErrors**:
  In `src/store/useStore.ts` lines 39–71:
  ```typescript
  const safeStorage = {
      getItem: (name: string) => {
          if (typeof window === 'undefined') return null;
          ...
      },
      setItem: (name: string, value: unknown) => {
          if (typeof window === 'undefined') return;
          try {
              localStorage.setItem(name, JSON.stringify(value));
          } catch (e) { ... }
      }
  };
  ```
  Running unit tests outputs:
  `SafeStorage: Unexpected error during save TypeError: Cannot read properties of undefined (reading 'setItem')`
  It checks `typeof window === 'undefined'`, but does not check `typeof localStorage === 'undefined'`.
- **Missing Auto-Save & Optimistic Locking**:
  - `src/components/Board.tsx` lines 151–172: Only manual save via `handleSave`. No auto-save debouncing.
  - `src/app/api/boards/[id]/route.ts` lines 7–59: `PUT` handler does not check `updatedAt` or version numbers. Concurrent updates silently overwrite each other.

---

### 1.4 Orphaned UI Panels
Search across `src/` confirms four critical panels are defined but never mounted or imported anywhere outside their respective files:

1. **`CommentsPanel`** (`src/components/CommentsPanel.tsx`):
   - Defined at `src/components/CommentsPanel.tsx`, lines 20–139.
   - Grep search for `CommentsPanel`: only found in `CommentsPanel.tsx`. Zero imports across `Board.tsx`, `app/(authenticated)/...`, or any other component.
   - Props required: `boardId: string`, `nodeId?: string | null`.
   - API issue: `GET /api/comments` (`src/app/api/comments/route.ts` lines 40–45) performs `select().from(comments)` without joining `users`. As a result, `comment.userName` is always undefined and all comments render as "Anonymous" (line 109).
   - Reputation issue: `POST /api/comments` lines 86–97 inserts into `comments` but never calls `awardPoints`.
2. **`CollaboratorsPanel`** (`src/components/CollaboratorsPanel.tsx`):
   - Defined at `src/components/CollaboratorsPanel.tsx`, lines 21–211.
   - Grep search for `CollaboratorsPanel`: only found in `CollaboratorsPanel.tsx`. Zero imports across `Board.tsx` or any other component.
   - Props required: `boardId: string`, `isOwner: boolean`.
   - Critical API Contract Mismatch:
     - `CollaboratorsPanel.tsx` line 50 sends:
       `body: JSON.stringify({ userEmail: newEmail, role: newRole })`
     - `src/app/api/boards/[id]/collaborators/route.ts` lines 9–12:
       ```typescript
       const addCollaboratorSchema = z.object({
           userId: z.string().min(1, 'User ID is required'),
           role: z.enum(['viewer', 'editor', 'owner']).default('viewer'),
       });
       ```
       Validation immediately rejects with `400 Bad Request` ("User ID is required"). The endpoint does not look up users by email!
   - Missing Deletion Route:
     - `CollaboratorsPanel.tsx` line 70 sends:
       `fetch('/api/boards/${boardId}/collaborators/${collaboratorId}', { method: 'DELETE' })`
     - There is NO file `src/app/api/boards/[id]/collaborators/[collaboratorId]/route.ts` and NO `DELETE` method in `boards/[id]/collaborators/route.ts`. The request returns `404 Not Found`.
3. **`VersionHistory`** (`src/components/VersionHistory.tsx`):
   - Defined at `src/components/VersionHistory.tsx`, lines 18–136.
   - Grep search for `VersionHistory`: zero imports across `Board.tsx`.
   - Props required: `boardId: string`, `onRestore?: (content: string) => void`.
   - Database issue: `src/app/api/boards/[id]/route.ts` line 50 updates `boards` but never inserts a record into `boardVersions`. Hence `GET /api/boards/[id]/versions` returns an empty array `[]` and version history is permanently blank.
4. **`ExportModal`** (`src/components/ExportModal.tsx`):
   - Defined at `src/components/ExportModal.tsx`, lines 16–132.
   - Grep search for `ExportModal`: zero imports across `Board.tsx`.
   - Props required: `isOpen: boolean`, `onClose: () => void`, `boardId: string`, `boardData: Record<string, unknown>`, `boardElement?: HTMLElement`.
   - `src/lib/export.ts` implements `exportToJSON`, `exportToPNG`, and `exportToPDF` via `html2canvas` and `jspdf`.
   - Disconnected: `Toolbar.tsx` lines 95–105 directly creates a raw JSON file download, completely bypassing `ExportModal` and preventing PNG/PDF exports.

---

### 1.5 Reputation System (`src/lib/reputation.ts`, Leaderboard, Profile)
- **100% Dead Code in `src/lib/reputation.ts`**:
  - `awardPoints` (lines 23–64), `updateBoardCount` (lines 69–98), `getUserPoints` (lines 103–115), and `getUserRank` (lines 120–132) are NEVER called anywhere in the codebase.
  - Grep search across `src/` for `awardPoints`, `updateBoardCount`, `getUserPoints`, `getUserRank`: only matches are inside `src/lib/reputation.ts` itself.
- **Unwired Trigger Points**:
  - `POST /api/boards/route.ts` lines 21–33: Inserting a board does not call `awardPoints(session.user.id, 'board_created')` or `updateBoardCount`.
  - `PUT /api/boards/[id]/route.ts` lines 45–53: Setting `isPublic: true` does not call `awardPoints(session.user.id, 'board_made_public')`.
  - `POST /api/comments/route.ts` line 86: Adding a comment does not call `awardPoints(session.user.id, 'comment_posted')`.
  - `POST /api/contributions/[id]/merge/route.ts` line 90: Merging a contribution does not award points to `contribution.userId` and does not increment `contributionsAccepted`.
  - `ReputationAction` enum in `src/lib/reputation.ts` line 5 does NOT include `contribution_accepted` or `contribution_merged`.
- **Leaderboard Missing User Joins**:
  - `src/app/api/leaderboard/route.ts` lines 12–15:
    ```typescript
    const leaders = await db.select()
        .from(userReputation)
        .orderBy(desc(userReputation.points))
        .limit(Math.min(limit, 50));
    ```
    Does not join `users` table.
  - `src/app/(authenticated)/leaderboard/page.tsx` line 65:
    Renders `Detective #{entry.userId.slice(0, 8)}` because names are missing.
- **Rank Title Discrepancies**:
  - `src/hooks/useUser.ts` (lines 33–40) and `src/app/(authenticated)/profile/[id]/page.tsx` (lines 113–119) duplicate hardcoded rank tiers:
    `Chief Detective` (1000+), `Senior Investigator` (500+), `Private Eye` (200+), `Rookie Cop` (50+), `Patrol Officer` (<50).
  - Not unified with `src/lib/reputation.ts`.

---

### 1.6 Collaborator Management, Lineage & Contributions
- **Collaborator Management**:
  - `src/app/api/boards/[id]/collaborators/route.ts`: Only supports `GET` and `POST`. No email lookup; requires raw `userId`. No `DELETE` handler. No role change (`PUT`/`PATCH`) handler.
- **Lineage for Forked Cases**:
  - `src/components/dashboard/BoardCard.tsx` line 74: Shows generic `<Copy /> Fork` pill if `board.parentId` exists, but has no parent title, author, or link to the parent case.
  - `src/components/Board.tsx` line 356: Only renders a small `GitPullRequest` icon button for suggesting changes. No banner, parent title, or lineage breadcrumbs are displayed.
  - `GET /api/boards/[id]` does not return parent case metadata (parent title, parent author).
- **Contribution Visual Diff & Merge Execution**:
  - `src/components/dashboard/ContributionModal.tsx` lines 163–175:
    Preview renders only `previewContribution.snapshot.nodes` and `edges`. It does NOT diff against the target board's current nodes/edges. Added, modified, and unchanged nodes look identical.
  - `ContributionModal.tsx` line 273: Displays `User {c.userId.slice(0, 5)}...` because `GET /api/contributions` does not join `users` table.
  - `POST /api/contributions/[id]/merge/route.ts`: Performs node union/replacement, but fails to award reputation points to the contributor, fails to increment `contributionsAccepted`, and fails to create a version snapshot in `boardVersions`.

---

## 2. Logic Chain

1. **Build Failure Chain**:
   - `6bd924d` removed `connectMode`, `sourceNodeId`, and `setSourceNodeId` from `src/store/useStore.ts`.
   - `src/components/Board.tsx` lines 64–66 still accesses `state.connectMode`, `state.sourceNodeId`, `state.setSourceNodeId`.
   - TypeScript compiler (`tsc` and Next.js build) verifies types across components.
   - Therefore, `npm run build` fails at `./src/components/Board.tsx:64:51` with `Property 'connectMode' does not exist on type 'RFState'`.

2. **Node Types Incompleteness Chain**:
   - Original Request specifies: "Canvas supports 5 evidence node types: Sticky Notes, Text, Images, Articles, and Links."
   - File system check proves `LinkNode.tsx` does not exist.
   - `Board.tsx`, `Toolbar.tsx`, and `ContributionModal.tsx` only define/render four types.
   - Therefore, Link Node is completely absent from both UI and canvas renderer.

3. **String Cutting Resurfacing Chain**:
   - In `StringEdge.tsx`, edge cutting calls `const { setEdges } = useReactFlow(); setEdges(...)`.
   - ReactFlow's internal state is updated, but ReactFlow is controlled in `Board.tsx` with `edges={edges}` from `useStore`.
   - `useStore.getState().edges` is never updated by `useReactFlow().setEdges`.
   - When `Board.tsx` saves (`handleSave`), it reads `useStore`'s `edges`.
   - Therefore, cut strings are saved back to the database and reappear upon reload.

4. **Cross-Board Contamination Chain**:
   - `useStore.ts` uses Zustand's `persist` middleware with static key `'case-file-storage'`.
   - When a user opens Board A, all nodes and edges are stored in `'case-file-storage'`.
   - Navigating to Board B initializes the Zustand store from `'case-file-storage'`.
   - If Board B has no content, `fetchBoard`'s `if (data.content)` evaluates false and skips `setNodes`/`setEdges`.
   - Therefore, Board B displays Board A's nodes and edges, and if auto-saved or saved manually, permanently overwrites Board B with Board A's evidence.

5. **Collaborator Management Broken Contract Chain**:
   - `CollaboratorsPanel.tsx` form collects `newEmail` and sends `{ userEmail: newEmail, role: newRole }` to `POST /api/boards/[id]/collaborators`.
   - `boards/[id]/collaborators/route.ts` validates `{ userId: z.string().min(1), role: ... }`.
   - Zod validation fails because `userId` is missing.
   - On removal, `CollaboratorsPanel.tsx` sends `DELETE /api/boards/[id]/collaborators/[collaboratorId]`, which matches no route handler (404).
   - Therefore, neither adding nor removing collaborators can succeed in the application.

6. **Reputation Deadlock Chain**:
   - `src/lib/reputation.ts` contains database logic for awarding points and updating stats.
   - None of the route handlers (`boards`, `comments`, `contributions`) import or call `awardPoints`.
   - All users remain at 0 points and lowest rank.
   - Leaderboard API fetches raw `userReputation` records without joining `users`, outputting `Detective #<id>`.
   - Therefore, the entire gamification and reputation engine is non-functional.

---

## 3. Caveats

- **Turso DB / Database Persistence (R1) and Auth / Security (R2)** are being surveyed concurrently by Explorer 1 and Explorer 2. The persistence and authentication assumptions here rely on remote Turso LibSQL and NextAuth session `user.id`.
- **Alternative Interpretations Considered**:
  - *Should boards be kept in localStorage at all?* Since The Case File is an authenticated web application backed by Turso DB, storing board nodes/edges in localStorage is redundant and is the primary driver of cross-board state contamination. LocalStorage should only persist UI preferences (theme, activeColor), while board data should be strictly fetched from and saved to the backend per board ID.
  - *Diff presentation in ContributionModal*: A side-by-side or colored overlay diff (highlighting added nodes in green, modified in amber, unchanged in muted opacity) provides clear visual feedback without requiring two full canvas viewports.

---

## 4. Conclusion

The codebase suffers from several critical architectural breaks, missing modules, and broken contracts in R3 and R4:
1. **Compilation Blocker**: Build failure due to missing `connectMode` in `RFState`.
2. **Missing Component**: `LinkNode.tsx` does not exist; Toolbar has no Link tool.
3. **Ghost Edges & String Reappearance**: Node deletion leaves dangling edges; string cutting bypasses Zustand.
4. **State Contamination**: Global localStorage persistence bleeds previous board data into newly opened boards.
5. **Orphaned Panels**: `CommentsPanel`, `CollaboratorsPanel`, `VersionHistory`, and `ExportModal` are unmounted, and their backend API contracts are mismatched or missing.
6. **Reputation Inactivity**: `src/lib/reputation.ts` is 100% disconnected; no actions update user points.
7. **Lineage & Diff Gaps**: Forked cases lack parent metadata; contribution modal lacks visual diff.

---

## 5. Implementation & Remediation Plan

### Step 1: Fix Type Errors & Restore Store Connection Mode (`useStore.ts`, `Board.tsx`)
- In `src/store/useStore.ts`:
  - Add to `RFState`:
    ```typescript
    connectMode: boolean;
    toggleConnectMode: () => void;
    sourceNodeId: string | null;
    setSourceNodeId: (id: string | null) => void;
    currentBoardId: string | null;
    resetBoard: (boardId?: string | null) => void;
    deleteEdge: (edgeId: string) => void;
    ```
  - Implement these in `useStore`:
    - `connectMode: false`, `toggleConnectMode: () => set({ connectMode: !get().connectMode, sourceNodeId: null })`
    - `sourceNodeId: null`, `setSourceNodeId: (id) => set({ sourceNodeId: id })`
    - `deleteEdge: (id) => set({ edges: get().edges.filter(e => e.id !== id) })`
    - `resetBoard: (boardId) => set({ currentBoardId: boardId || null, nodes: [], edges: [], boardTitle: 'Untitled Case', parentId: null, isPublic: false })`
  - In `persist` middleware: remove `nodes`, `edges`, `boardTitle`, `parentId`, `isPublic` from `partialize`. Only persist `{ theme, activeColor }`.
  - Fix `safeStorage`: add `typeof localStorage !== 'undefined'` guard before accessing `localStorage.setItem` and `getItem`.
- In `src/components/ui/Toolbar.tsx`:
  - Add Connect Mode toggle button with icon `<Link size={18} />`.

### Step 2: Implement Link Node & Wire Node Types
- Create `src/components/nodes/LinkNode.tsx`:
  - Detective aesthetic (thumb-tack, slight rotation, label/title, URL input, favicon/external link icon, clickable external anchor with `rel="noopener noreferrer"`).
  - Handles for string connections at top center (`type="target"` and `type="source"`).
  - Read-only support (`data.isReadOnly`).
  - Delete button on hover/selection (calls `deleteNode(id)`).
- Update `src/components/Board.tsx` & `src/components/dashboard/ContributionModal.tsx`:
  - Import `LinkNode` and add `link: LinkNode` to `nodeTypes`.
- Update `src/components/ui/Toolbar.tsx`:
  - Add `addLink` method and "Link" button.
- Update `StickyNoteNode`, `TextNode`, `ImageNode`, `ArticleNode`:
  - Add delete button (`X` or `Trash2`) visible on hover or selection when not `isReadOnly`.
- In `Board.tsx`:
  - Provide `onNodesDelete={(deleted) => { const deletedIds = new Set(deleted.map(n => n.id)); setEdges(edges.filter(e => !deletedIds.has(e.source) && !deletedIds.has(e.target))); }}`.

### Step 3: Fix String Edge Cutting
- In `src/components/edges/StringEdge.tsx`:
  - Import `useStore` from `@/store/useStore`.
  - In `onEdgeClick`:
    ```typescript
    const onEdgeClick = (evt: React.MouseEvent) => {
        evt.stopPropagation();
        useStore.getState().deleteEdge(id);
    };
    ```

### Step 4: Clean Board State Isolation & Auto-Saving with Optimistic Locking
- In `src/components/Board.tsx`:
  - In `useEffect` on `boardId`:
    Call `useStore.getState().resetBoard(boardId)` immediately before initiating `fetchBoard()`.
  - In `fetchBoard`:
    Ensure `setNodes(data.content?.nodes || [])` and `setEdges(data.content?.edges || [])` always execute.
  - Add debounced auto-save (e.g. 2000ms after nodes/edges change when not `isReadOnly` and `lastSaved` is initialized).
- In `src/app/api/boards/[id]/route.ts`:
  - Accept `lastModified` / `updatedAt` in `PUT`.
  - Check `if (board.updatedAt && body.updatedAt && new Date(board.updatedAt).getTime() > new Date(body.updatedAt).getTime())` -> return `409 Conflict`.
  - Create a version snapshot in `boardVersions` on save.
  - Implement `DELETE` handler for board deletion.

### Step 5: Mount and Wire All Orphaned Panels
- In `src/components/Board.tsx`:
  - Import `CommentsPanel`, `CollaboratorsPanel`, `VersionHistory`, and `ExportModal`.
  - Maintain open states: `isCommentsOpen`, `isCollaboratorsOpen`, `isHistoryOpen`, `isExportOpen`.
  - Add header buttons for:
    - 💬 Comments (shows unread/comment count)
    - 👥 Team / Collaborators (shows collaborator count)
    - 🕒 History (Version History)
    - 📥 Export (Export Modal)
  - Mount panels:
    ```tsx
    <CommentsPanel boardId={boardId} isOpen={isCommentsOpen} onClose={() => setIsCommentsOpen(false)} />
    <CollaboratorsPanel boardId={boardId} isOwner={!isReadOnly && session?.user?.id === boardOwnerId} isOpen={isCollaboratorsOpen} onClose={() => setIsCollaboratorsOpen(false)} />
    <VersionHistory boardId={boardId} isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} onRestore={(content) => { setNodes(content.nodes || []); setEdges(content.edges || []); }} />
    <ExportModal isOpen={isExportOpen} onClose={() => setIsExportOpen(false)} boardId={boardId} boardData={{ title: boardTitle, nodes, edges }} boardElement={boardContainerRef.current} />
    ```
- Fix Panel Backend APIs:
  - In `src/app/api/comments/route.ts`:
    Join `users` table on `comments.userId = users.id` to return `userName: users.name` and `userImage: users.image`.
    In `POST`, call `awardPoints(session.user.id, 'comment_posted')`.
  - In `src/app/api/boards/[id]/collaborators/route.ts`:
    Update `POST` schema to accept `{ userEmail: z.string().email(), role: z.enum(...) }` OR `{ userId: z.string() }`. Look up user by email if provided.
    Add `DELETE` method to remove collaborator by `collaboratorId` or `userId`.
    Add `PATCH` method to update collaborator role (`viewer` <-> `editor`).
  - In `src/app/api/boards/[id]/versions/route.ts`:
    Ensure versions are retrieved with user details and sorted chronologically descending.
  - In `src/components/ui/Toolbar.tsx`:
    Update Export button to trigger `onOpenExportModal` instead of raw download.

### Step 6: Wire Detective Reputation Engine
- In `src/lib/reputation.ts`:
  - Extend `ReputationAction` to include `'contribution_accepted' | 'contribution_merged'`.
  - Points: `board_created: 10`, `board_made_public: 5`, `comment_posted: 2`, `contribution_accepted: 25`, `profile_completed: 15`.
  - Export unified `getRankTitle(points: number): string`.
- Wire Database Triggers:
  - `POST /api/boards`: Call `awardPoints(session.user.id, 'board_created')` and `updateBoardCount(session.user.id)`.
  - `PUT /api/boards/[id]`: When `isPublic` changes from false to true, call `awardPoints(session.user.id, 'board_made_public')`.
  - `POST /api/comments`: Call `awardPoints(session.user.id, 'comment_posted')`.
  - `POST /api/contributions/[id]/merge`:
    Increment `contributionsAccepted` on contributor's `userReputation` record.
    Call `awardPoints(contribution.userId, 'contribution_accepted')`.
- Fix Leaderboard API (`src/app/api/leaderboard/route.ts`):
  - Join `users` table:
    ```typescript
    const leaders = await db.select({
        userId: userReputation.userId,
        points: userReputation.points,
        boardsCreated: userReputation.boardsCreated,
        contributionsAccepted: userReputation.contributionsAccepted,
        name: users.name,
        image: users.image,
    }).from(userReputation).leftJoin(users, eq(userReputation.userId, users.id)).orderBy(desc(userReputation.points)).limit(50);
    ```
  - Update `src/app/(authenticated)/leaderboard/page.tsx` to render `entry.name || 'Detective #' + entry.userId.slice(0, 8)`.

### Step 7: Enhance Lineage & Contribution Diff Inspection
- Lineage Indicators:
  - When `board.parentId` exists, `GET /api/boards/[id]` returns parent board summary `{ id, title, author: { name, id } }`.
  - In `Board.tsx`, display a sticky lineage banner:
    `"Forked from [Parent Case Title] by [Parent Author]"` with a direct link.
  - In `BoardCard.tsx`, display the parent title on the fork badge tooltip/link.
- Visual Contribution Diff in `ContributionModal.tsx`:
  - Fetch target board's current content alongside contribution snapshot.
  - Compare nodes:
    - Nodes with matching ID and matching data: mark `diffStatus: 'unchanged'` (normal/dim opacity).
    - Nodes with matching ID but different label/caption/title: mark `diffStatus: 'modified'` (amber highlight border).
    - Nodes with ID not in target board: mark `diffStatus: 'added'` (green highlight border with "NEW EVIDENCE" badge).
  - Support `link: LinkNode` in `nodeTypes`.
  - Display contributor name from `users` join rather than raw `userId.slice(0, 5)`.

---

## 6. Verification Method

To independently verify these findings and future fixes:

1. **Verify TypeScript Compilation & Build**:
   ```bash
   npx tsc --noEmit
   npm run build
   ```
   *Expected Current*: Fails with `Property 'connectMode' does not exist on type 'RFState'`.  
   *Expected Post-Fix*: 0 errors, build completes successfully with all routes compiled.

2. **Verify Node Types & Link Node**:
   - Inspect `src/components/nodes/LinkNode.tsx` exists.
   - Inspect `src/components/Board.tsx` `nodeTypes` contains `link: LinkNode`.
   - Inspect `src/components/ui/Toolbar.tsx` contains Link button.

3. **Verify Board Isolation in Zustand**:
   - Navigate to `/board/board-1`, add sticky node.
   - Navigate to `/board/board-2` (new empty board).
   - Verify canvas is empty and does NOT display nodes from `board-1`.
   - Inspect `localStorage['case-file-storage']` does not store nodes/edges.

4. **Verify Orphaned Panels Mounted & Functional**:
   - Inspect `Board.tsx`: Buttons for Comments, Collaborators, History, and Export exist.
   - Click Comments -> `CommentsPanel` opens, displays author names (not Anonymous), posting adds comment.
   - Click Team -> `CollaboratorsPanel` opens, adding by email succeeds, removing sends `DELETE` and succeeds.
   - Click History -> `VersionHistory` opens, displays snapshots, restore updates board.
   - Click Export -> `ExportModal` opens, allows selecting PNG/PDF/JSON.

5. **Verify Reputation & Leaderboard**:
   - Create a board -> query `user_reputation` on DB: points = 10, boardsCreated = 1.
   - Post comment -> points increases by 2.
   - Merge contribution -> contributor points increases by 25, contributionsAccepted increases by 1.
   - Visit `/leaderboard` -> verifies actual user names and points appear instead of `Detective #<id>`.
