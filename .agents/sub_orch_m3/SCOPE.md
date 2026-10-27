# Scope: Milestone 3 - Canvas Board & Orphaned Panels Wiring (R3)

## Mission
Restore build integrity by fixing `connectMode`, implement the missing `LinkNode` evidence node type, implement node deletion UI with dangling edge cleanup, synchronize red string cutting with the Zustand store, enforce strict per-board Zustand state isolation (purging canvas elements from localStorage), implement optimistic locking with board auto-save, and integrate & mount all 4 orphaned panels (`CommentsPanel`, `CollaboratorsPanel`, `VersionHistory`, `ExportModal`) into the Board UI with full backend endpoint wiring.

## Authoritative Inputs
- User Request: `/Users/hardikrawat/Documents/the-case-file/.agents/ORIGINAL_REQUEST.md`
- Master Project Architecture & Contracts: `/Users/hardikrawat/Documents/the-case-file/PROJECT.md`
- Master Test Infra: `/Users/hardikrawat/Documents/the-case-file/TEST_INFRA.md`
- Working Directory: `/Users/hardikrawat/Documents/the-case-file/.agents/sub_orch_m3`

## Required Features & Scope Boundaries (Features 16-25)

1. **Fix Build Blocker (`connectMode`) (Feature 16)**:
   - Ensure `connectMode` is properly defined and typed in `src/store/useStore.ts` and correctly consumed in `src/components/Board.tsx` and toolbar components.
   - Run typecheck and ensure clean compilation.

2. **Link Evidence Node (Feature 17)**:
   - Create `src/components/nodes/LinkNode.tsx` matching the corkboard / detective aesthetic (manila card / tape styling, thumbnail preview, URL title, external link icon).
   - Register `LinkNode` in node types definition in `src/components/Board.tsx`.
   - Add "Add Link" button in the canvas toolbar with URL input prompt or dialog.

3. **Node Deletion UI & Dangling Edge Cleanup (Feature 18)**:
   - Add a delete button (trash icon) to all evidence node components (StickyNote, TextNode, ImageNode, ArticleNode, LinkNode).
   - In `useStore.deleteNode`, remove the target node AND all edges connected to `targetNode.id` (both source and target).
   - Ensure keyboard `Delete`/`Backspace` also triggers clean deletion with edge cleanup.

4. **String Cutting Sync (Feature 19)**:
   - In `src/components/edges/StringEdge.tsx`: when the user hovers over an edge and clicks the cut scissors / button, trigger `useStore.getState().deleteEdge(id)`.
   - Ensure edge deletion syncs immediately with the ReactFlow state and store.

5. **Board State Isolation (Feature 20)**:
   - In `src/store/useStore.ts`:
     - Do NOT persist `nodes` or `edges` in `localStorage`. Only persist user preferences (e.g. `connectMode`, theme, zoom level).
     - Provide `loadBoard(boardId: string, initialNodes: Node[], initialEdges: Edge[])` or `resetBoard()` to completely clear and replace active nodes and edges when switching boards.
     - Ensure navigating between different boards never contaminates state or renders leftover nodes.

6. **Optimistic Locking & Auto-Save (Feature 21)**:
   - In `src/components/Board.tsx`:
     - Implement debounced auto-save (e.g., 2-3 seconds after modification) calling `PUT /api/boards/[id]`.
     - Send the current `version` number with update payloads.
     - If the server returns 409 Conflict, notify user and provide reload/merge options.

7. **Mount CommentsPanel (Feature 22)**:
   - Mount `CommentsPanel` in `src/components/Board.tsx` with toggle button in board header/toolbar.
   - In `src/app/api/comments/route.ts`: left-join `users` table to return author's name, avatar, and role.
   - Support commenting on the overall board or tied to specific `nodeId`.
   - Trigger `awardPoints(userId, 'comment_posted')`.

8. **Mount CollaboratorsPanel (Feature 23)**:
   - Mount `CollaboratorsPanel` in `src/components/Board.tsx` with toggle button.
   - In `src/app/api/boards/[id]/collaborators/route.ts`:
     - Support user lookup by email.
     - Implement `DELETE` to remove a collaborator.
     - Implement `PATCH` to update a collaborator's role ('viewer' | 'editor').
     - Check permissions via `getBoardAccess` (only owner can add/modify/remove collaborators).

9. **Mount VersionHistory (Feature 24)**:
   - Mount `VersionHistory` panel in `src/components/Board.tsx`.
   - On board save / major update, snapshot board state into `board_versions` table.
   - Support viewing and restoring prior versions.

10. **Mount ExportModal (Feature 25)**:
    - Mount `ExportModal` in `src/components/Board.tsx` with an "Export" action in the board header.
    - Provide export formats:
      - JSON (full case file dossier, 100% roundtrip fidelity).
      - PNG (high-resolution canvas screenshot via `html-to-image`).
      - PDF (printable investigation dossier).

## Execution Iteration Loop
1. Spawn 3 Explorers (`teamwork_preview_explorer`) to inspect current canvas/panel components and create implementation blueprints.
2. Spawn Worker (`teamwork_preview_worker`) with MANDATORY INTEGRITY WARNING to implement and verify.
3. Spawn 2 Reviewers (`teamwork_preview_reviewer`) to verify code, ReactFlow interactions, and tests.
4. Spawn 2 Challengers (`teamwork_preview_challenger`) to test node deletion, string cutting, board isolation, panel mounting, and export.
5. Spawn Forensic Auditor (`teamwork_preview_auditor`) for integrity check.
6. Check Gate in `GATE_STATUS.md`.
7. Once all pass, write `handoff.md` and report to parent.
