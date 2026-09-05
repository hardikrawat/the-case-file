# Handoff Report: Features 6 & 7 Investigation
**Milestone 2: Security Hardening & Auth Protection**  
**Investigator**: Explorer 1 (`teamwork_preview_explorer_m2_gen2_1`)  
**Target Focus**: Feature 6 (Eliminate All Test Auth Bypasses) & Feature 7 (Route Protection & Middleware Hardening)  
**Date**: 2026-09-04

---

## 1. Observation

A systematic codebase-wide forensic investigation was conducted across all files in `src/`, `tests/`, and root configuration files.

### 1.1 All Occurrences of `x-test-bypass` and Bypass Logic Across the Codebase

Grep search for `x-test-bypass`, `bypass`, `test-user-123`, and `headers()` revealed the following exact locations:

#### (A) `src/auth.ts` (Lines 13, 15, 113–136)
```typescript
13: import { headers } from "next/headers";
14: 
15: const { handlers: internalHandlers, auth: internalAuth, signIn: internalSignIn, signOut: internalSignOut } = NextAuth({
...
113: // eslint-disable-next-line @typescript-eslint/no-explicit-any
114: export const auth: any = async (...args: any[]) => {
115:     try {
116:         const headerList = await headers();
117:         if (headerList.get('x-test-bypass') === 'true') {
118:             return {
119:                 user: {
120:                     id: 'test-user-123',
121:                     email: 'test@example.com',
122:                     name: 'Test Detective'
123:                 },
124:                 expires: new Date(Date.now() + 86400000).toISOString()
125:             };
126:         }
127:     } catch {
128:         // Ignore error if headers() is called outside of request context
129:     }
130:     // eslint-disable-next-line @typescript-eslint/no-explicit-any
131:     return (internalAuth as any)(...args);
132: };
133: 
134: export const handlers = internalHandlers;
135: export const signIn = internalSignIn;
136: export const signOut = internalSignOut;
```

#### (B) `src/auth.config.ts` (Lines 10–13, 16)
```typescript
10:         authorized({ auth, request: { nextUrl, headers } }) {
11:             // Allow bypass in test environment
12:             const isTestBypass = headers.get('x-test-bypass') === 'true';
13:             if (isTestBypass) return true;
14: 
15:             const isLoggedIn = !!auth?.user;
16:             const protectedPaths = ['/cases', '/discover', '/settings', '/starred'];
17:             const isOnProtected = protectedPaths.some(path => nextUrl.pathname.startsWith(path));
```

#### (C) `src/app/(authenticated)/board/[id]/page.tsx` (Lines 7, 22–23, 28–33, 35–47)
```typescript
5: import { eq } from 'drizzle-orm';
6: import { notFound, redirect } from 'next/navigation';
7: import { headers } from 'next/headers';
...
22:     const headerList = await headers();
23:     const isTestBypass = headerList.get('x-test-bypass') === 'true';
...
28:     const dbBoard = await db.query.boards.findFirst({
29:         where: eq(boards.id, boardId),
30:         with: {
31:             collaborators: true
32:         }
33:     });
34: 
35:     if (dbBoard) {
36:         board = dbBoard as unknown as BoardData;
37:     } else if (isTestBypass) {
38:         board = {
39:             id: boardId,
40:             title: 'Test Case',
41:             isPublic: true,
42:             userId: 'test-user-123',
43:             createdAt: new Date(),
44:             updatedAt: new Date(),
45:             collaborators: []
46:         };
47:     }
```

#### (D) Test Configurations and Test Files
- `playwright.config.ts`: Line 35 contains a comment `// Zero x-test-bypass headers - genuine NextAuth session cookies only`. No `extraHTTPHeaders` or bypass tokens are set in `playwright.config.ts`.
- `tests/e2e/smoke.spec.ts`: Clean. No `x-test-bypass` headers sent.
- `tests/e2e/helpers/api-client.ts`: Lines 71–72 actively defend against accidental leakage:
  ```typescript
  // ZERO x-test-bypass headers allowed
  headers.delete('x-test-bypass');
  ```
