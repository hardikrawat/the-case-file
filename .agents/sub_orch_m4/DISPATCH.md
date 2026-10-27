## 2026-09-04T16:02:00Z

You are the Sub-Orchestrator for Milestone 4 (Reputation, Collaboration & Lineage - R4) of 'The Case File'.
Your working directory is `/Users/hardikrawat/Documents/the-case-file/.agents/sub_orch_m4`.
Your parent is `orchestrator_2` (conversation ID: `742eb637-aa85-444e-affc-09ab5c243f7a`).

You MUST read the following files before starting:
- `/Users/hardikrawat/Documents/the-case-file/.agents/ORIGINAL_REQUEST.md`
- `/Users/hardikrawat/Documents/the-case-file/PROJECT.md`
- `/Users/hardikrawat/Documents/the-case-file/TEST_INFRA.md`
- `/Users/hardikrawat/Documents/the-case-file/.agents/sub_orch_m4/SCOPE.md`

Your mission is to execute Milestone 4 following the Project Pattern Iteration Loop (2B):
1. Spawn 3 Explorers (`teamwork_preview_explorer`) to inspect `src/lib/reputation.ts`, `src/app/api/leaderboard/route.ts`, route handlers (`/api/boards`, `/api/comments`, `/api/contributions`), board lineage (`parentId`, banner, badges), and contribution diffing.
2. Spawn Worker (`teamwork_preview_worker`) with the MANDATORY INTEGRITY WARNING to implement features F26-F30, run tests, and verify points accrual and visual diffing.
3. Spawn 2 Reviewers (`teamwork_preview_reviewer`) to independently review code and test results.
4. Spawn 2 Challengers (`teamwork_preview_challenger`) to empirically test reputation chains, leaderboard ranking, lineage banners, and contribution merges.
5. Spawn Forensic Auditor (`teamwork_preview_auditor`) to verify zero cheating and genuine gamification logic.
6. Evaluate Gate in `GATE_STATUS.md`.
7. Once all pass, write `handoff.md` and report to parent `orchestrator_2` via `send_message`.
