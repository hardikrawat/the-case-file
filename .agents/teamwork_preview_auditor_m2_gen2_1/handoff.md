# Forensic Audit Report — Milestone 2: Security Hardening & Auth Protection

**Work Product**: Milestone 2 Security Hardening & Auth Protection Code Changes (`src/auth.ts`, `src/auth.config.ts`, `src/app/(authenticated)/board/[id]/page.tsx`, `src/app/api/preview/route.ts`, `src/lib/rate-limit.ts`, `src/lib/auth-checks.ts`, `src/app/api/upload/route.ts`, `src/app/api/auth/*`, `src/app/api/profile/*`, etc.)  
**Profile**: General Project (Development Integrity Mode per `ORIGINAL_REQUEST.md`)  
**Verdict**: **CLEAN**

---

## 1. Observation

### Static Analysis & Integrity Forensics
- **Elimination of Auth Bypasses**:
  - `git grep -i "x-test-bypass" src/` returned exit code 1 (0 matches found across the entire `src/` codebase).
  - `git grep -i "bypass" src/` returned exit code 1 (0 matches found).
  - `src/auth.ts` exports `{ handlers, auth, signIn, signOut } = NextAuth(...)` directly. No `next/headers` import, no request header inspection, no mock session synthesis.
  - `src/auth.config.ts` enforces `protectedPaths = ['/cases', '/discover', '/board', '/profile', '/leaderboard', '/settings', '/starred']`. Returns `false` for unauthenticated requests, triggering redirect to `/login`. No test bypass checks exist in `authorized` callback.
  - `src/app/(authenticated)/board/[id]/page.tsx` executes real database lookup:
    ```typescript
    const dbBoard = await db.query.boards.findFirst({
        where: and(eq(boards.id, boardId), isNull(boards.deletedAt)),
        with: {
            collaborators: true
        }
    });
    if (!dbBoard) {
        notFound();
    }
    ```
    No mock board synthesis or bypass flag handling exists.