- `tests/e2e/tier1/security.spec.ts`: Lines 157–172 contain adversarial assertion `T1-SEC-06: Elimination of All Test Bypasses (x-test-bypass Rejected)` which actively verifies that requests with `x-test-bypass: true` return `401 Unauthorized`.
- `tests/e2e/helpers/auth.ts`: Already implements authentic NextAuth v5 JWE cookie generation using `@auth/core/jwt` with `salt: 'authjs.session-token'` and `getAuthSecret()` for genuine session simulation without backdoors.

---

### 1.2 `src/auth.ts` Export Mechanism
- NextAuth v5 (`next-auth@5.0.0-beta.30`) naturally returns `{ handlers, auth, signIn, signOut }` from `NextAuth(config)`.
- Currently, `src/auth.ts` captures these into temporary internal variables (`internalHandlers`, `internalAuth`, `internalSignIn`, `internalSignOut`), wraps `auth` in a custom async function inspecting `headerList.get('x-test-bypass')`, and re-exports them.
- All 16 consuming files across `src/app/` (e.g. `src/app/api/me/route.ts`, `src/app/api/boards/route.ts`, `src/app/api/auth/[...nextauth]/route.ts`, `src/app/(authenticated)/board/[id]/page.tsx`, etc.) import `{ auth }` or `{ handlers }` directly from `@/auth`.

---

### 1.3 `src/app/(authenticated)/board/[id]/page.tsx` Soft-Delete & Mock Fabrication
- **Soft-Delete Handling**: Line 29 queries `where: eq(boards.id, boardId)`. It completely fails to filter out soft-deleted boards (`deletedAt IS NOT NULL`). If a soft-deleted board is requested, it is returned instead of triggering `notFound()`.
- **Mock Board Fabrication**: Lines 37–47 synthesize an in-memory board belonging to `test-user-123` whenever a board ID is not found in the DB and `x-test-bypass: true` is sent.
- **Permission Check**: Lines 53–66 check:
  ```typescript
  const session = await auth();
  const isPublic = board.isPublic;
  const userId = session?.user?.id;
  const isOwner = !!(userId && board.userId === userId);
  const isCollaborator = !!(userId && board.collaborators.some((c) => c.userId === userId));

  if (!isPublic && !isOwner && !isCollaborator) {
      if (!session) {
          redirect(`/login?callbackUrl=/board/${boardId}`);
      } else {
          notFound();
      }
  }
  ```

---

### 1.4 `src/auth.config.ts` and `src/middleware.ts` Route Protection
- `src/middleware.ts` runs on all non-static paths:
  ```typescript
  export default NextAuth(authConfig).auth;
  export const config = {
      matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
  };
  ```
- `src/auth.config.ts`:
  - `protectedPaths` currently only contains `['/cases', '/discover', '/settings', '/starred']`.
  - Missing paths: `/board`, `/profile`, `/leaderboard`.
  - Unauthenticated access to `/board/[id]`, `/profile/[id]`, and `/leaderboard` currently bypasses the middleware route guard.
  - When `authorized` returns `false`, NextAuth v5 automatically redirects the unauthenticated user to `pages.signIn` (`/login`), appending `?callbackUrl=...`.

---

## 2. Logic Chain

1. **Vulnerability in `src/auth.ts` (Observation 1.1A)**:
   - Any client sending HTTP header `x-test-bypass: 'true'` receives a forged session object:
     `{ user: { id: 'test-user-123', email: 'test@example.com', name: 'Test Detective' } }`.
   - This bypasses all authentication checks in route handlers (e.g. `GET /api/me`, `GET /api/boards`, `POST /api/boards`).
   - Removing lines 13 and 113–136, and directly exporting `export const { handlers, auth, signIn, signOut } = NextAuth({...})`, completely eliminates this backdoor and restores TypeScript type safety.

2. **Vulnerability in `src/auth.config.ts` (Observation 1.1B)**:
   - Lines 11–13 allow anyone with `x-test-bypass: 'true'` to access any protected route even without a session token.
   - Removing lines 11–13 eliminates the route guard bypass.
   - Destructuring of `headers` in `authorized({ auth, request: { nextUrl, headers } })` becomes unnecessary and should be simplified to `authorized({ auth, request: { nextUrl } })`.

