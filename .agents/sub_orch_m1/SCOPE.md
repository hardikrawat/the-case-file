# Scope: Milestone 1 - Turso DB Cloud Persistence & Schema Integrity (R1)

## Mission
Fully transition the persistence architecture of 'The Case File' to cloud Turso DB, eliminate in-memory fallbacks (:memory:), synchronize the database schema with indexes and unique constraints, and implement soft-delete query filtering and deletion endpoint.

## Authoritative Inputs
- User Request: `/Users/hardikrawat/Documents/the-case-file/.agents/ORIGINAL_REQUEST.md`
- Master Architecture & Contracts: `/Users/hardikrawat/Documents/the-case-file/PROJECT.md`
- Forensic Survey Report: `/Users/hardikrawat/Documents/the-case-file/.agents/teamwork_preview_explorer_survey_1/handoff.md`

## Required Features & Scope Boundaries
1. **Environment Configuration**:
   - Create/populate `/Users/hardikrawat/Documents/the-case-file/.env.local` with verified Turso credentials:
     ```env
     TURSO_DATABASE_URL=libsql://the-case-file-hardikrawat.aws-ap-south-1.turso.io
     TURSO_AUTH_TOKEN=eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODg1MzI4OTIsImlkIjoiZTc1YzQzZjktNGNlYy00ZmQyLWE1YzgtNTY4ZDFlM2I5MTRkIiwia2lkIjoiMWJvLWNfaVFSb010THZkcVVQc09ZSTByeWVIM2x0VEstcFBYU1AxTldJcyIsInJpZCI6IjE1ZGRjNDM1LWY2ZjgtNDJjMi04YjM0LTg2ZTE5NDc4NDc3MCJ9.NLQbA_6E0u-z3TFYSESi_K0L0ayZKxbRDYb8fsUx7a39Qm0UvL1PYo3h89laelUIADXl7GUb-BfkOVvhoNTaCw
     AUTH_SECRET=the-case-file-super-secret-key-development-2026
     NEXTAUTH_URL=http://localhost:3000
     ```
   - Add database scripts in `package.json`: `"db:push": "drizzle-kit push"`, `"db:generate": "drizzle-kit generate"`.
2. **Client Fail-Fast & Memory Fallback Elimination**:
   - In `src/lib/db.ts`: Remove `:memory:` fallback. Throw descriptive critical errors if `TURSO_DATABASE_URL` is missing or if remote URL lacks `TURSO_AUTH_TOKEN`.
3. **Schema Synchronization & Integrity**:
   - In `src/lib/schema.ts`:
     - Add `isAnonymous` to `comments`: `integer('is_anonymous', { mode: 'boolean' }).default(false)`.
     - Add `version` to `boards`: `integer('version').default(1).notNull()`.
     - Add `parentId` self-reference to `boards`: `.references(() => boards.id, { onDelete: 'set null' })`.
     - Add `notifications` table matching Turso schema.
     - Add unique index on `boardCollaborators(boardId, userId)`.
     - Add relational indexes on foreign keys and frequently queried columns (`boards.userId`, `boards.updatedAt`, `boards(isPublic, deletedAt)`, `contributions.boardId`, `comments.boardId`, `userReputation.points`, `rateLimits.expiresAt`, etc.).
   - Run `npx drizzle-kit push` non-destructively against cloud Turso DB to apply new columns and indexes.
4. **Soft-Delete Alignment & Board Deletion API**:
   - In `src/app/api/boards/route.ts` and `src/app/api/boards/[id]/route.ts`: filter queries with `isNull(boards.deletedAt)`.
   - In `src/app/api/boards/[id]/route.ts`: implement `DELETE` method that sets `deletedAt = new Date()`.
   - In `src/app/(authenticated)/discover/page.tsx`, `src/app/page.tsx`, `src/app/api/profile/[id]/route.ts`: ensure soft-deleted boards are excluded.

## Orchestration Procedure for M1 Sub-Orchestrator
Assess -> Run Iteration Loop (2B):
- Spawn 3 Explorers: analyze implementation details for tasks 1-4. [COMPLETED]
- Spawn Worker: implement the changes, run db push, verify build/tests. Include MANDATORY INTEGRITY WARNING. [COMPLETED]
- Spawn 2 Reviewers: independently verify schema, fail-fast, soft-delete, indexes. [COMPLETED - APPROVE]
- Spawn 2 Challengers: test fail-fast crash when URL missing, test soft-delete filtering, test unique collaborator constraint. [COMPLETED - APPROVE]
- Spawn Forensic Auditor (`teamwork_preview_auditor`): verify genuine Turso connection and no facade/dummy code. [COMPLETED - CLEAN]
- Gate: Update GATE_STATUS.md. All must PASS. [PASS]
- Hand off to parent orchestrator. [IN_PROGRESS]

## Final Milestone Status: DONE
All 5 Milestone 1 requirements successfully implemented, verified on live cloud Turso DB, stress-tested, and audited with zero defects or violations.
