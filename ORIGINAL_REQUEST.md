# Original User Request

## 2026-09-04T14:47:47Z

Fix all 124 identified feature gaps and 157 critical/high severity bugs across 'The Case File' application, fully transition the persistence architecture to cloud Turso DB, and build an automated verification test suite to prove that all gaps and vulnerabilities have been eliminated.

Working directory: /Users/hardikrawat/Documents/the-case-file
Integrity mode: development

## Reference Documentation
- Feature Gap Analysis: `gap_analysis_report.md` (124 cataloged gaps across Canvas, Reputation, Collaboration, Security, Database, UI/UX, State, Search, Export)
- Bug Analysis: `bug_analysis_report.md` (157 cataloged critical and high severity bugs across all 10 categories)

## Infrastructure & Configuration
- Turso DB Hostname: `the-case-file-hardikrawat.aws-ap-south-1.turso.io`
- Turso Database URL: `libsql://the-case-file-hardikrawat.aws-ap-south-1.turso.io`
- Turso Database Auth Token: `eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODg1MzI4OTIsImlkIjoiZTc1YzQzZjktNGNlYy00ZmQyLWE1YzgtNTY4ZDFlM2I5MTRkIiwia2lkIjoiMWJvLWNfaVFSb010THZkcVVQc09ZSTByeWVIM2x0VEstcFBYU1AxTldJcyIsInJpZCI6IjE1ZGRjNDM1LWY2ZjgtNDJjMi04YjM0LTg2ZTE5NDc4NDc3MCJ9.NLQbA_6E0u-z3TFYSESi_K0L0ayZKxbRDYb8fsUx7a39Qm0UvL1PYo3h89laelUIADXl7GUb-BfkOVvhoNTaCw`
- Turso Platform Management Token: `eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJncm91cF91dWlkIjoiYTZiZTExMGItZjQxOS00YTUxLTlkNmMtNjY0OWVhZWQxODg2IiwianRpIjoiaFlqYWg2ZWFFZkcwd0dJR2kyNk9vUSIsIm9yZ19pZCI6MTAwMDExMTE5Miwic2NvcGVzIjp7InNjb3BlcyI6WyJkYjpjb25maWd1cmUiLCJkYjpjcmVhdGUiLCJkYjpkZWxldGUiLCJkYjptaW50LXRva2VuIiwiZGI6cm90YXRlLWNyZWRzIiwiZ3JvdXA6Y29uZmlndXJlIiwiZ3JvdXA6bWludC10b2tlbiIsImdyb3VwOnJvdGF0ZS1jcmVkcyIsInJlYWQiXX19.JrEW_PFbQpdejYwfIiL7ISv9LJGIx0tIE7Nh6zyfy7qRuFol0pYrPkmMY3P9sKOFj-IkXTsc4RLcV-LpCJMOBQ`

## Requirements

### R1. Cloud Turso DB Persistence & Schema Integrity
Migrate the entire application to use remote Turso DB (`@libsql/client` with Drizzle ORM) in all environments, removing any silent `:memory:` fallbacks. Apply complete schema migrations to Turso with proper indexes, unique constraints, foreign keys, and soft-delete support. Ensure `.env.local` is populated and `drizzle-kit push`/`migrate` works against the cloud instance.

### R2. Authentication, Authorization & Security Hardening
Completely eliminate all test auth bypasses (`x-test-bypass` headers), prevent token leakage in API responses (verification and password reset tokens), secure the preview endpoint against SSRF (enforce URL parsing, block private networks, localhost, and non-HTTP protocols), implement atomic rate-limiting, and protect all authenticated pages and API routes in middleware and route handlers.

### R3. Canvas Evidence Board & UI Component Wiring
Implement all claimed evidence node types (including the missing Link Node), node deletion, dynamic red string rendering with physics and textures, auto-saving with optimistic locking, and clean board state isolation in Zustand to prevent cross-board data contamination. Integrate and mount all orphaned panels (`CommentsPanel`, `CollaboratorsPanel`, `VersionHistory`, `ExportModal`).

### R4. Detective Reputation, Collaboration & Lineage
Fully wire reputation actions (creating boards, publishing, commenting, accepted contributions, rank titles) to database updates. Fix collaborator management (user lookup, addition, role management, deletion API). Add lineage indicators for forked cases and support visual contribution diff inspection and clean merge execution.

### R5. Comprehensive Test Suite & Regression Verification
Implement and execute automated test suites (unit, integration, and E2E via Vitest and Playwright) validating security fixes, Turso DB persistence, board CRUD, collaboration flows, and canvas state transitions. Ensure the application passes full typecheck, linting, and production build without errors.

## Acceptance Criteria

### Security Verification
- [ ] No `x-test-bypass` or test bypass mechanism exists in `src/auth.ts`, `src/auth.config.ts`, or any route/page.
- [ ] `POST /api/auth/signup` and `POST /api/auth/forgot-password` return zero tokens or sensitive credentials in response bodies.
- [ ] `GET /api/preview?url=http://127.0.0.1` and `http://169.254.169.254` return a 400 Bad Request error.
- [ ] `GET /api/me` strips `passwordHash` before returning user session payload.
- [ ] All authenticated routes (`/cases`, `/discover`, `/board/*`, `/profile/*`, `/leaderboard`, `/settings`) enforce authentication.

### Database & Turso Integration
- [ ] Database client connects directly to `libsql://the-case-file-hardikrawat.aws-ap-south-1.turso.io`.
- [ ] All tables (users, accounts, sessions, boards, contributions, comments, versions, collaborators, reputation, rateLimits) are created on Turso with indexes and constraints.
- [ ] Application does not fall back to `:memory:` when database environment variables are configured.

