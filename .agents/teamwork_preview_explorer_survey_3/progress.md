# Progress Log - Explorer Survey 3 (Canvas, UI Wiring, Reputation, Collaboration & Lineage)

Last visited: 2026-09-04T14:56:00Z

- [x] Initialized DISPATCH.md and BRIEFING.md
- [x] Checked git repository history and searched for reference documentation (gap_analysis_report.md and bug_analysis_report.md confirmed absent from repository)
- [x] Task 2: Inspected Canvas Evidence Board implementation:
  - Sticky Notes, Text, Image, Article node components verified
  - Missing Link Node identified across nodes, Toolbar, and Board nodeTypes
  - Node deletion: deleteNode is defined in useStore but never invoked; missing onNodesDelete handler causes dangling edges
  - Red string physics & textures: yarn-texture SVG filter located in RootLayout; StringEdge sags naturally with quadratic curve
  - String connection cutting: StringEdge invokes local useReactFlow().setEdges which fails to update Zustand store, so cut strings reappear on save
  - Click-to-connect mode: connectMode/sourceNodeId removed from store in commit 6bd924d but left in Board.tsx, breaking connection mode and crashing npm run build
- [x] Task 3: Inspected Zustand store and state isolation across boards:
  - Single global localStorage key 'case-file-storage' persists state across all boards
  - Missing boardId scoping and missing resetBoard action
  - Empty or new boards inherit previous board's nodes/edges because fetchBoard only updates on non-empty data.content
  - safeStorage throws TypeError in non-browser environments
  - Missing auto-save and optimistic locking (no version/updatedAt verification in PUT /api/boards/[id])
- [x] Task 4: Located and inspected orphaned panels:
  - CommentsPanel: completely unmounted; GET /api/comments lacks user join (displays 'Anonymous')
  - CollaboratorsPanel: completely unmounted; POST sends userEmail but API requires userId; DELETE endpoint /api/boards/[id]/collaborators/[collaboratorId] does not exist (404)
  - VersionHistory: completely unmounted; boardVersions table never populated on board save
  - ExportModal: completely unmounted; Toolbar uses raw JSON export bypassing ExportModal's PNG/PDF/JSON export
- [x] Task 5: Inspected Reputation system:
  - src/lib/reputation.ts is 100% dead code; awardPoints, updateBoardCount, getUserPoints, getUserRank never invoked anywhere
  - No reputation updates on board creation, publishing, commenting, or contribution merges
  - GET /api/leaderboard lacks user join, displaying 'Detective #<id>' instead of names
  - userReputation schema has contributionsAccepted column but lib/reputation.ts has no action for it
- [x] Task 6: Inspected Collaborator management & Lineage/Contributions:
  - Lineage: boards only store parentId; no parent case title, author link, or fork lineage UI
  - Contribution preview in ContributionModal lacks visual diff (no styling difference between added, modified, unchanged nodes)
  - Merging contributions does not award points or update reputation
- [ ] Task 7: Compile comprehensive handoff.md with evidence chains and implementation plans
