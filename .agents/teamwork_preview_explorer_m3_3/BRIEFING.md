# BRIEFING — 2026-09-04T22:00:00+05:30

## Mission
Analyze codebase and provide a comprehensive, file-by-file implementation blueprint for Features 22-25 (mount CommentsPanel, CollaboratorsPanel, VersionHistory, ExportModal and wire their backend APIs).

## 🔒 My Identity
- Archetype: explorer
- Roles: Teamwork explorer (investigation, synthesis, handoff)
- Working directory: /Users/hardikrawat/Documents/the-case-file/.agents/teamwork_preview_explorer_m3_3
- Original parent: 9fbe4361-8197-45dd-97fb-cda3d97e6796
- Milestone: Milestone 3 (Mounting Orphaned Panels & API Wiring)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement source code changes
- Write only to your folder: /Users/hardikrawat/Documents/the-case-file/.agents/teamwork_preview_explorer_m3_3/
- Follow 5-Component Handoff Report format (Observation, Logic Chain, Caveats, Conclusion, Verification Method)

## Current Parent
- Conversation ID: 9fbe4361-8197-45dd-97fb-cda3d97e6796
- Updated: 2026-09-04T22:00:00+05:30

## Investigation State
- **Explored paths**:
  - `src/components/Board.tsx` (lines 1-438)
  - `src/components/CommentsPanel.tsx` (lines 1-140)
  - `src/components/CollaboratorsPanel.tsx` (lines 1-212)
  - `src/components/VersionHistory.tsx` (lines 1-137)
  - `src/components/ExportModal.tsx` (lines 1-133)
  - `src/components/ui/Toolbar.tsx` (lines 1-189)
  - `src/app/api/comments/route.ts` (lines 1-127)
  - `src/app/api/comments/[id]/route.ts` (lines 1-119)
  - `src/app/api/boards/[id]/collaborators/route.ts` (lines 1-134)
  - `src/app/api/boards/[id]/versions/route.ts` (lines 1-97)
  - `src/app/api/boards/[id]/route.ts` (lines 1-136)
  - `src/lib/export.ts` (lines 1-82)
  - `src/lib/reputation.ts` (lines 1-133)
  - `src/lib/auth-checks.ts` (lines 1-54)
  - `src/lib/schema.ts` (lines 1-334)
  - `tests/e2e/tier1/panels.spec.ts`
  - `tests/e2e/tier3/collaboration-rbac.spec.ts`
  - `tests/e2e/tier4/export-roundtrip.spec.ts`
  - `tests/e2e/tier4/versions-conflict.spec.ts`
  - `tests/e2e/helpers/canvas-helpers.ts`
  - `tests/e2e/tier2/boundary.spec.ts`
  - `tests/integration/comments.test.ts`
- **Key findings**:
  1. None of the 4 panels (`CommentsPanel`, `CollaboratorsPanel`, `VersionHistory`, `ExportModal`) are mounted in `Board.tsx`.
  2. `CommentsPanel`, `CollaboratorsPanel`, and `VersionHistory` each currently render uncontrolled floating buttons that collide with strict-mode Playwright locators if both top-bar and floating buttons exist. They should be controlled components with `isOpen` / `onClose` props.
  3. `GET /api/comments` lacks left-join to `users` for author name and avatar (`T1-COMM-01`).
  4. `POST /api/comments` lacks `awardPoints(session.user.id, 'comment_posted')` (+2 points) (`T1-COMM-02`).
  5. `createCommentSchema` lacks `.trim()` on `content`, failing empty/whitespace rejection (`T2-BOUND-02`).
  6. `POST /api/boards/[id]/collaborators` requires `userId` and fails when only `userEmail` is passed (`T1-COL-02`).
  7. `DELETE` and `PATCH` routes are completely missing in `src/app/api/boards/[id]/collaborators/route.ts` (`T1-COL-03`, `T1-COL-04`).
  8. `GET /api/boards/[id]/versions` is ordered ascending instead of descending (`desc(boardVersions.createdAt)`), causing index 0 to be oldest rather than latest.
  9. `PUT /api/boards/[id]` must create version snapshots on content update and enforce optimistic lock version conflict (409) (`T1-STORE-02`, `T4-VER-05`).
  10. `ExportModal.tsx` requires `data-testid="export-png"` and `data-testid="export-pdf"` attributes.
  11. `exportBoard` in `src/lib/export.ts` needs a fallback for `element` (`document.querySelector('.react-flow') || document.body`) so PNG/PDF exports never throw "Element required".
  12. `tests/integration/comments.test.ts` mock for `db` needs `leftJoin: vi.fn().mockReturnThis()`.
- **Unexplored areas**: None within F22-F25 scope.

## Key Decisions Made
- All 4 panels should be controlled by `Board.tsx` with dedicated top-bar action buttons matching Playwright test locators.
- Prepared comprehensive implementation plan with precise code diffs for the worker.

## Artifact Index
- `.agents/teamwork_preview_explorer_m3_3/progress.md` — Liveness heartbeat and investigation progress
- `.agents/teamwork_preview_explorer_m3_3/BRIEFING.md` — Situational awareness
- `.agents/teamwork_preview_explorer_m3_3/handoff.md` — Final handoff report
