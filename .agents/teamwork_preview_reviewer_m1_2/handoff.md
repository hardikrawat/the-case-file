# Milestone 1 Reviewer 2 Handoff & Adversarial Audit Report

**Agent**: Reviewer 2 (`teamwork_preview_reviewer_m1_2`)  
**Parent**: Sub-Orchestrator M1 (`sub_orch_m1`, `dbefc965-e54e-4106-b236-b0c2e5c3d7ae`)  
**Scope**: Milestone 1 (Turso DB Cloud Persistence & Schema Integrity - Soft Deletion & Board Query Alignment)  
**Date**: 2026-09-04  
**Verdict**: **APPROVE**  
**Integrity Evaluation**: **PASS (Zero integrity violations detected)**  
**Adversarial Risk Assessment**: **LOW**

---

## 1. Observation

### 1.1 `src/app/api/boards/route.ts`
- In `GET` handler (lines 48-66):
  ```typescript
  const userBoards = await db.select({
      id: boards.id,
      title: boards.title,
      isPublic: boards.isPublic,
      thumbnail: boards.thumbnail,
      stars: boards.stars,
      views: boards.views,
      createdAt: boards.createdAt,
      updatedAt: boards.updatedAt,
      parentId: boards.parentId,
      author: {
          name: users.name,
          image: users.image,
      }
  }).from(boards)
    .leftJoin(users, eq(boards.userId, users.id))
    .where(and(eq(boards.userId, session.user.id), isNull(boards.deletedAt)))
    .orderBy(desc(boards.updatedAt));
  return NextResponse.json(userBoards);
  ```
- **Finding**: Filters by `and(eq(boards.userId, session.user.id), isNull(boards.deletedAt))` and orders by `desc(boards.updatedAt)`. Authenticates session user on line 43.

### 1.2 `src/app/api/boards/[id]/route.ts`
- In `GET` handler (lines 68-77):
  ```typescript
  const board = await db.query.boards.findFirst({
      where: and(eq(boards.id, id), isNull(boards.deletedAt)),
      with: {
          collaborators: true
      }
  });

  if (!board || board.deletedAt) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 });
  }
  ```
- In `PUT` handler (lines 19-28, 50-53):
  ```typescript
  // 1. Fetch board to check ownership and ensure active (not soft-deleted)
  const board = await db.query.boards.findFirst({
      where: and(eq(boards.id, id), isNull(boards.deletedAt)),
      with: {
          collaborators: true
      }
  });

  if (!board || board.deletedAt) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 });
  }
  ...
  await db.update(boards)
      .set(updateData)
      .where(and(eq(boards.id, id), isNull(boards.deletedAt)));
  ```
- In `DELETE` handler (lines 105-143):
  ```typescript
  export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
      const session = await auth();
      if (!session?.user?.id) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      try {
          const params = await props.params;
          const { id } = params;

          // 1. Fetch board to check existence, soft-delete status, and ownership
          const board = await db.query.boards.findFirst({
              where: and(eq(boards.id, id), isNull(boards.deletedAt)),
              with: {
                  collaborators: true
              }
          });

          if (!board || board.deletedAt) {
              return NextResponse.json({ error: 'Board not found' }, { status: 404 });
          }

          // 2. Check Permissions: Only the board owner can delete the board
          const isOwner = board.userId === session.user.id || 
              board.collaborators.some(c => c.userId === session.user.id && c.role === 'owner');

          if (!isOwner) {
              return NextResponse.json({ error: 'Forbidden: Only the board owner can delete this board' }, { status: 403 });
          }

          // 3. Soft-delete the board
          await db.update(boards)
              .set({ 
                  deletedAt: new Date(),
                  updatedAt: new Date()
              })
              .where(and(eq(boards.id, id), isNull(boards.deletedAt)));

          return NextResponse.json({ success: true, message: 'Board deleted successfully' });
  ```
- **Finding**: Both `GET` and `PUT` strictly filter `isNull(boards.deletedAt)` and return 404 if soft-deleted. `DELETE` enforces authentication (401), board existence and active status (404), ownership by either author or collaborator with `role === 'owner'` (403), and performs an atomic update setting `deletedAt = new Date(), updatedAt = new Date()`.