3. **Incomplete Route Protection in `src/auth.config.ts` (Observation 1.4)**:
   - `protectedPaths` omits `/board`, `/profile`, `/leaderboard`.
   - Because `(authenticated)/leaderboard/page.tsx` does not perform client-side auth redirection, unauthenticated visitors can view the leaderboard.
   - Because `(authenticated)/profile/[id]/page.tsx` does not perform client-side auth redirection, unauthenticated visitors can view user profiles.
   - Updating `protectedPaths` to `['/cases', '/discover', '/board', '/profile', '/leaderboard', '/settings', '/starred']` closes all route exposure gaps and aligns with `ORIGINAL_REQUEST.md` (lines 44, 93) and `SCOPE.md` (line 22).

4. **Security & State Flaws in `src/app/(authenticated)/board/[id]/page.tsx` (Observation 1.1C, 1.3)**:
   - The query `where: eq(boards.id, boardId)` does not check `isNull(boards.deletedAt)`. This violates soft-delete persistence isolation (Feature 5 / Milestone 1 criteria).
   - If a board does not exist, `else if (isTestBypass)` fabricates a dummy board with `userId: 'test-user-123'`. This allows arbitrary fictitious boards to be rendered when the bypass header is supplied.
   - Removing `headers` import, removing `isTestBypass`, adding `isNull(boards.deletedAt)` to the `where` clause, and returning `notFound()` if `!dbBoard` fixes both the security backdoor and the soft-delete bug.

5. **Test Harness Preparedness (Observation 1.1D)**:
   - The test infrastructure in `tests/e2e/helpers/auth.ts` and `api-client.ts` already generates real NextAuth JWE tokens and rejects `x-test-bypass`.
   - Unit tests (`vitest run`) all pass (17 test files, 126 tests).
   - Therefore, removing `x-test-bypass` from production code will not break valid E2E tests, and will cause adversarial test `T1-SEC-06` to pass.

---

## 3. Caveats

1. **API Route Protection Mechanism**:
   - `src/middleware.ts` has matcher `matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"]`, which purposefully excludes `/api/*` from middleware redirection.
   - This is correct and necessary: API routes must return JSON `401 Unauthorized` responses rather than HTTP 307 HTML redirects to `/login`. Route handlers must independently check `session = await auth()` and return `401` if unauthenticated.
2. **Public vs. Authenticated Boards**:
   - `/board` is listed as a protected path in `auth.config.ts`. This means even public boards on `/board/[id]` require the user to be logged in before viewing. This is explicitly mandated by `ORIGINAL_REQUEST.md` ("All authenticated routes (`/cases`, `/discover`, `/board/*`, `/profile/*`, `/leaderboard`, `/settings`) enforce authentication") and `SCOPE.md`.
3. **Build Blocker in `Board.tsx` (Milestone 3)**:
   - `npx tsc --noEmit` reports missing `connectMode`, `sourceNodeId`, `setSourceNodeId` in `src/components/Board.tsx`. This is an existing build issue cataloged as Feature 16 for Milestone 3 and does not affect the auth files inspected.

---

## 4. Conclusion & Precise Code Modifications

### 4.1 Changes to `src/auth.ts`
- **File**: `/Users/hardikrawat/Documents/the-case-file/src/auth.ts`
- **Action**:
  1. Remove line 13: `import { headers } from "next/headers";`
  2. Change line 15:
     ```typescript
     // BEFORE:
     const { handlers: internalHandlers, auth: internalAuth, signIn: internalSignIn, signOut: internalSignOut } = NextAuth({
     // AFTER:
     export const { handlers, auth, signIn, signOut } = NextAuth({
     ```
  3. Delete lines 113 to 136 (the custom `auth` wrapper and aliases).

```typescript
// Proposed src/auth.ts (end of NextAuth configuration):
    session: {
        strategy: "jwt", // Use JWT for credentials provider
        maxAge: 30 * 24 * 60 * 60, // 30 days
        updateAge: 24 * 60 * 60, // 24 hours - refresh session token
    },
});
```

