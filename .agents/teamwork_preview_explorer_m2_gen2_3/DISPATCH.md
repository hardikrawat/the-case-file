## 2026-09-04T15:53:00Z

<USER_REQUEST>
You are Explorer 3 for Milestone 2: Security Hardening & Auth Protection of 'The Case File'.
Working Directory: /Users/hardikrawat/Documents/the-case-file/.agents/teamwork_preview_explorer_m2_gen2_3
Parent: Sub-Orchestrator Milestone 2 (Conversation ID: 3cafafc6-bb20-4b00-bb5d-54223a3a8175)

Mandatory reading:
- /Users/hardikrawat/Documents/the-case-file/.agents/ORIGINAL_REQUEST.md (Subagents MUST read it before starting work)
- /Users/hardikrawat/Documents/the-case-file/PROJECT.md
- /Users/hardikrawat/Documents/the-case-file/.agents/sub_orch_m2_gen2/SCOPE.md

Your Focus:
1. Feature 12: SSRF Protection in `GET /api/preview` (`src/app/api/preview/route.ts`):
   - Inspect current preview implementation.
   - URL parsing with `new URL()`, strict protocol checking (`http:` / `https:`).
   - DNS resolution with `dns.promises.lookup(hostname, { all: true })`.
   - IP range validation: block loopback (`127.0.0.0/8`, `0.0.0.0/8`, `localhost`, `::1`), link-local / IMDS (`169.254.0.0/16`, `fe80::/10`), private RFC1918 (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `fc00::/7`).
   - Redirect handling (`redirect: 'manual'` or re-validate redirect target).
   - Timeout with `AbortSignal.timeout(5000)`.
   - Rate limiting: `checkRateLimit('preview:${ip}', 20, 60000)`.
2. Feature 13: Atomic SQLite Rate Limiting (`src/lib/rate-limit.ts` & `src/lib/account-security.ts`):
   - Current implementation of `checkRateLimit` (TOCTOU race conditions).
   - Drizzle schema `rateLimits` table.
   - Rewrite using atomic SQLite UPSERT (`INSERT INTO rate_limits ... ON CONFLICT(key) DO UPDATE ...`).
   - Fix timestamp comparison in `src/lib/account-security.ts`.
   - Identify the 12 unprotected endpoints and how to apply rate limiting.
3. Feature 14: Authorization & IDOR Protection (`src/lib/auth-checks.ts`):
   - Check if `src/lib/auth-checks.ts` exists or needs implementation.
   - Implement `getBoardAccess(boardId: string, userId?: string)` per contract in `PROJECT.md § Board Access Authorization Contract`.
   - Enforce access control in `GET /api/comments`, `POST /api/comments`, `GET /api/contributions`, `GET /api/boards/[id]/collaborators`, `PUT /api/boards/[id]`.
4. Feature 15: File Upload Hardening (`src/app/api/upload/route.ts`):
   - Current upload logic.
   - Whitelist MIME types, strictly enforce extensions mapped from MIME (not client filename), verify magic bytes in buffer.

Deliverables:
Produce a detailed, verified investigation report and handoff in your working directory:
`/Users/hardikrawat/Documents/the-case-file/.agents/teamwork_preview_explorer_m2_gen2_3/handoff.md`.
Include exact file paths, line numbers, current behavior, required code changes, and potential edge cases.
When done, send a message back to parent (3cafafc6-bb20-4b00-bb5d-54223a3a8175).
</USER_REQUEST>
