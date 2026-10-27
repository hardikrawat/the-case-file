## 2026-09-04T16:14:38Z
You are Challenger 1 for Milestone 2: Security Hardening & Auth Protection.
Working Directory: /Users/hardikrawat/Documents/the-case-file/.agents/teamwork_preview_challenger_m2_gen2_1
Parent: Sub-Orchestrator Milestone 2 (Conversation ID: 3cafafc6-bb20-4b00-bb5d-54223a3a8175)

Mandatory reading before starting:
- /Users/hardikrawat/Documents/the-case-file/.agents/ORIGINAL_REQUEST.md (Subagents MUST read it before starting work)
- /Users/hardikrawat/Documents/the-case-file/PROJECT.md
- /Users/hardikrawat/Documents/the-case-file/.agents/sub_orch_m2_gen2/SCOPE.md
- /Users/hardikrawat/Documents/the-case-file/.agents/teamwork_preview_worker_m2_gen2_1/handoff.md

Your Objective:
Empirically attack and challenge the security controls implemented in Milestone 2.
Write and run empirical stress test scripts (using `npx tsx` or node) to verify:
1. **Auth Bypass Attack**:
   - Send requests with `x-test-bypass: true` to `/api/me`, `/board/test-case-id`, `/cases`, etc. Prove that bypass fails and returns 401 Unauthorized or redirects to `/login`.
2. **SSRF Attack Suite on `GET /api/preview`**:
   - Test loopback addresses: `http://127.0.0.1`, `http://localhost`, `http://0.0.0.0`, `http://[::1]`.
   - Test Cloud metadata / IMDS: `http://169.254.169.254`, `http://169.254.169.254/latest/meta-data/`.
   - Test private RFC1918 subnets: `http://10.0.0.1`, `http://172.16.0.1`, `http://192.168.1.1`.
   - Test non-HTTP schemes: `file:///etc/passwd`, `gopher://127.0.0.1:6379/`, `ftp://...`.
   - Test IPv4-mapped IPv6 addresses: `http://[::ffff:127.0.0.1]`.
   - Test redirect attacks (endpoint redirecting to 127.0.0.1).
   - Assert that ALL attacks return HTTP 400 Bad Request ("Access to private network address is forbidden" or "Invalid protocol").
3. **Token / Credential Leakage Verification**:
   - Call signup route or logic and verify zero `verificationToken` returned in response body.
   - Call forgot-password route with both existing and non-existing email; verify zero `resetToken` returned and identical response messages.
   - Verify `passwordHash` is absent from `/api/me` and `/api/profile/[id]` payloads.

Deliverables:
- Save test scripts in `scripts/test-challenger-m2-auth-ssrf.ts` (or your agent working directory).
- Execute the scripts and capture verbatim outputs.
- Write a comprehensive verification report with empirical evidence and verdict in:
  `/Users/hardikrawat/Documents/the-case-file/.agents/teamwork_preview_challenger_m2_gen2_1/handoff.md`.
- Send a message back to parent (3cafafc6-bb20-4b00-bb5d-54223a3a8175).
