# Task Assignment: Explorer 1 (Milestone 3 - Canvas Core, LinkNode, Deletion & String Cutting)

**Assigned Agent**: `teamwork_preview_explorer_m3_1`
**Working Directory**: `/Users/hardikrawat/Documents/the-case-file/.agents/teamwork_preview_explorer_m3_1`
**Parent**: Sub-Orchestrator M3 (`9fbe4361-8197-45dd-97fb-cda3d97e6796`)

## Required Reading
You MUST read the following files before starting your investigation:
- `/Users/hardikrawat/Documents/the-case-file/.agents/ORIGINAL_REQUEST.md`
- `/Users/hardikrawat/Documents/the-case-file/PROJECT.md`
- `/Users/hardikrawat/Documents/the-case-file/TEST_INFRA.md`
- `/Users/hardikrawat/Documents/the-case-file/.agents/sub_orch_m3/SCOPE.md`

## Your Investigation Scope
Analyze the codebase and prepare a detailed, file-by-file implementation plan for:
1. **F16: Fix Build Blocker (`connectMode`)**:
   - Inspect `src/store/useStore.ts`, `src/components/Board.tsx`, and toolbar components.
   - Determine how `connectMode` is currently declared, typed, and consumed. Identify type/runtime errors and specify exact type definitions and state transitions needed.
2. **F17: Link Evidence Node**:
   - Inspect existing evidence nodes in `src/components/nodes/` (StickyNote, TextNode, ImageNode, ArticleNode).
   - Design `src/components/nodes/LinkNode.tsx` adhering to the detective/corkboard aesthetic (manila card/tape style, thumbnail preview, URL title, external link icon, handle connections).
   - Detail how `LinkNode` should be registered in `nodeTypes` in `src/components/Board.tsx`.
   - Specify how the "Add Link" button should be added to the toolbar (URL input prompt/modal).
3. **F18: Node Deletion UI & Dangling Edge Cleanup**:
   - Inspect all node components in `src/components/nodes/`.
   - Specify where and how to render a delete button (trash icon) on each node type.
   - Inspect `deleteNode` in `src/store/useStore.ts`: ensure deleting a node also purges all edges connected to `targetNode.id` (both as source and as target).
   - Verify keyboard `Delete`/`Backspace` handling in ReactFlow canvas in `Board.tsx`.
4. **F19: String Cutting Sync**:
   - Inspect `src/components/edges/StringEdge.tsx` and related edge styling/physics.
   - Inspect the hover scissors/cut action.
   - Detail how clicking the cut button must invoke `useStore.getState().deleteEdge(id)` so the red yarn is removed from both ReactFlow and Zustand store simultaneously.

## Output Requirements
Write your comprehensive analysis and implementation plan to:
`/Users/hardikrawat/Documents/the-case-file/.agents/teamwork_preview_explorer_m3_1/handoff.md`

Include exact file paths, line numbers, current behavior vs expected behavior, code snippets, and any risk considerations.
When finished, notify your parent via `send_message`.

## 2026-09-04T16:24:19Z
You are Explorer 1 for Milestone 3 (Canvas Core, LinkNode, Deletion & String Cutting).
Working directory: /Users/hardikrawat/Documents/the-case-file/.agents/teamwork_preview_explorer_m3_1
Parent ID: 9fbe4361-8197-45dd-97fb-cda3d97e6796

Read your assignment in /Users/hardikrawat/Documents/the-case-file/.agents/teamwork_preview_explorer_m3_1/DISPATCH.md and authoritative files:
- /Users/hardikrawat/Documents/the-case-file/.agents/ORIGINAL_REQUEST.md
- /Users/hardikrawat/Documents/the-case-file/PROJECT.md
- /Users/hardikrawat/Documents/the-case-file/TEST_INFRA.md
- /Users/hardikrawat/Documents/the-case-file/.agents/sub_orch_m3/SCOPE.md

Investigate F16 (connectMode build fix), F17 (LinkNode evidence component & registration), F18 (node deletion UI & edge cleanup), and F19 (string cutting sync in StringEdge).
Write your findings to /Users/hardikrawat/Documents/the-case-file/.agents/teamwork_preview_explorer_m3_1/handoff.md and report back via send_message.
