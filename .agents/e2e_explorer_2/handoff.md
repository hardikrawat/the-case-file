# Handoff Report: E2E Explorer 2 (Tier 1 & Tier 2 Specifications)

**Author**: Explorer 2 (`e2e_explorer_2`)  
**Recipient**: `sub_orch_e2e` (`6bd03dee-8755-41ec-b6a0-6e521bb5b5b5`)  
**Working Directory**: `/Users/hardikrawat/Documents/the-case-file/.agents/e2e_explorer_2`  
**Date**: 2026-09-04  
**Type**: Hard Handoff (Investigation & Test Design Complete)

---

## 1. Observation

Direct code inspection of the repository revealed the following concrete findings:

1. **Database Client Silent Fallback (`src/lib/db.ts:5`)**:
   ```ts
   const url = process.env.TURSO_DATABASE_URL || ':memory:';
   ```
   When `TURSO_DATABASE_URL` is omitted or empty, `db.ts` falls back to `:memory:`, masking persistence failures.

2. **Test Auth Bypasses Active**:
   - `src/auth.ts:116-126`: Inspects `x-test-bypass` header and synthesizes `{ id: 'test-user-123', email: 'test@example.com' }`.
   - `src/auth.config.ts:12-13`: Returns `true` for route authorization if `x-test-bypass === 'true'`.
   - `src/app/(authenticated)/board/[id]/page.tsx:23, 37-47`: Creates synthetic in-memory board object for `test-user-123` when `x-test-bypass` is present.
   - `tests/e2e/smoke.spec.ts:34`: Actively passes `'x-test-bypass': 'true'` to API requests.

3. **Sensitive Token & Credential Leakage**:
   - `src/app/api/auth/signup/route.ts:78`: Returns `verificationToken` directly in response body.
   - `src/app/api/auth/forgot-password/route.ts:45`: Returns `resetToken: token` directly in response body.
   - `src/app/api/me/route.ts:30-35`: Returns `{ ...user }` including raw `passwordHash`.
   - `src/app/api/profile/[id]/route.ts:117`: In `PUT`, returns `updated[0]` directly from `db.update(users).returning()`, leaking `passwordHash`.
   - `src/app/api/profile/[id]/route.ts:48`: In `GET`, returns `email: user.email` in public unauthenticated user profile.

4. **SSRF Vulnerability (`src/app/api/preview/route.ts:13, 17`)**:
   ```ts
   if (!url.startsWith('http')) {
       return NextResponse.json({ error: 'Invalid URL protocol' }, { status: 400 });
   }
   const response = await fetch(url, ...);
   ```
   Accepts any HTTP address, including loopback `127.0.0.1`, cloud metadata `169.254.169.254`, and private subnets (`10.0.0.0/8`, `192.168.0.0/16`).

5. **Route Protection Gaps (`src/auth.config.ts:16`)**:
   ```ts
   const protectedPaths = ['/cases', '/discover', '/settings', '/starred'];
   ```
   Routes `/board/*`, `/profile/*`, and `/leaderboard` are absent from `protectedPaths`.

6. **Canvas Evidence Node Deficiencies**:
   - `src/components/nodes/`: Contains only `ArticleNode.tsx`, `ImageNode.tsx`, `StickyNoteNode.tsx`, `TextNode.tsx`. `LinkNode.tsx` is completely missing.
   - `src/components/Board.tsx:34-39`: `nodeTypes` registers only `sticky`, `image`, `text`, `article`.
   - `src/components/ui/Toolbar.tsx`: Defines `addSticky`, `addText`, `addImage`, `addArticle`; no `addLink` button or handler.
   - No node deletion controls exist within individual node component layouts.
   - `src/components/edges/StringEdge.tsx:28`: Calls `setEdges((edges) => edges.filter((e) => e.id !== id))` on the local ReactFlow instance rather than synchronizing with `useStore.deleteEdge`.

7. **Board State Contamination (`src/store/useStore.ts:134-147`)**:
   Zustand store uses `persist` middleware with static global key `case-file-storage`. Nodes and edges are written to global `localStorage`, polluting the board when navigating between different board IDs.

8. **Orphaned Panels in Board UI**:
   - `Board.tsx` contains 0 occurrences of `CommentsPanel`, `CollaboratorsPanel`, `VersionHistory`, or `ExportModal`. All 4 panel components exist in `src/components/` but are never rendered.
   - `src/app/api/boards/[id]/collaborators/route.ts`: Has only `GET` and `POST` handlers. `DELETE` and `PATCH` methods are missing. `POST` does not support email-based user lookup.
   - `src/app/api/comments/route.ts:40-44`: `GET` selects directly from `comments` without left-joining `users` or checking `canView` permissions.
   - `src/app/api/leaderboard/route.ts:12-16`: Queries `userReputation` with no join on `users`.

9. **Reputation Engine Omissions (`src/lib/reputation.ts`)**:
   `ReputationAction` type omits `'contribution_accepted'`. Core routes (`/api/boards` POST, `/api/comments` POST, `/api/contributions/[id]/merge` POST) do not invoke `awardPoints`.

---

## 2. Logic Chain

