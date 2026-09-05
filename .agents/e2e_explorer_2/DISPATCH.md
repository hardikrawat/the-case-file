# Dispatch Log — Explorer 2 (Tier 1 & Tier 2 Specifications)

## Mission
Investigate API routes, Turso DB schemas, canvas components, and security behaviors in 'The Case File'.
1. Analyze Tier 1 feature coverage requirements:
   - Security: `/api/auth/signup` and `/api/auth/forgot-password` zero token leakage, `/api/me` passwordHash stripping, route protection.
   - Database: Turso client, table schemas, constraints, soft-delete filtering.
   - Canvas: 5 node types (Sticky Note, Text, Image, Article, Link), node deletion, edge cutting.
   - Panels & Overlays: CommentsPanel, CollaboratorsPanel, VersionHistory, ExportModal.
   - Reputation & Leaderboard: Points logic and leaderboard user joins.
2. Analyze Tier 2 boundary and corner case requirements:
   - SSRF defenses on `/api/preview` (blocking 127.0.0.1, 169.254.169.254, RFC1918, non-HTTP).
   - Empty/whitespace payloads, rapid actions / rate limiting, invalid JWTs, boundary value analysis.

## Input Files
- `/Users/hardikrawat/Documents/the-case-file/.agents/ORIGINAL_REQUEST.md`
- `/Users/hardikrawat/Documents/the-case-file/PROJECT.md`
- `/Users/hardikrawat/Documents/the-case-file/.agents/sub_orch_e2e/SCOPE.md`

## Output Requirements

## 2026-09-04T15:00:01Z
You are Explorer 2 for the E2E Testing Track of 'The Case File'.
Working directory: `/Users/hardikrawat/Documents/the-case-file/.agents/e2e_explorer_2`
Your parent is `sub_orch_e2e` (conversation ID: `6bd03dee-8755-41ec-b6a0-6e521bb5b5b5`).

Read:
- `/Users/hardikrawat/Documents/the-case-file/.agents/ORIGINAL_REQUEST.md`
- `/Users/hardikrawat/Documents/the-case-file/PROJECT.md`
- `/Users/hardikrawat/Documents/the-case-file/.agents/sub_orch_e2e/SCOPE.md`
- `/Users/hardikrawat/Documents/the-case-file/.agents/e2e_explorer_2/DISPATCH.md`

Your tasks:
1. Explore API routes (`/api/auth/*`, `/api/preview`, `/api/me`, `/api/boards/*`, `/api/comments`, `/api/collaborators`, `/api/leaderboard`, etc.), schema files (`src/lib/schema.ts`, `src/lib/db.ts`), Canvas node types (Sticky, Text, Image, Article, Link in `src/components/nodes/`), and panels (CommentsPanel, CollaboratorsPanel, VersionHistory, ExportModal).
2. Design Tier 1 Feature Coverage tests (Security, Turso DB, 5 Canvas node types, Comments, Collaborators, Versions, Export, Reputation, Leaderboard). Specify exact test cases, endpoints, assertions, and verification criteria.
3. Design Tier 2 Boundary & Corner Cases (empty inputs, rapid actions, malformed preview URLs, SSRF probes to 127.0.0.1 and 169.254.169.254, invalid tokens, large payloads). Specify exact inputs and expected error statuses.

Write your full exploration report to `/Users/hardikrawat/Documents/the-case-file/.agents/e2e_explorer_2/report.md` and your handoff to `/Users/hardikrawat/Documents/the-case-file/.agents/e2e_explorer_2/handoff.md`. Send a message back to parent when done.