- **SSRF Hardening in `src/app/api/preview/route.ts`**:
  - Validates protocol strictly (`http:` or `https:`).
  - Inspects hostname and resolved IP addresses against comprehensive private subnets:
    - Loopback: `127.0.0.0/8`, `0.0.0.0/8`, `localhost`, `::1`, `::`
    - Cloud Metadata (IMDS): `169.254.0.0/16`
    - RFC 1918: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`
    - IPv6: Link-Local (`fe80::/10`), Unique Local (`fc00::/7`), IPv4-mapped IPv6 (`::ffff:...`)
    - Reserved/Special: `100.64.0.0/10`, `192.0.0.0/24`, `192.0.2.0/24`, `198.18.0.0/15`, `198.51.100.0/24`, `203.0.113.0/24`, `>= 224.0.0.0`
  - Uses `dns.lookup(host, { all: true })` for real DNS resolution and IP verification prior to connection.
  - Enforces `redirect: 'manual'` and re-validates each redirect hop URL and IP up to 3 hops.
  - Enforces 5-second `AbortSignal.timeout(5000)` and rate limiting (`checkRateLimit('preview:${ip}', 20, 60000)`).

- **Rate Limiting Atomicity in `src/lib/rate-limit.ts`**:
  - Implements an atomic SQLite UPSERT statement with `onConflictDoUpdate` and `.returning({ count, expiresAt })`.
  - Tested directly against remote Turso database (`the-case-file-hardikrawat.aws-ap-south-1.turso.io`): correctly enforces limits and returns true/false synchronously without TOCTOU race conditions.

- **Authorization & IDOR Protection in `src/lib/auth-checks.ts`**:
  - Validates board existence, soft-delete state (`isNull(boards.deletedAt)`), owner ID, and collaborator roles (`owner`, `editor`, `viewer`).
  - Correctly integrated across `boards/[id]`, `collaborators`, `versions`, `comments`, and `contributions` endpoints.

- **File Upload Hardening in `src/app/api/upload/route.ts`**:
  - Uses `detectImageMime` to inspect real magic bytes from raw buffer:
    - JPEG: `FF D8 FF`
    - PNG: `89 50 4E 47 0D 0A 1A 0A`
    - GIF: `GIF87a` / `GIF89a`
    - WebP: `RIFF....WEBP`
  - Rejects non-images regardless of client `file.type` or `file.name`.
  - Generates secure random filename via `createId()` with extension determined solely by detected MIME.

- **Credential & Token Leakage Prevention**:
  - `POST /api/auth/signup`: Returns `{ success: true, userId, message: "..." }`. No verification token in JSON response.
  - `src/app/signup/page.tsx`: Redirects to `/signup/verify?email=...` without exposing token in query params.
  - `POST /api/auth/forgot-password`: Returns generic `{ success: true, message: "..." }`. No reset token in response.
  - `GET /api/me`: Excludes `passwordHash` (`const { passwordHash, ...safeUser } = user;`).
  - `GET /api/profile/[id]`: Does not return email unless requesting user is account owner. Excludes private boards from `boardsCount` for non-owners.

---

## 2. Logic Chain

1. **Absence of Test Bypasses**:
   Inspection of `src/auth.ts`, `src/auth.config.ts`, `src/app/(authenticated)/board/[id]/page.tsx`, and `playwright.config.ts` demonstrates that all backdoors and mock test fallbacks have been removed. Every request to protected resources must pass through genuine session validation and database queries.

2. **Genuine Defenses without Facades**:
   Review of `src/app/api/preview/route.ts`, `src/lib/rate-limit.ts`, `src/lib/auth-checks.ts`, and `src/app/api/upload/route.ts` confirms that all security controls are active, genuine, and computationally sound. Empirical execution proved that SSRF evasion vectors (e.g. `127.0.0.1`, `169.254.169.254`, `0.0.0.0`, `10.0.0.1`, `[::1]`) are actively intercepted and rejected with HTTP 400 Bad Request.

3. **Database Integration**:
   Direct execution against the remote Turso DB confirmed that rate limiting operates via real atomic SQLite UPSERT queries without in-memory fallbacks or dummy mocks.

4. **Build & Test Attestation**:
   - `npm run lint`: 0 errors, 0 warnings.
   - `npm run test:unit`: 20 test files passed, 148 tests passed, 0 failed.
   - `npm run build`: 26/26 routes compiled and optimized into static/dynamic server assets with zero errors.

---

## 3. Caveats

- Playwright E2E tests in later milestones will require valid authentication credentials/cookies since all bypass headers have been completely eliminated.
- Standalone CLI scripts under `scripts/` are excluded from Next.js production build via `tsconfig.json`, which is the intended configuration.

---

## 4. Conclusion

The Milestone 2 work product is completely free of hardcoded test results, facade implementations, backdoors, or bypass mechanisms. All 10 security hardening features (Features 6–15) have been implemented genuinely and verified empirically against live remote database infrastructure.

**Final Integrity Verdict**: **CLEAN**

---

## 5. Verification Method

To independently reproduce the forensic audit verification:

1. **Verify Complete Elimination of Bypasses**:
   ```bash
   git grep -i "x-test-bypass" src/
   # Expected: Exit code 1 (no matches found)
   ```

2. **Run Linting**:
   ```bash
   npm run lint
   # Expected: "No ESLint warnings or errors"
   ```

3. **Run Unit & Integration Test Suite**:
   ```bash
   npm run test:unit
   # Expected: 20 passed (148 tests passed, 0 failed)
   ```

4. **Run Production Build**:
   ```bash
   npm run build
   # Expected: "Compiled successfully", "Generating static pages (26/26)", exit code 0
   ```

5. **Empirical SSRF Stress Test**:
   ```bash
   npx tsx -r dotenv/config --env-file=.env.local -e "
   import { GET } from './src/app/api/preview/route';
   import { NextRequest } from 'next/server';
   async function testSSRF() {
     const vectors = ['http://127.0.0.1', 'http://169.254.169.254', 'http://10.0.0.1', 'http://[::1]', 'file:///etc/passwd'];
     for (const v of vectors) {
       const req = new NextRequest('http://localhost:3000/api/preview?url=' + encodeURIComponent(v));
       const res = await GET(req);
       if (res.status !== 400) throw new Error('Vector allowed: ' + v);
     }
     console.log('ALL VECTORS BLOCKED');
   }
   testSSRF();
   "
   # Expected: "ALL VECTORS BLOCKED"
   ```

6. **Empirical Rate Limit Live Turso Test**:
   ```bash
   npx tsx -r dotenv/config --env-file=.env.local -e "
   import { checkRateLimit } from './src/lib/rate-limit';
   async function test() {
     const k = 'audit_' + Date.now();
     const r1 = await checkRateLimit(k, 1, 10000);
     const r2 = await checkRateLimit(k, 1, 10000);
     console.log('Rate limit check:', r1.success, r2.success);
   }
   test();
   "
   # Expected: "Rate limit check: true false"
   ```