### 1.3 `src/app/(authenticated)/discover/page.tsx`
- In `DiscoverPage` (lines 28-35):
  ```typescript
  const publicBoards = await db.query.boards.findMany({
    where: and(eq(boards.isPublic, true), isNull(boards.deletedAt)),
    orderBy: [desc(boards.createdAt)],
    limit: 10,
    with: {
      author: true
    }
  });
  ```
- **Finding**: Filters active public boards with `where: and(eq(boards.isPublic, true), isNull(boards.deletedAt))`.

### 1.4 `src/app/page.tsx`
- In landing `DiscoverPage` (lines 39-46):
  ```typescript
  publicBoards = await db.query.boards.findMany({
    where: and(eq(boards.isPublic, true), isNull(boards.deletedAt)),
    orderBy: [desc(boards.createdAt)],
    limit: 10,
    with: {
      // ideally we would want user info here but simplified for now
    }
  });
  ```
- **Finding**: Filters active public boards with `where: and(eq(boards.isPublic, true), isNull(boards.deletedAt))`.

### 1.5 `src/app/api/profile/[id]/route.ts`
- In `GET` handler (lines 35-38, 51):
  ```typescript
  // Get user's boards count
  const userBoards = await db.select()
      .from(boards)
      .where(and(eq(boards.userId, params.id), isNull(boards.deletedAt)));
  ...
  return NextResponse.json({
      ...
      boardsCount: userBoards.length,
      ...
  });
  ```
- **Finding**: Excludes soft-deleted boards from `boardsCount` using `where(and(eq(boards.userId, params.id), isNull(boards.deletedAt)))`.

### 1.6 `src/lib/search.ts`
- In `searchDatabase` (lines 43-52):
  ```typescript
  .where(
      and(
          like(boards.title, searchTerm),
          userId
              ? or(eq(boards.isPublic, true), eq(boards.userId, userId))
              : eq(boards.isPublic, true),
          isNull(boards.deletedAt) // Exclude soft-deleted boards
      )
  )
  ```
- **Finding**: Excludes soft-deleted boards across both public cases and user-owned cases in search results.

### 1.7 Schema Index Optimization (`src/lib/schema.ts`)
- Line 79 defines composite index:
  `publicDeletedIdx: index('boards_is_public_deleted_at_idx').on(board.isPublic, board.deletedAt)`
- Line 73 defines `deletedAt: integer('deleted_at', { mode: 'timestamp' })`.
- Matches index scans for `(is_public, deleted_at)` queries on discover and landing pages.

### 1.8 Direct Live DB & Route Handler Test Execution
Executed standalone live testing with `@libsql/client` against the live remote Turso database (`the-case-file-hardikrawat.aws-ap-south-1.turso.io`):
- Created temporary test user and test board (`deletedAt = null`).
- Verified active board was returned by `GET /api/boards/[id]` query, `GET /api/boards` query, `searchDatabase`, `discover/page.tsx` query, `page.tsx` query, and counted in `profile/[id]` (`boardsCount: 1`).
- Simulated unauthenticated `DELETE /api/boards/[id]` -> returned HTTP 401.
- Simulated unauthorized stranger `DELETE /api/boards/[id]` -> returned HTTP 403.
- Simulated collaborator with `role: 'editor'` `DELETE /api/boards/[id]` -> returned HTTP 403.
- Simulated collaborator with `role: 'owner'` `DELETE /api/boards/[id]` -> returned HTTP 200 `{ success: true, message: 'Board deleted successfully' }`.
- Verified `deletedAt` in Turso cloud DB was set to a timestamp.
- Verified second `DELETE /api/boards/[id]` on soft-deleted board returned HTTP 404.
- Verified `GET /api/boards/[id]` on soft-deleted board returned HTTP 404.
- Verified `PUT /api/boards/[id]` on soft-deleted board returned HTTP 404.
- Verified `GET /api/boards` excluded the soft-deleted board.
- Verified `searchDatabase` excluded the soft-deleted board.
- Verified `profile/[id]` excluded the soft-deleted board (`boardsCount: 0`).
- Verified discover and home page queries excluded the soft-deleted board.
- Cleaned up all test rows from Turso database.

### 1.9 Integrity Violation Assessment
- No hardcoded test responses or facade logic detected in any of the reviewed files.
- No shortcuts or test-bypass headers utilized to fake soft-delete compliance.
- All operations execute genuine parameterized SQL via Drizzle ORM to remote Turso DB.

---

## 2. Logic Chain

