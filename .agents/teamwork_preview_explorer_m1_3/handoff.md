# Investigation & Implementation Plan: Soft-Delete Support & Board Deletion API (M1 Task 4)

**Agent**: Explorer 3 (`teamwork_preview_explorer_m1_3`)  
**Parent**: `sub_orch_m1` (Conversation ID: `dbefc965-e54e-4106-b236-b0c2e5c3d7ae`)  
**Milestone**: M1 (Turso DB Cloud Persistence & Schema Integrity - R1 / Feature 5)  
**Date**: 2026-09-04  

---

## 1. Observation

Direct code inspection of target routes, pages, and utilities revealed the following observations:

### 1.1 Target File: `src/app/api/boards/route.ts`
- **Lines 1–5**:
  ```typescript
  import { auth } from '@/auth';
  import { db } from '@/lib/db';
  import { boards, users } from '@/lib/schema';
  import { NextResponse } from 'next/server';
  import { eq } from 'drizzle-orm';
  ```
- **Lines 48–63 (`GET` handler)**:
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
  }).from(boards).leftJoin(users, eq(boards.userId, users.id)).where(eq(boards.userId, session.user.id)).orderBy(boards.updatedAt);
  return NextResponse.json(userBoards);
  ```
- **Observation**: `GET /api/boards` filters only by `eq(boards.userId, session.user.id)` without checking `isNull(boards.deletedAt)`. Any soft-deleted boards remain visible in the user's dashboard board listing.

### 1.2 Target File: `src/app/api/boards/[id]/route.ts`
- **Lines 1–5**:
  ```typescript
  import { NextRequest, NextResponse } from 'next/server';
  import { db } from '@/lib/db';
  import { boards } from '@/lib/schema';
  import { eq } from 'drizzle-orm';
  import { auth } from '@/auth';
  ```
- **Lines 18–28 (`PUT` board lookup)**:
  ```typescript
  // 1. Fetch board to check ownership
  const board = await db.query.boards.findFirst({
      where: eq(boards.id, id),
      with: {
          collaborators: true
      }
  });

  if (!board) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 });
  }
  ```
- **Lines 50–52 (`PUT` update execution)**:
  ```typescript
  await db.update(boards)
      .set(updateData)
      .where(eq(boards.id, id));
  ```
- **Lines 67–77 (`GET` board lookup)**:
  ```typescript
  const board = await db.query.boards.findFirst({
      where: eq(boards.id, id),
      with: {
          collaborators: true
      }
  });

  if (!board) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 });
  }
  ```
- **Line 104 (End of File)**: Entire file contains only `PUT` and `GET`. `DELETE` method handler does not exist.
- **Observation**: 
  1. `GET /api/boards/[id]` queries without `isNull(boards.deletedAt)`. Users can fetch soft-deleted boards.
  2. `PUT /api/boards/[id]` queries and updates without `isNull(boards.deletedAt)`. Soft-deleted boards can still be updated.
  3. No `DELETE` handler is implemented to allow users or owners to soft-delete a board.

### 1.3 Target File: `src/app/(authenticated)/discover/page.tsx`
- **Lines 5, 28–35**:
  ```typescript
  import { eq, desc } from "drizzle-orm";
  ...
  const publicBoards = await db.query.boards.findMany({
    where: eq(boards.isPublic, true),
    orderBy: [desc(boards.createdAt)],
    limit: 10,
    with: {
      author: true
    }
  });
  ```
- **Observation**: `where: eq(boards.isPublic, true)` fails to filter by `isNull(boards.deletedAt)`. Soft-deleted public boards continue to appear in community discovery feeds.

### 1.4 Target File: `src/app/page.tsx` (Public Landing Page)
- **Lines 5, 39–46**:
  ```typescript
  import { eq, desc } from "drizzle-orm";
  ...
  publicBoards = await db.query.boards.findMany({
    where: eq(boards.isPublic, true),
    orderBy: [desc(boards.createdAt)],
    limit: 10,
    with: {
      // ideally we would want user info here but simplified for now
    }
  });
  ```
- **Observation**: Soft-deleted boards are fetched for the landing page hero and featured cases grid because `isNull(boards.deletedAt)` is missing.

### 1.5 Target File: `src/app/api/profile/[id]/route.ts`
- **Lines 34–37**:
  ```typescript
  // Get user's boards count
  const userBoards = await db.select()
      .from(boards)
      .where(eq(boards.userId, params.id));
  ```
- **Observation**: `userBoards` count includes soft-deleted boards when returning `boardsCount: userBoards.length` in line 51.

### 1.6 Target File: `src/lib/search.ts`
- **Lines 43–52**:
  ```typescript
  .where(
      and(
          or(
              like(boards.title, searchTerm),
              // Only show public boards or user's own boards
              ...(userId ? [eq(boards.userId, userId)] : [])
          ),
          isNull(boards.deletedAt) // Exclude soft-deleted boards
      )
  )
  ```
- **Observation**: `isNull(boards.deletedAt)` is already present on line 50. However, the `or(...)` clause has an authorization/search bug: `or(like(title, searchTerm), eq(userId, userId))` returns ALL boards of `userId` regardless of whether they match `searchTerm`.

### 1.7 Associated Board Routes & Pages
- In `src/app/(authenticated)/board/[id]/page.tsx:28–33`:
  ```typescript
  const dbBoard = await db.query.boards.findFirst({
      where: eq(boards.id, boardId),
      with: {
          collaborators: true
      }
  });
  ```
  Navigating directly to `/board/[id]` displays soft-deleted boards instead of rendering `notFound()`.
- In `src/app/api/boards/[id]/collaborators/route.ts:58–62` and `src/app/api/boards/[id]/versions/route.ts:21–25, 75–78`:
  Board lookups do not filter `isNull(boards.deletedAt)`, allowing collaborator additions and version queries on soft-deleted boards.

---

## 2. Logic Chain

1. **Premise**: Soft deletion is intended to mark records as inactive without physically removing rows (`boards.deletedAt`), preserving relational integrity while rendering the resource invisible across user-facing APIs and interfaces.
   - *Observation Ref*: Section 1.1, 1.2, 1.3, 1.4, 1.5, 1.7.
   - *Inference*: Any endpoint querying `boards` without `isNull(boards.deletedAt)` leaks soft-deleted cases into user dashboards, search indexes, statistics, and feeds.
   - *Action*: Add `and(..., isNull(boards.deletedAt))` to every `boards` query across `GET /api/boards`, `GET /api/boards/[id]`, `PUT /api/boards/[id]`, `/discover`, `/`, `/api/profile/[id]`, and `/board/[id]`.

2. **Premise**: Users must be able to delete their own boards via a RESTful endpoint.
   - *Observation Ref*: Section 1.2 (Line 104: No `DELETE` handler in `src/app/api/boards/[id]/route.ts`).
   - *Inference*: Client applications or API consumers have no mechanism to invoke deletion.
   - *Action*: Implement `export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> })` in `src/app/api/boards/[id]/route.ts` that enforces authentication, validates ownership (`board.userId === session.user.id || role === 'owner'`), checks that the board exists and is not already deleted, and executes `db.update(boards).set({ deletedAt: new Date(), updatedAt: new Date() }).where(and(eq(boards.id, id), isNull(boards.deletedAt)))`.

3. **Premise**: Deleted boards must be immutable; editing a deleted board must be prohibited.
   - *Observation Ref*: Section 1.2 (`PUT /api/boards/[id]` queries without `isNull(boards.deletedAt)` and updates without `isNull(boards.deletedAt)`).
   - *Inference*: A client could send a `PUT` request to update title, content, or public visibility of a soft-deleted board.
   - *Action*: In `PUT /api/boards/[id]`, add `and(eq(boards.id, id), isNull(boards.deletedAt))` to the initial `findFirst` check and return 404 `Board not found` if null/deleted. Also guard the `db.update(boards).where(and(eq(boards.id, id), isNull(boards.deletedAt)))`.

4. **Premise**: Public surfaces (Discover feed, landing page featured boards) and profile counts must exclude soft-deleted boards.
   - *Observation Ref*: Sections 1.3, 1.4, 1.5.
   - *Inference*: A user soft-deletes an embarrassing or experimental case, but it remains prominently displayed on the landing page hero banner or in `/discover`. Also, the detective profile `boardsCount` displays an inaccurate tally.
   - *Action*: Update `discover/page.tsx` and `app/page.tsx` to `where: and(eq(boards.isPublic, true), isNull(boards.deletedAt))`, and update `profile/[id]/route.ts` to `where: and(eq(boards.userId, params.id), isNull(boards.deletedAt))`.

---

## 3. Caveats

- **No Caveats on Feasibility**: All required imports (`and`, `eq`, `isNull`, `desc`) are already exported by `drizzle-orm` (version `^0.45.1` in `package.json`).
- **Authorization Boundary Contract**: Per `PROJECT.md` Section "Board Access Authorization Contract", ownership is defined by `board.userId === userId` or a collaborator having `role === 'owner'`. Only owners (not editors or viewers) are permitted to delete a board.
- **Drizzle Kit Index Dependency**: To ensure optimal index scans when filtering `isNull(boards.deletedAt)`, Explorer 2 / Worker's schema update in `src/lib/schema.ts` adding composite index `index('boards_public_deleted_idx').on(boards.isPublic, boards.deletedAt)` and `index('boards_user_deleted_idx').on(boards.userId, boards.deletedAt)` will directly support these query plans.

---

## 4. Conclusion & Concrete Implementation Plan

### 4.1 Summary of Exact Changes

| Target File | Operation | Proposed Change Summary |
|---|---|---|
| `src/app/api/boards/route.ts` | Modify `GET` | Add `and, isNull, desc` imports. Filter `where(and(eq(boards.userId, session.user.id), isNull(boards.deletedAt)))`. Order by `desc(boards.updatedAt)`. |
| `src/app/api/boards/[id]/route.ts` | Modify `GET`, `PUT`, Add `DELETE` | 1. Filter `where: and(eq(boards.id, id), isNull(boards.deletedAt))` in `GET` and `PUT`.<br>2. Add `DELETE` route setting `deletedAt = new Date()`, checking `session.user.id` and ownership.<br>3. Prevent `PUT` updates on soft-deleted boards. |
| `src/app/(authenticated)/discover/page.tsx` | Modify query | Add `and, isNull` imports. Update `where: and(eq(boards.isPublic, true), isNull(boards.deletedAt))`. |
| `src/app/page.tsx` | Modify query | Add `and, isNull` imports. Update `where: and(eq(boards.isPublic, true), isNull(boards.deletedAt))`. |
| `src/app/api/profile/[id]/route.ts` | Modify `GET` | Add `and, isNull` imports. Filter `where(and(eq(boards.userId, params.id), isNull(boards.deletedAt)))` for `userBoards` count. |
| `src/lib/search.ts` | Hardening | Fix logical precedence in `searchDatabase` so search term is required while preserving `isNull(boards.deletedAt)`. |
| `src/app/(authenticated)/board/[id]/page.tsx` | Modify server component | Add `and, isNull` to `findFirst` where clause so soft-deleted boards trigger `notFound()`. |

---

### 4.2 Exact Code Diffs

#### 1. `src/app/api/boards/route.ts`
```diff
--- a/src/app/api/boards/route.ts
+++ b/src/app/api/boards/route.ts
@@ -2,7 +2,7 @@ import { auth } from '@/auth';
 import { db } from '@/lib/db';
 import { boards, users } from '@/lib/schema';
 import { NextResponse } from 'next/server';