---

### 4.2 Changes to `src/auth.config.ts`
- **File**: `/Users/hardikrawat/Documents/the-case-file/src/auth.config.ts`
- **Action**:
  1. Simplify `authorized` parameters: change `({ auth, request: { nextUrl, headers } })` to `({ auth, request: { nextUrl } })`.
  2. Delete lines 11–13 (`isTestBypass` check).
  3. Expand `protectedPaths` at line 16 to include `/board`, `/profile`, `/leaderboard`:
     ```typescript
     // BEFORE:
     const protectedPaths = ['/cases', '/discover', '/settings', '/starred'];

     // AFTER:
     const protectedPaths = [
         '/cases',
         '/discover',
         '/board',
         '/profile',
         '/leaderboard',
         '/settings',
         '/starred'
     ];
     ```
  4. Ensure route matching handles exact and subpath matches:
     ```typescript
     const isOnProtected = protectedPaths.some(
         path => nextUrl.pathname === path || nextUrl.pathname.startsWith(`${path}/`)
     );
     ```

---

### 4.3 Changes to `src/app/(authenticated)/board/[id]/page.tsx`
- **File**: `/Users/hardikrawat/Documents/the-case-file/src/app/(authenticated)/board/[id]/page.tsx`
- **Action**:
  1. Remove `headers` import: remove line 7 (`import { headers } from 'next/headers';`).
  2. Update drizzle imports: change line 5 from `import { eq } from 'drizzle-orm';` to `import { and, eq, isNull } from 'drizzle-orm';`.
  3. Remove lines 22–23 (`headerList` and `isTestBypass`).
  4. Update board query at lines 28–33 to check `isNull(boards.deletedAt)`:
     ```typescript
     const dbBoard = await db.query.boards.findFirst({
         where: and(eq(boards.id, boardId), isNull(boards.deletedAt)),
         with: {
             collaborators: true
         }
     });
     ```
  5. Delete lines 37–47 (`else if (isTestBypass) { ... }`).
  6. Directly set:
     ```typescript
     if (!dbBoard) {
         notFound();
     }

     const board = dbBoard as unknown as BoardData;
     ```

---

## 5. Verification Method

To independently verify the implementation of Features 6 & 7:

1. **Codebase Zero-Bypass Inspection**:
   Run grep search to confirm zero active test bypasses in application source code:
   ```bash
   rg "x-test-bypass" src/
   ```
   **Expected**: 0 matches in `src/`.

2. **Adversarial Test Bypasses Rejection Test**:
   Execute Playwright security spec:
   ```bash
   npx playwright test tests/e2e/tier1/security.spec.ts -g "T1-SEC-06"
   ```
   **Expected**:
   - `GET /api/me` with `headers: { 'x-test-bypass': 'true' }` returns `401 Unauthorized`.
   - `GET /api/boards` with `headers: { 'x-test-bypass': 'true' }` returns `401 Unauthorized`.

3. **Route Protection Verification**:
   Execute Playwright route middleware spec:
   ```bash
   npx playwright test tests/e2e/tier1/security.spec.ts -g "T1-SEC-07"
   ```
   **Expected**:
   - Navigation to `/cases` without session cookie redirects to `/login`.
   - Navigation to `/settings` without session cookie redirects to `/login`.
   - Navigation to `/board/[id]`, `/profile/[id]`, and `/leaderboard` without session cookie redirects to `/login`.

4. **Soft-Deleted Board Rejection on `/board/[id]`**:
   Run integration tests:
   ```bash
   npm run test:unit tests/integration/soft-delete-api.test.ts
   ```
   **Expected**: All 14 tests pass.

5. **Unit & Integration Suite Regression**:
   ```bash
   npm run test:unit
   ```
   **Expected**: 17 test files, 126+ tests pass with 0 failures.

### Invalidation Conditions
- Any request with `x-test-bypass: true` returning HTTP 200 or authenticating a user.
- Any unauthenticated request to `/board/*`, `/profile/*`, or `/leaderboard` succeeding without redirecting to `/login`.
- Any soft-deleted board being rendered by `/board/[id]`.