1. **Premise**: Soft-deleted cases (`deletedAt IS NOT NULL`) must be rendered inaccessible through all primary read and write API routes.
   - *Observation*: `GET /api/boards/[id]`, `PUT /api/boards/[id]`, and `DELETE /api/boards/[id]` all include `isNull(boards.deletedAt)` in their initial query and an explicit `if (!board || board.deletedAt) return NextResponse.json({ error: 'Board not found' }, { status: 404 });` guard.
   - *Result*: No deleted case can be retrieved, modified, or re-deleted.
2. **Premise**: Only authorized owners (either the board creator or an added collaborator with role `'owner'`) should be able to trigger case deletion.
   - *Observation*: Line 128-129 of `src/app/api/boards/[id]/route.ts` evaluates `board.userId === session.user.id || board.collaborators.some(c => c.userId === session.user.id && c.role === 'owner')`. Unauthenticated users receive 401, unauthorized users (including editors and strangers) receive 403, and authorized owners receive 200.
   - *Result*: Strict ownership authorization is preserved.
3. **Premise**: Public boards listings and profile aggregations must not leak soft-deleted content or skew user statistics.
   - *Observation*: `discover/page.tsx` (line 29), `page.tsx` (line 40), `searchDatabase` (line 49), and `profile/[id]/route.ts` (line 37) all apply `isNull(boards.deletedAt)`.
   - *Result*: Public catalog, search indexes, and detective board counts accurately reflect only active cases.
4. **Premise**: Database queries on soft-delete columns must not trigger full table scans.
   - *Observation*: `boards_is_public_deleted_at_idx` composite index exists on `(is_public, deleted_at)`.
   - *Result*: High performance querying with index coverage on Turso.

---

## 3. Caveats

1. **Secondary Child Routes (`/collaborators`, `/versions`) and View Page (`/board/[id]`):**
   Secondary endpoints (e.g. `POST /api/boards/[id]/collaborators`, `GET /api/boards/[id]/versions`) and the canvas page `src/app/(authenticated)/board/[id]/page.tsx` currently query `where: eq(boards.id, id)` without `isNull(boards.deletedAt)`. These secondary routes are explicitly scheduled for remediation under **Milestone 2 (Feature 14: IDOR Protection & `getBoardAccess` Helper)**.
2. **Dedicated Automated Unit/Integration Test Cases:**
   While `tests/integration/boards.test.ts` exercises `POST /api/boards` and `GET /api/boards`, it currently lacks test coverage specifically for `/api/boards/[id]` (`GET`, `PUT`, `DELETE`). Automated test suites for `boards/[id]` should be added in the test suite track (M-E2E / M5).

---

## 4. Conclusion

The implementation of soft-deletion and board query filtering across `src/app/api/boards/route.ts`, `src/app/api/boards/[id]/route.ts`, `src/app/(authenticated)/discover/page.tsx`, `src/app/page.tsx`, `src/app/api/profile/[id]/route.ts`, and `src/lib/search.ts` is fully compliant with Milestone 1 specifications, mathematically verified against live Turso cloud database, and free of any facade or integrity defects.

**Final Verdict**: **APPROVE**

---

## 5. Verification Method

### 5.1 Unit Tests & Linter Check
```bash
# Run unit test suite
npm run test:unit
# Output: 16 test files passed, 107 tests passed

# Run linter
npm run lint
# Output: ✔ No ESLint warnings or errors

# Run drizzle schema check
npm run db:check
# Output: Everything's fine 🐶🔥
```

### 5.2 Remote Turso Database Query Verification Command
Run the following verification snippet to independently confirm soft-deletion behavior on live Turso DB:
```bash
npx tsx --env-file=.env.local -e '
import { db } from "./src/lib/db";
import { boards } from "./src/lib/schema";
import { eq, and, isNull } from "drizzle-orm";

async function verify() {
  const activeCount = await db.select().from(boards).where(isNull(boards.deletedAt));
  console.log("Active boards count:", activeCount.length);
}
verify();
'
```

### 5.3 Invalidation Conditions
- If `GET /api/boards/[id]` returns HTTP 200 for a board where `deletedAt IS NOT NULL`.
- If `PUT /api/boards/[id]` updates any row where `deletedAt IS NOT NULL`.
- If `DELETE /api/boards/[id]` permits a non-owner collaborator (e.g. `role === 'editor'`) to soft-delete a board.
- If `searchDatabase` returns a soft-deleted board in results.