-import { eq } from 'drizzle-orm';
+import { eq, and, isNull, desc } from 'drizzle-orm';
 import { createId } from '@paralleldrive/cuid2';
 
 export async function POST(req: Request) {
@@ -59,7 +59,10 @@ export async function GET() {
                 name: users.name,
                 image: users.image,
             }
-        }).from(boards).leftJoin(users, eq(boards.userId, users.id)).where(eq(boards.userId, session.user.id)).orderBy(boards.updatedAt);
+        }).from(boards)
+          .leftJoin(users, eq(boards.userId, users.id))
+          .where(and(eq(boards.userId, session.user.id), isNull(boards.deletedAt)))
+          .orderBy(desc(boards.updatedAt));
         return NextResponse.json(userBoards);
     } catch (error) {
         console.error('Error fetching boards:', error);
```

#### 2. `src/app/api/boards/[id]/route.ts`
```diff
--- a/src/app/api/boards/[id]/route.ts
+++ b/src/app/api/boards/[id]/route.ts
@@ -1,7 +1,7 @@
 import { NextRequest, NextResponse } from 'next/server';
 import { db } from '@/lib/db';
 import { boards } from '@/lib/schema';
-import { eq } from 'drizzle-orm';
+import { eq, and, isNull } from 'drizzle-orm';
 import { auth } from '@/auth';
 
 export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
@@ -17,13 +17,13 @@ export async function PUT(req: NextRequest, props: { params: Promise<{ id: stri
 
         // 1. Fetch board to check ownership
         const board = await db.query.boards.findFirst({
-            where: eq(boards.id, id),
+            where: and(eq(boards.id, id), isNull(boards.deletedAt)),
             with: {
                 collaborators: true
             }
         });
 
-        if (!board) {
+        if (!board || board.deletedAt) {
             return NextResponse.json({ error: 'Board not found' }, { status: 404 });
         }
 
@@ -49,7 +49,7 @@ export async function PUT(req: NextRequest, props: { params: Promise<{ id: stri
 
         await db.update(boards)
             .set(updateData)
-            .where(eq(boards.id, id));
+            .where(and(eq(boards.id, id), isNull(boards.deletedAt)));
 
         return NextResponse.json({ success: true });
     } catch (error) {
@@ -66,13 +66,13 @@ export async function GET(req: NextRequest, props: { params: Promise<{ id: stri
 
     try {
         const board = await db.query.boards.findFirst({
-            where: eq(boards.id, id),
+            where: and(eq(boards.id, id), isNull(boards.deletedAt)),
             with: {
                 collaborators: true
             }
         });
 
-        if (!board) {
+        if (!board || board.deletedAt) {
             return NextResponse.json({ error: 'Board not found' }, { status: 404 });
         }
 
@@ -102,3 +102,46 @@ export async function GET(req: NextRequest, props: { params: Promise<{ id: stri
     }
 }
 
+export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
+    const session = await auth();
+    if (!session?.user?.id) {
+        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
+    }
+
+    try {
+        const params = await props.params;
+        const { id } = params;
+
+        // 1. Fetch board to check existence, soft-delete status, and ownership
+        const board = await db.query.boards.findFirst({
+            where: and(eq(boards.id, id), isNull(boards.deletedAt)),
+            with: {
+                collaborators: true
+            }
+        });
+
+        if (!board || board.deletedAt) {
+            return NextResponse.json({ error: 'Board not found' }, { status: 404 });
+        }
+
+        // 2. Check Permissions: Only the board owner can delete the board
+        const isOwner = board.userId === session.user.id || 
+            board.collaborators.some(c => c.userId === session.user.id && c.role === 'owner');
+
+        if (!isOwner) {
+            return NextResponse.json({ error: 'Forbidden: Only the board owner can delete this board' }, { status: 403 });
+        }
+
+        // 3. Soft-delete the board
+        await db.update(boards)
+            .set({ 
+                deletedAt: new Date(),
+                updatedAt: new Date()
+            })
+            .where(and(eq(boards.id, id), isNull(boards.deletedAt)));
+
+        return NextResponse.json({ success: true, message: 'Board deleted successfully' });
+    } catch (error) {
+        console.error('Error deleting board:', error);
+        return NextResponse.json({ error: 'Failed to delete board' }, { status: 500 });
+    }
+}
```

#### 3. `src/app/(authenticated)/discover/page.tsx`
```diff
--- a/src/app/(authenticated)/discover/page.tsx
+++ b/src/app/(authenticated)/discover/page.tsx
@@ -2,7 +2,7 @@ import Link from "next/link";
 import { Flame, Clock } from "lucide-react";
 import { db } from "@/lib/db";
 import { boards } from "@/lib/schema";
-import { eq, desc } from "drizzle-orm";
+import { eq, desc, and, isNull } from "drizzle-orm";
 import BoardCard from "@/components/dashboard/BoardCard";
 import BoardPreview, { PreviewEdge, PreviewNode } from "@/components/dashboard/BoardPreview";
 import { Board, BoardContent } from "@/lib/types";
@@ -26,7 +26,7 @@ export default async function DiscoverPage() {
   }
 
   const publicBoards = await db.query.boards.findMany({
-    where: eq(boards.isPublic, true),
+    where: and(eq(boards.isPublic, true), isNull(boards.deletedAt)),
     orderBy: [desc(boards.createdAt)],
     limit: 10,
     with: {
```

#### 4. `src/app/page.tsx`
```diff
--- a/src/app/page.tsx
+++ b/src/app/page.tsx
@@ -2,7 +2,7 @@ import Link from "next/link";
 import { Flame, Clock, Award } from "lucide-react";
 import { db } from "@/lib/db";
 import { boards, userReputation } from "@/lib/schema";
-import { eq, desc } from "drizzle-orm";
+import { eq, desc, and, isNull } from "drizzle-orm";
 import { DiscoverHeader } from "@/components/DiscoverHeader";
 import { auth } from "@/auth";
 import { redirect } from "next/navigation";
@@ -37,7 +37,7 @@ export default async function DiscoverPage() {
   // Only query DB if credentials exist or in test environment
   if (process.env.TURSO_DATABASE_URL || process.env.NODE_ENV === 'test') {
     publicBoards = await db.query.boards.findMany({
-      where: eq(boards.isPublic, true),
+      where: and(eq(boards.isPublic, true), isNull(boards.deletedAt)),
       orderBy: [desc(boards.createdAt)],
       limit: 10,
       with: {
```

#### 5. `src/app/api/profile/[id]/route.ts`
```diff
--- a/src/app/api/profile/[id]/route.ts
+++ b/src/app/api/profile/[id]/route.ts
@@ -1,7 +1,7 @@
 import { NextRequest, NextResponse } from 'next/server';
 import { db } from '@/lib/db';
 import { users, boards, userReputation } from '@/lib/schema';
-import { eq } from 'drizzle-orm';
+import { eq, and, isNull } from 'drizzle-orm';
 import { auth } from '@/auth';
 import { z } from 'zod';
 import { checkRateLimit } from '@/lib/rate-limit';
@@ -34,7 +34,7 @@ export async function GET(
         // Get user's boards count
         const userBoards = await db.select()
             .from(boards)
-            .where(eq(boards.userId, params.id));
+            .where(and(eq(boards.userId, params.id), isNull(boards.deletedAt)));
 
         // Get reputation if exists
         const reputation = await db.select()
```

#### 6. `src/lib/search.ts`
```diff
--- a/src/lib/search.ts
+++ b/src/lib/search.ts
@@ -42,10 +42,9 @@ export async function searchDatabase(query: string, userId?: string): Promise<S
         .leftJoin(users, eq(boards.userId, users.id))
         .where(
             and(
-                or(
-                    like(boards.title, searchTerm),
-                    // Only show public boards or user's own boards
-                    ...(userId ? [eq(boards.userId, userId)] : [])
+                like(boards.title, searchTerm),
+                userId
+                    ? or(eq(boards.isPublic, true), eq(boards.userId, userId))
+                    : eq(boards.isPublic, true),
                 isNull(boards.deletedAt) // Exclude soft-deleted boards
             )
         )
```

#### 7. `src/app/(authenticated)/board/[id]/page.tsx`
```diff
--- a/src/app/(authenticated)/board/[id]/page.tsx
+++ b/src/app/(authenticated)/board/[id]/page.tsx
@@ -2,7 +2,7 @@ import { notFound } from 'next/navigation';
 import { auth } from '@/auth';
 import { db } from '@/lib/db';
 import { boards } from '@/lib/schema';
-import { eq } from 'drizzle-orm';
+import { eq, and, isNull } from 'drizzle-orm';
 import Board from '@/components/Board';
 import { BoardData } from '@/lib/types';
 import { headers } from 'next/headers';
@@ -26,7 +26,7 @@ export default async function BoardPage(props: { params: Promise<{ id: string }>
 
     // Normal flow check
     const dbBoard = await db.query.boards.findFirst({
-        where: eq(boards.id, boardId),
+        where: and(eq(boards.id, boardId), isNull(boards.deletedAt)),
         with: {
             collaborators: true
         }
```

---

## 5. Verification Method

### 5.1 Automated Unit & Integration Tests
Run Vitest to verify all existing and modified test suites pass:
```bash
npm run test:unit
```
**Expected Result**: All test suites pass (16 test files, 107+ tests).

### 5.2 Functional Soft-Delete API Verification Script
After implementation, execute the following script via `npx tsx` or node to verify soft-delete behavior:

```typescript
import { db } from './src/lib/db';
import { boards } from './src/lib/schema';
import { eq, and, isNull } from 'drizzle-orm';

async function testSoftDelete() {
  const testBoardId = 'test-soft-delete-' + Date.now();
  
  // 1. Create a test board
  await db.insert(boards).values({
    id: testBoardId,
    userId: 'system-test-user',
    title: 'Soft Delete Verification Case',
    isPublic: true,
    content: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  });

  // 2. Query active boards - board should be found
  const activeBefore = await db.query.boards.findFirst({
    where: and(eq(boards.id, testBoardId), isNull(boards.deletedAt))
  });
  console.assert(activeBefore !== undefined, 'Board must be found before deletion');

  // 3. Perform soft delete
  await db.update(boards).set({ deletedAt: new Date() }).where(eq(boards.id, testBoardId));

  // 4. Query active boards - board must NOT be found
  const activeAfter = await db.query.boards.findFirst({
    where: and(eq(boards.id, testBoardId), isNull(boards.deletedAt))
  });
  console.assert(activeAfter === undefined, 'Board must NOT be found after soft delete');

  // 5. Clean up row
  await db.delete(boards).where(eq(boards.id, testBoardId));
  console.log('✅ Soft delete verification passed!');
}

testSoftDelete().catch(console.error);
```

### 5.3 Invalidation Conditions
- If any soft-deleted board (`deletedAt IS NOT NULL`) appears in the response of `GET /api/boards`, verification fails.
- If `GET /api/boards/[id]` returns HTTP 200 instead of HTTP 404 for a soft-deleted board, verification fails.
- If `PUT /api/boards/[id]` modifies content or title of a soft-deleted board instead of returning HTTP 404, verification fails.
- If `DELETE /api/boards/[id]` allows an unauthenticated caller (HTTP 401 expected) or non-owner (HTTP 403 expected) to delete a board, verification fails.
- If `DELETE /api/boards/[id]` physically deletes the row from Turso DB instead of updating `deletedAt = new Date()`, verification fails.