1. **Premise**: An opaque-box test suite must validate real system behavior against specified requirements without depending on implementation compromises or artificial test backdoors.
2. **From Observation 2**: Existing tests in `tests/e2e/smoke.spec.ts` pass `x-test-bypass: true`, causing the application to fake sessions and skip real authentication checks.
3. **Inference**: All E2E test suites must replace `x-test-bypass` with authentic session cookies (via NextAuth credentials login or mocked session routes via Playwright route interception in `auth.fixtures.ts`).
4. **From Observation 3**: Current auth endpoints return sensitive tokens (`verificationToken`, `resetToken`) and credentials (`passwordHash`).
5. **Inference**: Tier 1 tests (T1-SEC-01 to T1-SEC-05) must assert that response payloads contain only public IDs/messages and strictly omit token and hash properties.
6. **From Observation 4**: `/api/preview` performs unconstrained HTTP fetches.
7. **Inference**: Tier 2 tests (T2-SSRF-01 to T2-SSRF-06) must systematically probe loopback (`127.0.0.1`), metadata (`169.254.169.254`), private IP ranges, non-HTTP protocols, and malformed strings, verifying `400 Bad Request` responses.
8. **From Observations 6, 7, 8**: The evidence board has missing components (`LinkNode`), orphaned panels (`CommentsPanel`, `CollaboratorsPanel`, `VersionHistory`, `ExportModal`), un-synchronized string cutting, and localStorage state cross-contamination.
9. **Inference**: Tier 1 Canvas tests (T1-CANVAS-01 to T1-CANVAS-07, T1-STORE-01, T1-COMM-04, T1-COL-01, T1-VER-01, T1-EXP-01) must verify that all 5 node types mount and interact, individual nodes and edges can be deleted and cut, board state isolates cleanly per board ID, and all 4 panels open and function from the UI.
10. **From Observations 8 & 9**: Gamification and leaderboard systems lack user joins and event-driven point awards.
11. **Inference**: Tier 1 Reputation tests (T1-REP-01 to T1-REP-04) must verify database reputation point increments upon board creation, commenting, and contribution merging, as well as real user profile joins on `/api/leaderboard`.

---

## 3. Caveats

1. **Turso Cloud Live Connectivity vs. Local Testing**: While the remote Turso DB credentials are provided in `ORIGINAL_REQUEST.md`, local automated tests running in CI or offline environments must utilize `@libsql/client` against either the remote instance or a compliant local libsql daemon; fallback to `:memory:` must remain disabled.
2. **Parallel Milestone Work**: Milestone M1 (Turso DB), M2 (Security), M3 (Canvas/Panels), and M4 (Reputation) are executing concurrently. The test specifications defined in `report.md` represent the final authoritative requirements; some tests are expected to fail until those milestone implementations land.
3. **OAuth Providers**: GitHub and Google OAuth providers are conditionally enabled in `src/auth.ts` only if client IDs exist in the environment; all auth test fixtures must use the email/credentials flow.

---

## 4. Conclusion

The exploration has identified the root causes of security vulnerabilities and feature gaps across 'The Case File'. A structured two-tier test plan comprising **38 Tier 1 Feature Coverage test cases** and **26 Tier 2 Boundary/Corner Case test cases** has been designed and published in:
`/Users/hardikrawat/Documents/the-case-file/.agents/e2e_explorer_2/report.md`

This specification covers:
- Complete removal of `x-test-bypass` and verification of zero token/hash leakage.
- SSRF prevention on `/api/preview` against loopback, metadata, and private IP ranges.
- Full 5-node Canvas coverage (Sticky, Text, Image, Article, Link) with node deletion and red string cut synchronization.
- Mounting and end-to-end verification of Comments, Collaborators, Version History, and Export panels.
- Event-driven reputation awards and unified leaderboard rankings.
- Comprehensive boundary, rate limiting, and corner-case constraints.

---

## 5. Verification Method

To independently verify the findings and test specifications:

1. **Verify Token Leakage**:
   ```bash
   # Inspect signup route token response
   grep -n "verificationToken" /Users/hardikrawat/Documents/the-case-file/src/app/api/auth/signup/route.ts
   # Inspect forgot-password route token response
   grep -n "resetToken" /Users/hardikrawat/Documents/the-case-file/src/app/api/auth/forgot-password/route.ts
   # Inspect me route passwordHash exposure
   grep -n "reputation" /Users/hardikrawat/Documents/the-case-file/src/app/api/me/route.ts
   ```

2. **Verify SSRF Flaw**:
   ```bash
   grep -n "fetch(url" /Users/hardikrawat/Documents/the-case-file/src/app/api/preview/route.ts
   ```

3. **Verify Canvas Missing Link Node & Orphaned Panels**:
   ```bash
   # Verify node types in Board.tsx
   grep -n "nodeTypes" /Users/hardikrawat/Documents/the-case-file/src/components/Board.tsx
   # Verify orphaned panels in Board.tsx
   grep -E "CommentsPanel|CollaboratorsPanel|VersionHistory|ExportModal" /Users/hardikrawat/Documents/the-case-file/src/components/Board.tsx
   ```

4. **Verify Test Specifications Artifact**:
   Inspect `/Users/hardikrawat/Documents/the-case-file/.agents/e2e_explorer_2/report.md` for exact test cases, endpoints, assertions, and inputs.

5. **Execute Verification Runner**:
   ```bash
   npm run test
   ```
   (Invalidation condition: Any test that passes using `x-test-bypass` or fails to detect `verificationToken` or `passwordHash` leakage is invalid.)
