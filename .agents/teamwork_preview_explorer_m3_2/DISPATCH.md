# Task Assignment: Explorer 2 (Milestone 3 - Board State Isolation & Optimistic Locking / Auto-Save)

**Assigned Agent**: `teamwork_preview_explorer_m3_2`
**Working Directory**: `/Users/hardikrawat/Documents/the-case-file/.agents/teamwork_preview_explorer_m3_2`
**Parent**: Sub-Orchestrator M3 (`9fbe4361-8197-45dd-97fb-cda3d97e6796`)

## Required Reading
You MUST read the following files before starting your investigation:
- `/Users/hardikrawat/Documents/the-case-file/.agents/ORIGINAL_REQUEST.md`
- `/Users/hardikrawat/Documents/the-case-file/PROJECT.md`
- `/Users/hardikrawat/Documents/the-case-file/TEST_INFRA.md`
- `/Users/hardikrawat/Documents/the-case-file/.agents/sub_orch_m3/SCOPE.md`

## Your Investigation Scope
Analyze the codebase and prepare a detailed, file-by-file implementation plan for:
1. **F20: Board State Isolation**:
   - Inspect `src/store/useStore.ts` and its persistence middleware / `persist()` configuration.
   - Currently, are `nodes` and `edges` persisted to `localStorage`? Identify what should be stored in `localStorage` (only user preferences: e.g. `connectMode`, theme, zoom level) vs what must be ephemeral/board-scoped (active `boardId`, `nodes`, `edges`, `history`).
   - Define functions `loadBoard(boardId: string, initialNodes: Node[], initialEdges: Edge[])` and `resetBoard()` in `useStore.ts`.
   - Inspect board loading lifecycle in `src/app/board/[id]/page.tsx` and `src/components/Board.tsx`. Verify that navigating between boards never leaks nodes/edges from the previous board.
2. **F21: Optimistic Locking & Auto-Save**:
   - Inspect `src/components/Board.tsx`: analyze current saving mechanism (manual save button vs auto-save).
   - Design debounced auto-save (e.g. 2-3 seconds after any node/edge modification) calling `PUT /api/boards/[id]`.
   - Inspect `src/app/api/boards/[id]/route.ts`: verify how board updates are processed, how `version` column in `boards` table is checked and incremented.
   - Specify optimistic locking behavior: if version does not match, return 409 Conflict. In `Board.tsx`, handle 409 by notifying the user (banner / toast) and offering merge / reload options.
   - Detail the exact state tracking in `Board.tsx` (save status: idle, saving, saved, error/conflict).

## Output Requirements
Write your comprehensive analysis and implementation plan to:
`/Users/hardikrawat/Documents/the-case-file/.agents/teamwork_preview_explorer_m3_2/handoff.md`

Include exact file paths, line numbers, current schema/API behavior vs expected behavior, code snippets, and error handling details.

## 2026-09-04T16:24:19Z
You are Explorer 2 for Milestone 3 (Board State Isolation & Optimistic Locking / Auto-Save).
Working directory: /Users/hardikrawat/Documents/the-case-file/.agents/teamwork_preview_explorer_m3_2
Parent ID: 9fbe4361-8197-45dd-97fb-cda3d97e6796

Read your assignment in /Users/hardikrawat/Documents/the-case-file/.agents/teamwork_preview_explorer_m3_2/DISPATCH.md and authoritative files:
- /Users/hardikrawat/Documents/the-case-file/.agents/ORIGINAL_REQUEST.md
- /Users/hardikrawat/Documents/the-case-file/PROJECT.md
- /Users/hardikrawat/Documents/the-case-file/TEST_INFRA.md
- /Users/hardikrawat/Documents/the-case-file/.agents/sub_orch_m3/SCOPE.md

Investigate F20 (board state isolation, removing localStorage node pollution, loadBoard/resetBoard lifecycle) and F21 (optimistic locking & debounced auto-save with 409 conflict handling).
Write your findings to /Users/hardikrawat/Documents/the-case-file/.agents/teamwork_preview_explorer_m3_2/handoff.md and report back via send_message.

