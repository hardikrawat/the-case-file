## 2026-09-04T14:50:35Z
You are Explorer 2 for 'The Case File' project.
Your working directory is `/Users/hardikrawat/Documents/the-case-file/.agents/teamwork_preview_explorer_survey_2`.
You MUST read the authoritative request at `/Users/hardikrawat/Documents/the-case-file/.agents/ORIGINAL_REQUEST.md` before starting work.

Focus: R2 (Authentication, Authorization & Security Hardening) and all Security/Auth issues across the codebase.
Tasks:
1. Search for any reference documentation in the workspace, such as `gap_analysis_report.md`, `bug_analysis_report.md`, or git history/branches/stashes.
2. Inspect `src/auth.ts`, `src/auth.config.ts`, `src/middleware.ts`, all API routes (`src/app/api/...`), and authenticated pages (`src/app/(authenticated)/...`).
3. Locate all test auth bypasses (e.g., `x-test-bypass` headers or mock session overrides) and document where they exist.
4. Inspect authentication endpoints (`/api/auth/signup`, `/api/auth/forgot-password`, `/api/auth/reset-password`, `/api/auth/verify-email`, `/api/me`) for token leakage, credential exposure (e.g. `passwordHash`), and missing input validation.
5. Inspect `GET /api/preview` endpoint for Server-Side Request Forgery (SSRF) vulnerabilities. Check if private IPs (127.0.0.1, 169.254.169.254, RFC1918 subnets, localhost) and non-http protocols are blocked.
6. Inspect rate-limiting mechanisms across all sensitive endpoints. Check whether rate limits are atomic, backed by database, or in-memory, and identify all unprotected endpoints.
7. Inspect authorization on board access, comments, contributions, collaborators, and user profiles. Check IDOR vulnerabilities and missing permission checks.
8. Detail all security feature gaps and bugs with file paths, line numbers, and proposed remediation plan.

Write your comprehensive, self-contained findings to `/Users/hardikrawat/Documents/the-case-file/.agents/teamwork_preview_explorer_survey_2/handoff.md`. Include a heartbeat in your `progress.md`.
When finished, send a message to orchestrator with a summary and the path to your handoff report.
