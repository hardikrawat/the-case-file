# BRIEFING — 2026-09-04T16:30:00Z

## Mission
Investigate F20 (board state isolation, localStorage un-pollution, loadBoard/resetBoard lifecycle) and F21 (optimistic locking & debounced auto-save with 409 conflict handling) to produce a comprehensive implementation blueprint for Worker.

## 🔒 My Identity
- Archetype: explorer
- Roles: investigation, synthesis, reporting
- Working directory: /Users/hardikrawat/Documents/the-case-file/.agents/teamwork_preview_explorer_m3_2
- Original parent: 9fbe4361-8197-45dd-97fb-cda3d97e6796
- Milestone: Milestone 3 (Canvas Board & Orphaned Panels Wiring)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Deliver findings in /Users/hardikrawat/Documents/the-case-file/.agents/teamwork_preview_explorer_m3_2/handoff.md
- Report completion to parent 9fbe4361-8197-45dd-97fb-cda3d97e6796 via send_message
- Follow 5-Component Handoff format (Observation, Logic Chain, Caveats, Conclusion, Verification Method)

## Current Parent
- Conversation ID: 9fbe4361-8197-45dd-97fb-cda3d97e6796
- Updated: 2026-09-04T16:30:00Z

## Investigation State
- **Explored paths**:
  - `src/store/useStore.ts`: Complete analysis of persistence middleware, SafeStorage error handling, and missing methods (`loadBoard`, `resetBoard`, `deleteEdge`).
  - `src/app/(authenticated)/board/[id]/page.tsx`: Verified server page structure and `<Board />` mount lifecycle.
  - `src/components/Board.tsx`: Complete analysis of `fetchBoard`, artificial 800ms delay, lack of immediate unmount reset, lack of debounced auto-save, lack of version sending, and lack of 409 Conflict banner.
  - `src/app/api/boards/[id]/route.ts`: Complete analysis of `PUT` handler, lack of version verification, lack of version bumping, and lack of 409 Conflict response.
  - `src/lib/schema.ts`: Verified `boards.version` integer column (default 1) and `board_versions` snapshot table.
  - `tests/e2e/tier1/canvas.spec.ts` (`T1-STORE-01` cross-board isolation).
  - `tests/e2e/tier4/versions-conflict.spec.ts` (`T4.4` optimistic locking and conflict response).
  - `TEST_INFRA.md` (`T1-STORE-02` specification).
- **Key findings**:
  - `useStore.ts` persists `nodes` and `edges` to `localStorage['case-file-storage']`, violating `T1-STORE-01` by rehydrating stale clues across boards.
  - `Board.tsx` retains previous board clues in store during `fetchBoard` async loading, causing visual contamination.
  - `Board.tsx` only offers a manual save button, risking evidence loss.
  - `PUT /api/boards/[id]` ignores version, fails to return 409 on stale edits, and fails to increment `boards.version`.
  - `Board.tsx` lacks 409 Conflict UI and recovery actions (Reload Latest / Review Suggestions).
- **Unexplored areas**:
  - None within F20 & F21 scope. Complete implementation plan produced in `handoff.md`.

## Key Decisions Made
- `useStore.ts`: Strip `nodes`, `edges`, `boardTitle`, `parentId`, `isPublic`, and `boardId` from `partialize`. Persist strictly user preferences (`theme`, `activeColor`, `connectMode`). Add defensive `onRehydrateStorage` purge.
- `useStore.ts`: Add `boardId: string | null`, `boardVersion: number`, `loadBoard()`, `resetBoard()`, and `deleteEdge()`.
- `Board.tsx`: Trigger `resetBoard()` immediately upon `boardId` change and in unmount cleanup to guarantee zero cross-board evidence leak. Remove 800ms artificial latency in `finally`.
- `Board.tsx`: Implement 2000ms debounced auto-save hook on `[nodes, edges]` with save status indicator (`'saved' | 'saving' | 'unsaved' | 'conflict' | 'error'`).
- `PUT /api/boards/[id]`: Enforce optimistic lock check against `access.board.version`. Return 409 Conflict on mismatch. Increment `version = currentVersion + 1` and return `{ success: true, version: nextVersion }`.
- `Board.tsx`: Display red Conflict Alert Banner on 409 Conflict with "Reload Latest" and "Review / Merge" resolution buttons.

## Artifact Index
- `/Users/hardikrawat/Documents/the-case-file/.agents/teamwork_preview_explorer_m3_2/DISPATCH.md` — Assignment instructions
- `/Users/hardikrawat/Documents/the-case-file/.agents/teamwork_preview_explorer_m3_2/progress.md` — Liveness heartbeat and progress log
- `/Users/hardikrawat/Documents/the-case-file/.agents/teamwork_preview_explorer_m3_2/BRIEFING.md` — Persistent memory index
- `/Users/hardikrawat/Documents/the-case-file/.agents/teamwork_preview_explorer_m3_2/handoff.md` — Final comprehensive investigation report
