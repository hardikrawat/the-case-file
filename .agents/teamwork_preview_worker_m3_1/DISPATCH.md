# Task Assignment: Worker 1 (Milestone 3 Implementation)

**Assigned Agent**: `teamwork_preview_worker_m3_1`
**Working Directory**: `/Users/hardikrawat/Documents/the-case-file/.agents/teamwork_preview_worker_m3_1`
**Parent**: Sub-Orchestrator M3 (`9fbe4361-8197-45dd-97fb-cda3d97e6796`)

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Authoritative Inputs
You MUST read the following files before starting your work:
- `/Users/hardikrawat/Documents/the-case-file/.agents/ORIGINAL_REQUEST.md`
- `/Users/hardikrawat/Documents/the-case-file/PROJECT.md`
- `/Users/hardikrawat/Documents/the-case-file/TEST_INFRA.md`
- `/Users/hardikrawat/Documents/the-case-file/.agents/sub_orch_m3/SCOPE.md`

Read the 3 Explorer blueprints in full detail:
- `/Users/hardikrawat/Documents/the-case-file/.agents/teamwork_preview_explorer_m3_1/handoff.md` (F16, F17, F18, F19)
- `/Users/hardikrawat/Documents/the-case-file/.agents/teamwork_preview_explorer_m3_2/handoff.md` (F20, F21)
- `/Users/hardikrawat/Documents/the-case-file/.agents/teamwork_preview_explorer_m3_3/handoff.md` (F22, F23, F24, F25)

## Implementation Scope & Deliverables

### 1. F16 & F17 & F18 & F19: Canvas Core, LinkNode, Deletion, and String Cutting
- **`src/store/useStore.ts`**:
  - Add `deleteEdge: (id: string) => void`.
  - Update `onNodesChange`: When a node is removed (`type === 'remove'`), automatically filter out all edges where `edge.source === change.id || edge.target === change.id`.
  - Ensure `connectMode` and `toggleConnectMode` are cleanly typed and functional.
- **`src/store/useStore.test.ts`**:
  - Add missing imports `{ NodeChange, EdgeChange, Connection }` from `'reactflow'` to resolve TS2304 errors.
  - Add comprehensive unit tests covering `toggleConnectMode`, `deleteEdge`, `loadBoard`, `resetBoard`, and edge cleanup.
- **`src/components/nodes/LinkNode.tsx`**:
  - Create genuine `LinkNode` with detective manila card styling, thumb-tack, ReactFlow handles, badge, title and URL inputs, auto-fetch thumbnail from `/api/preview`, and external link button.
  - Add a delete button matching `button[aria-label="Delete Node"], [data-testid="delete-node"]`.
- **`src/components/nodes/StickyNoteNode.tsx`**, **`TextNode.tsx`**, **`ImageNode.tsx`**, **`ArticleNode.tsx`**:
  - Add delete button (`button[aria-label="Delete Node"], [data-testid="delete-node"]`) with a `Trash2` icon to each node component.
- **`src/components/edges/StringEdge.tsx`**:
  - Add hover scissors cut action with `aria-label="Cut String"`, `data-testid={`cut-string-${id}`}`, and `title="Cut String"`.
  - On cut click, call `useStore.getState().deleteEdge(id)` so edge is removed from both ReactFlow and Zustand store.
- **`src/components/ui/Toolbar.tsx`**:
  - Add "Add Link" button with `data-testid="add-link"` and `aria-label="Add Link"`.
  - Add "Connect" toggle button with `data-testid="toggle-connect-mode"` and `aria-label="Toggle Connect Mode"`.
- **`src/components/ui/Toolbar.test.tsx`**:
  - Fix FileReader mock TS2684 type error.

### 2. F20 & F21: Board State Isolation & Optimistic Locking / Auto-Save
- **`src/store/useStore.ts`**:
  - Add `boardId: string | null` and `boardVersion: number` to state.
  - Add `loadBoard(boardId: string, initialNodes: Node[], initialEdges: Edge[], metadata?: ...)` and `resetBoard()`.
  - Update `persist` config `partialize`: ONLY persist user preferences (`theme`, `activeColor`, `connectMode`). Remove `nodes`, `edges`, `boardTitle`, `isPublic`, `parentId` from localStorage.
  - Add defensive `onRehydrateStorage` purge and fix `safeStorage` to check `typeof localStorage !== 'undefined'`.
