## 2026-09-04T15:52:54Z

You are Explorer 2 for Milestone 2: Security Hardening & Auth Protection of 'The Case File'.
Working Directory: /Users/hardikrawat/Documents/the-case-file/.agents/teamwork_preview_explorer_m2_gen2_2
Parent: Sub-Orchestrator Milestone 2 (Conversation ID: 3cafafc6-bb20-4b00-bb5d-54223a3a8175)

Mandatory reading:
- /Users/hardikrawat/Documents/the-case-file/.agents/ORIGINAL_REQUEST.md (Subagents MUST read it before starting work)
- /Users/hardikrawat/Documents/the-case-file/PROJECT.md
- /Users/hardikrawat/Documents/the-case-file/.agents/sub_orch_m2_gen2/SCOPE.md

Your Focus: Features 8, 9, 10, 11 (Eliminate Token & Credential Leakage, Privacy Hardening).
Specifically investigate:
1. `POST /api/auth/signup` (`src/app/api/auth/signup/route.ts`) & `src/app/signup/page.tsx`:
   - How `verificationToken` is currently returned in JSON response.
   - Required change: remove `verificationToken` from response body.
   - Update `src/app/signup/page.tsx` to redirect to `/signup/verify?email=${encodeURIComponent(formData.email)}` without `token`.
2. `POST /api/auth/forgot-password` (`src/app/api/auth/forgot-password/route.ts`):
   - Current leak of `resetToken`.
   - Required change: remove `resetToken`, return standard generic success message regardless of whether user exists.
3. Password hash leakage:
   - `GET /api/me` (`src/app/api/me/route.ts`): inspect how user object is retrieved and returned; ensure `passwordHash` is stripped (`const { passwordHash, ...safeUser } = user`).
   - `PUT /api/profile/[id]` (`src/app/api/profile/[id]/route.ts`): inspect `.returning()` or output payload, ensure `passwordHash` is excluded.
4. Privacy hardening:
   - `GET /api/profile/[id]` (`src/app/api/profile/[id]/route.ts`): inspect email exposure and `boardsCount`. Only expose email if `session?.user?.id === params.id`. Exclude private boards from `boardsCount` for non-owners.
   - `src/lib/search.ts`: verify user search fields and omit `email`.
   - `src/app/api/auth/verify-email/route.ts`: inspect token validation logic and rate limiting.

Deliverables:
Produce a detailed, verified investigation report and handoff in your working directory:
`/Users/hardikrawat/Documents/the-case-file/.agents/teamwork_preview_explorer_m2_gen2_2/handoff.md`.
Include exact file paths, line numbers, current behavior, required code changes, and potential edge cases.
When done, send a message back to parent (3cafafc6-bb20-4b00-bb5d-54223a3a8175).
