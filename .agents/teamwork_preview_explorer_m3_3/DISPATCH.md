# Task Assignment: Explorer 3 (Milestone 3 - Mounting Orphaned Panels & API Wiring)

**Assigned Agent**: `teamwork_preview_explorer_m3_3`
**Working Directory**: `/Users/hardikrawat/Documents/the-case-file/.agents/teamwork_preview_explorer_m3_3`
**Parent**: Sub-Orchestrator M3 (`9fbe4361-8197-45dd-97fb-cda3d97e6796`)

## Required Reading
You MUST read the following files before starting your investigation:
- `/Users/hardikrawat/Documents/the-case-file/.agents/ORIGINAL_REQUEST.md`
- `/Users/hardikrawat/Documents/the-case-file/PROJECT.md`
- `/Users/hardikrawat/Documents/the-case-file/TEST_INFRA.md`
- `/Users/hardikrawat/Documents/the-case-file/.agents/sub_orch_m3/SCOPE.md`

## Your Investigation Scope
Analyze the codebase and prepare a detailed, file-by-file implementation plan for:
1. **F22: Mount CommentsPanel**:
   - Inspect `src/components/CommentsPanel.tsx` and see how it interacts with the board.
   - Inspect `src/components/Board.tsx`: where and how to render toggle button in header/toolbar and mount the panel.
   - Inspect `src/app/api/comments/route.ts`:
     - Verify `GET`: Ensure it left-joins `users` table so author `name`, `image` (avatar), and role are returned. Check `boardId` and optional `nodeId` filtering.
     - Verify `POST`: Ensure comments can be board-level (`nodeId` is null/empty) or attached to a specific node (`nodeId`).
     - Check integration with reputation points (`awardPoints(userId, 'comment_posted')`).
2. **F23: Mount CollaboratorsPanel**:
   - Inspect `src/components/CollaboratorsPanel.tsx`.
   - Mount in `src/components/Board.tsx` with header/toolbar toggle button.
   - Inspect `src/app/api/boards/[id]/collaborators/route.ts`:
     - `GET`: verify returning `{ id, userId, role, addedAt, userName, userEmail }[]`.
     - `POST`: verify looking up user by email or userId, checking owner permissions.
     - `DELETE`: implement `DELETE /api/boards/[id]/collaborators` (by collaboratorId or userId), verifying owner permissions.
     - `PATCH`: implement `PATCH /api/boards/[id]/collaborators` (updating role to 'viewer' | 'editor'), verifying owner permissions.
3. **F24: Mount VersionHistory**:
   - Inspect `src/components/VersionHistory.tsx`.
   - Mount in `src/components/Board.tsx` with header/toolbar toggle button.
   - Inspect `src/app/api/boards/[id]/versions/route.ts` (or create if missing):
     - Ensure version snapshots are created during major saves/auto-saves in `board_versions` table.
     - Support fetching versions list (`GET`) and restoring a version (`POST /api/boards/[id]/versions/[versionId]/restore` or via `PUT`).
4. **F25: Mount ExportModal**:
   - Inspect `src/components/ExportModal.tsx`.
   - Mount in `src/components/Board.tsx` with "Export" action in the board header.
   - Verify export implementations:
     - JSON: Full case file dossier (board metadata, all nodes, edges, versions, comments) with 100% roundtrip capability.
     - PNG: High-res canvas screenshot using `html-to-image` or canvas export.
     - PDF: Printable investigation dossier document.

## Output Requirements
Write your comprehensive analysis and implementation plan to:
`/Users/hardikrawat/Documents/the-case-file/.agents/teamwork_preview_explorer_m3_3/handoff.md`

Include exact file paths, line numbers, schema queries, API payloads, component props, and integration details.
When finished, notify your parent via `send_message`.