- **`src/components/Board.tsx`**:
  - Call `resetBoard()` when `boardId` changes and in unmount cleanup to eliminate residual evidence flashes.
  - Remove artificial 800ms delay in `fetchBoard`.
  - Register `link: LinkNode` in `nodeTypes`.
  - Add `onNodesDelete` to `ReactFlow`.
  - Implement debounced auto-save (2-3s) sending `version` to `PUT /api/boards/[id]`.
  - Track save status (`'saved' | 'saving' | 'unsaved' | 'conflict' | 'error'`).
  - Handle 409 Conflict with a high-visibility Conflict Alert Banner offering "Reload Latest" and "Review / Merge" options.
- **`src/app/api/boards/[id]/route.ts`**:
  - In `PUT`: Validate `clientVersion`. If provided and `clientVersion !== access.board.version`, return HTTP `409 Conflict` (`{ error: 'Version conflict', currentVersion: access.board.version }`).
  - Atomically bump `version = access.board.version + 1`.
  - Create a snapshot in `boardVersions` table upon update.
  - Return `{ success: true, version: nextVersion }`.

### 3. F22 & F23 & F24 & F25: Orphaned Panels Mounting & API Wiring
- **`src/components/CommentsPanel.tsx`**:
  - Convert to controlled component accepting `{ isOpen, onClose }`. When `!isOpen`, render `null` (do NOT render internal floating toggle button to avoid Playwright strict mode violation).
- **`src/components/CollaboratorsPanel.tsx`**:
  - Convert to controlled component accepting `{ isOpen, onClose }`. When `!isOpen`, render `null`.
  - Wire role modification (PATCH) and removal (DELETE).
- **`src/components/VersionHistory.tsx`**:
  - Convert to controlled component accepting `{ isOpen, onClose, onRestore }`. When `!isOpen`, render `null`.
- **`src/components/ExportModal.tsx`**:
  - Add `data-testid="export-json"`, `data-testid="export-png"`, `data-testid="export-pdf"`.
- **`src/lib/export.ts`**:
  - Provide element fallback (`document.querySelector('.react-flow') || document.body`) so PNG/PDF exports never throw error.
  - Standardize JSON export dossier format (`version: '1.0'`, `caseTitle`, `nodes`, `edges`).
- **`src/components/Board.tsx`**:
  - Mount `CommentsPanel`, `CollaboratorsPanel`, `VersionHistory`, `ExportModal` controlled by boolean state.
  - Add top action bar toggle buttons with exact attributes:
    - Comments: `title="Comments"`, `aria-label="Toggle Comments"`, `data-testid="toggle-comments"`
    - Collaborators: `title="Collaborators"`, `aria-label="Collaborators"`, `data-testid="toggle-collaborators"`
    - Version History: `title="Version History"`, `aria-label="Version History"`, `data-testid="toggle-history"`
    - Export: `title="Export Board"`, `aria-label="Export Board"`, `data-testid="toggle-export"`
  - Wire `onRestore` in `VersionHistory` to load nodes/edges into store and persist.
- **`src/app/api/comments/route.ts`**:
  - `GET`: Left-join `users` table on `comments.userId = users.id` to include author `userName`, `userImage`. For anonymous comments (`isAnonymous === true`), mask as 'Anonymous Detective'.
  - `POST`: Trim `content` (`.trim()`) to reject empty/whitespace-only input (`T2-BOUND-02`). Call `await awardPoints(session.user.id, 'comment_posted')`.
- **`src/app/api/boards/[id]/collaborators/route.ts`**:
  - `POST`: If `userId` not provided, look up user by `userEmail` in `users` table. Check owner permissions.
  - `PATCH`: Update collaborator's role ('viewer' | 'editor'). Check owner permissions.
  - `DELETE`: Delete collaborator by `collaboratorId` or `userId` query parameter. Check owner permissions.
- **`src/app/api/boards/[id]/versions/route.ts`**:
  - In `GET`: Order by `desc(boardVersions.createdAt)` so `index === 0` is the latest version.

## Verification Instructions
You MUST run the following build and test commands and document exact results in your report:
1. `npx tsc --noEmit`
2. `npm run lint`
3. `npm run test` (or `npx vitest run`)
4. Verify Playwright test specs relevant to M3:
   - `npx playwright test tests/e2e/tier1/canvas-nodes.spec.ts tests/e2e/tier1/panels.spec.ts tests/e2e/tier2/boundary.spec.ts` (or run relevant vitest/playwright scripts)

Write your final report to `/Users/hardikrawat/Documents/the-case-file/.agents/teamwork_preview_worker_m3_1/handoff.md`.
Notify parent via `send_message`.

## 2026-09-04T16:30:17Z
You are Worker 1 for Milestone 3 (Canvas Board & Orphaned Panels Wiring).
Working directory: /Users/hardikrawat/Documents/the-case-file/.agents/teamwork_preview_worker_m3_1
Parent ID: 9fbe4361-8197-45dd-97fb-cda3d97e6796
