# Scope: Milestone 4 - Reputation, Collaboration & Lineage (R4)

## Mission
Fully wire the gamified detective reputation engine to database persistence across all core detective activities, join user identity data in the global leaderboard, standardize detective rank title thresholds, implement visual lineage indicators for forked cases (parent case banner and fork badges), and build visual contribution diffing with clean merge execution.

## Authoritative Inputs
- User Request: `/Users/hardikrawat/Documents/the-case-file/.agents/ORIGINAL_REQUEST.md`
- Master Project Architecture & Contracts: `/Users/hardikrawat/Documents/the-case-file/PROJECT.md`
- Master Test Infra: `/Users/hardikrawat/Documents/the-case-file/TEST_INFRA.md`
- Working Directory: `/Users/hardikrawat/Documents/the-case-file/.agents/sub_orch_m4`

## Required Features & Scope Boundaries (Features 26-30)

1. **Reputation Engine Wiring (Feature 26)**:
   - In `src/lib/reputation.ts`: Ensure `awardPoints(userId: string, action: ReputationAction)` updates or inserts into `user_reputation` table in Turso DB atomically.
   - Wire `awardPoints` into route handlers:
     - Board creation (`POST /api/boards`): `board_created` (+10 pts)
     - Board made public (`PUT /api/boards/[id]` when `isPublic: true` and previously false): `board_made_public` (+5 pts)
     - Comment posted (`POST /api/comments`): `comment_posted` (+2 pts)
     - Contribution accepted (`POST /api/contributions/[id]/accept` or status update): `contribution_accepted` (+25 pts)
     - Profile completed (`PUT /api/profile/[id]` with avatar/bio): `profile_completed` (+15 pts)

2. **Leaderboard User Joins (Feature 27)**:
   - In `src/app/api/leaderboard/route.ts`:
     - Perform an inner/left join between `user_reputation` and `users` table on `userId`.
     - Return real detective names, avatars, point totals, and computed rank titles.
     - Add pagination/limiting (e.g. top 50).
     - Cache or rate limit appropriately.

3. **Unified Rank Titles (Feature 28)**:
   - Standardize detective rank thresholds across `src/lib/reputation.ts`, `src/app/api/leaderboard/route.ts`, and `src/components/profile/*`:
     - 1000+ points: "Chief Detective"
     - 500+ points: "Senior Investigator"
     - 200+ points: "Private Eye"
     - 50+ points: "Rookie Cop"
     - <50 points: "Patrol Officer"
   - Export a unified `getRankTitle(points: number): string` from `src/lib/reputation.ts` and use it everywhere.

4. **Case Lineage Indicators (Feature 29)**:
   - In `src/app/api/boards/[id]/route.ts`:
     - When returning a board that has `parentId`, query and return parent board summary (`{ id, title, userId, userName }`).
   - In `src/components/Board.tsx`:
     - If the board has `parentId`, render a prominent Lineage Banner at the top: "Forked from: [Parent Case Title] by [Parent Author]". Include a link to the parent board.
   - In board list / cards (`src/components/BoardCard.tsx` / `src/app/(authenticated)/cases/page.tsx`):
     - Display a "Forked" badge with link to origin case.

5. **Contribution Visual Diff & Merge (Feature 30)**:
   - In `src/components/ContributionModal.tsx` / `src/components/ContributionReview.tsx`:
     - Compare proposed snapshot nodes/edges with current board nodes/edges.
     - Categorize items:
       - Added: Green badge / border.
       - Modified: Amber badge / border.
       - Unchanged: Neutral styling.
       - Deleted: Red strikethrough.
     - On Accept: cleanly merge proposed nodes and edges into the parent board state and bump board version.
     - Award 25 reputation points to the contributor.

## Execution Iteration Loop
1. Spawn 3 Explorers (`teamwork_preview_explorer`) to inspect current reputation lib, leaderboard route, board lineage, and contribution components.
2. Spawn Worker (`teamwork_preview_worker`) with MANDATORY INTEGRITY WARNING to implement and test.
3. Spawn 2 Reviewers (`teamwork_preview_reviewer`) to verify code, database updates, and rank titles.
4. Spawn 2 Challengers (`teamwork_preview_challenger`) to test reputation accrual, leaderboard ordering, lineage banner rendering, and diff accuracy.
5. Spawn Forensic Auditor (`teamwork_preview_auditor`) for integrity verification.
6. Evaluate Gate in `GATE_STATUS.md`.
7. Once all pass, write `handoff.md` and report to parent.
