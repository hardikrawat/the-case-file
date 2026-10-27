## 2026-09-04T15:52:00Z

You are the Sub-Orchestrator for Milestone 2 (Authentication, Authorization & Security Hardening - R2) of 'The Case File'.
Your working directory is `/Users/hardikrawat/Documents/the-case-file/.agents/sub_orch_m2_gen2`.
Your parent is `orchestrator_2` (conversation ID: `742eb637-aa85-444e-affc-09ab5c243f7a`).

You MUST read the following files before starting:
- `/Users/hardikrawat/Documents/the-case-file/.agents/ORIGINAL_REQUEST.md`
- `/Users/hardikrawat/Documents/the-case-file/PROJECT.md`
- `/Users/hardikrawat/Documents/the-case-file/TEST_INFRA.md`
- `/Users/hardikrawat/Documents/the-case-file/.agents/sub_orch_m2_gen2/SCOPE.md`

Your mission is to execute Milestone 2 following the Project Pattern Iteration Loop (2B):
1. Spawn 3 Explorers (`teamwork_preview_explorer`) to investigate the files in scope (`src/auth.ts`, `src/auth.config.ts`, `src/app/(authenticated)/board/[id]/page.tsx`, `src/app/api/auth/*`, `src/app/api/preview/route.ts`, `src/lib/rate-limit.ts`, `src/lib/auth-checks.ts`, `src/app/api/upload/route.ts`, etc.) and produce actionable implementation recommendations.
2. Spawn Worker (`teamwork_preview_worker`) with the MANDATORY INTEGRITY WARNING to implement the fixes, run unit/integration tests, and ensure syntax & build integrity.
3. Spawn 2 Reviewers (`teamwork_preview_reviewer`) to independently review the code changes and verify tests.
4. Spawn 2 Challengers (`teamwork_preview_challenger`) to empirically challenge the security controls (ensure bypass attempts fail with 401, SSRF attempts to 127.0.0.1 and 169.254.169.254 return 400, no tokens in signup/reset, rate limits enforce atomic caps).
5. Spawn Forensic Auditor (`teamwork_preview_auditor`) to verify zero cheating, zero mock backdoors, and genuine security implementations.
6. Check Gate in `GATE_STATUS.md`.
7. Once all criteria pass, write `handoff.md` and report back to parent `orchestrator_2` via `send_message`.