### Canvas & Core Features
- [ ] Canvas supports 5 evidence node types: Sticky Notes, Text, Images, Articles, and Links.
- [ ] Users can delete nodes from the canvas and cut string connections.
- [ ] Switching between different boards loads isolated board data without showing stale nodes/edges from previous boards.
- [ ] CommentsPanel, CollaboratorsPanel, VersionHistory, and ExportModal open and function properly from the board UI.

### Verification & Quality Gate
- [ ] `npm run lint` passes with 0 errors.
- [ ] `npm run build` completes successfully with all routes compiled.
- [ ] `npm run test` passes all unit/integration test suites.

## 2026-09-04T15:47:33Z

Fix all remaining feature gaps and bugs across 'The Case File' application and execute the automated verification test suite.

Note: Milestone 1 (Cloud Turso DB Migration, schema synchronization, 14 tables, 21 indexes, soft-delete filtering) is ALREADY COMPLETED and verified in `PROJECT.md`. The E2E test harness is established in `tests/e2e/` and `TEST_INFRA.md`.
Resume directly with:
- Milestone 2: Security Hardening & Auth Protection (eliminate all `x-test-bypass`, credential/token leaks, preview SSRF guard, atomic rate limiting, IDOR protection)
- Milestone 3: Canvas Board & Orphaned Panels Wiring (Link evidence node, node deletion, string cutting sync, Zustand per-board isolation, mount CommentsPanel, CollaboratorsPanel, VersionHistory, ExportModal)
- Milestone 4: Reputation, Collaboration & Lineage (wire reputation triggers into DB, leaderboard user join, rank title unification, case lineage banner, contribution visual diff)
- Milestone 5 & E2E Testing: Complete all 4-tier test suites, verify all fixes and gaps are filled, run full build, lint, and tests.

Working directory: /Users/hardikrawat/Documents/the-case-file
Integrity mode: development

Refer to:
- `PROJECT.md` (Architecture, feature inventory, contracts, and milestone tracking)
- `TEST_INFRA.md` (E2E test suite specifications)
- `gap_analysis_report.md` (124 cataloged gaps)
- `bug_analysis_report.md` (157 cataloged critical and high severity bugs)

## Infrastructure & Configuration
- Turso DB Hostname: `the-case-file-hardikrawat.aws-ap-south-1.turso.io`
- Turso Database URL: `libsql://the-case-file-hardikrawat.aws-ap-south-1.turso.io`
- Turso Database Auth Token: `eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODg1MzI4OTIsImlkIjoiZTc1YzQzZjktNGNlYy00ZmQyLWE1YzgtNTY4ZDFlM2I5MTRkIiwia2lkIjoiMWJvLWNfaVFSb010THZkcVVQc09ZSTByeWVIM2x0VEstcFBYU1AxTldJcyIsInJpZCI6IjE1ZGRjNDM1LWY2ZjgtNDJjMi04YjM0LTg2ZTE5NDc4NDc3MCJ9.NLQbA_6E0u-z3TFYSESi_K0L0ayZKxbRDYb8fsUx7a39Qm0UvL1PYo3h89laelUIADXl7GUb-BfkOVvhoNTaCw`
- Turso Platform Management Token: `eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJncm91cF91dWlkIjoiYTZiZTExMGItZjQxOS00YTUxLTlkNmMtNjY0OWVhZWQxODg2IiwianRpIjoiaFlqYWg2ZWFFZkcwd0dJR2kyNk9vUSIsIm9yZ19pZCI6MTAwMDExMTE5Miwic2NvcGVzIjp7InNjb3BlcyI6WyJkYjpjb25maWd1cmUiLCJkYjpjcmVhdGUiLCJkYjpkZWxldGUiLCJkYjptaW50LXRva2VuIiwiZGI6cm90YXRlLWNyZWRzIiwiZ3JvdXA6Y29uZmlndXJlIiwiZ3JvdXA6bWludC10b2tlbiIsImdyb3VwOnJvdGF0ZS1jcmVkcyIsInJlYWQiXX19.JrEW_PFbQpdejYwfIiL7ISv9LJGIx0tIE7Nh6zyfy7qRuFol0pYrPkmMY3P9sKOFj-IkXTsc4RLcV-LpCJMOBQ`

## Acceptance Criteria
- [ ] No `x-test-bypass` or test bypass mechanism exists in `src/auth.ts`, `src/auth.config.ts`, or any route/page.
- [ ] `POST /api/auth/signup` and `POST /api/auth/forgot-password` return zero tokens or sensitive credentials in response bodies.
- [ ] `GET /api/preview?url=http://127.0.0.1` and `http://169.254.169.254` return a 400 Bad Request error.
- [ ] `GET /api/me` strips `passwordHash` before returning user session payload.
- [ ] All authenticated routes (`/cases`, `/discover`, `/board/*`, `/profile/*`, `/leaderboard`, `/settings`) enforce authentication.
- [ ] Canvas supports 5 evidence node types: Sticky Notes, Text, Images, Articles, and Links.
- [ ] Users can delete nodes from the canvas and cut string connections.
- [ ] Switching between different boards loads isolated board data without showing stale nodes/edges from previous boards.
- [ ] CommentsPanel, CollaboratorsPanel, VersionHistory, and ExportModal open and function properly from the board UI.
- [ ] `npm run lint` passes with 0 errors.
- [ ] `npm run build` completes successfully with all routes compiled.
- [ ] `npm run test` passes all unit/integration test suites.

