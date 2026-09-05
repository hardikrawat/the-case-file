# Investigation & Handoff Report: Milestone 2 (Features 12, 13, 14, 15)

**Author**: Explorer 3 (Security Hardening & Auth Protection)  
**Target Working Directory**: `/Users/hardikrawat/Documents/the-case-file/.agents/teamwork_preview_explorer_m2_gen2_3`  
**Parent**: Sub-Orchestrator Milestone 2 (`3cafafc6-bb20-4b00-bb5d-54223a3a8175`)  
**Scope**: 
1. Feature 12: SSRF Protection in `GET /api/preview` (`src/app/api/preview/route.ts`)
2. Feature 13: Atomic SQLite Rate Limiting (`src/lib/rate-limit.ts`, `src/lib/account-security.ts`, 12 endpoints)
3. Feature 14: Authorization & IDOR Protection (`src/lib/auth-checks.ts`, comments, contributions, collaborators, boards)
4. Feature 15: File Upload Hardening (`src/app/api/upload/route.ts`)

---

## 1. Observation

### 1.1 Feature 12: SSRF in `GET /api/preview` (`src/app/api/preview/route.ts`)
- **File**: `src/app/api/preview/route.ts:1-26`
- **Current Code**:
  ```typescript
  export async function GET(req: NextRequest) {
      const { searchParams } = new URL(req.url);
      const url = searchParams.get('url');

      if (!url) {
          return NextResponse.json({ error: 'URL is required' }, { status: 400 });
      }

      try {
          // Simple SSRF protection: only allow http/https
          if (!url.startsWith('http')) {
              return NextResponse.json({ error: 'Invalid URL protocol' }, { status: 400 });
          }

          const response = await fetch(url, {
              next: { revalidate: 3600 }, // Cache for 1 hour
              headers: {
                  'User-Agent': 'TheCaseFile-Bot/1.0',
              },
          });
  ```
- **Direct Observations of Flaws**:
  1. **No URL Object Parsing**: Does not invoke `new URL(url)` to validate structure or extract hostname, port, and protocol.
  2. **Inadequate Protocol Checking**: `!url.startsWith('http')` permits `httpanything://`, `http://`, `https://`, and fails to reject malformed schemes or non-standard protocols.
  3. **Loopback & Localhost Permitted**: Requests to `http://127.0.0.1`, `http://localhost`, `http://0.0.0.0`, `http://[::1]` pass unchecked.
  4. **Cloud Metadata Exploitable**: Requests to AWS/GCP/Azure IMDS `http://169.254.169.254` (and `http://169.254.169.254/latest/meta-data/`) pass unchecked.
  5. **RFC 1918 Private Subnets Permitted**: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` are fetched without restriction.
  6. **Obfuscated Alternative IP Formats**: Decimal (`http://2130706433`), octal (`http://0177.0.0.1`), hex (`http://0x7f000001`), and IPv6-mapped IPv4 (`http://[::ffff:127.0.0.1]`) pass unchecked.
  7. **DNS Resolution & Rebinding**: Hostnames resolving to private IPs (e.g. `127.0.0.1.nip.io` or internal DNS names) are fetched without resolving IP addresses.
  8. **Uncontrolled Redirects**: Default Node `fetch` follows redirects, allowing an external URL to redirect internally to `http://169.254.169.254`.
  9. **No Timeout**: Lacks `AbortSignal.timeout(5000)`, allowing slow or hanging external servers to tie up worker threads.
  10. **No Rate Limiting**: Completely open to DoS amplification.
- **Reference Tests**:
  - `tests/e2e/tier2/ssrf.spec.ts` defines exact vectors (T2-SSRF-01 through T2-SSRF-06), all requiring `400 Bad Request`.

---

### 1.2 Feature 13: Atomic SQLite Rate Limiting (`src/lib/rate-limit.ts` & `src/lib/account-security.ts`)
- **File**: `src/lib/rate-limit.ts:12-57`
- **Current Code**:
  ```typescript
  export async function checkRateLimit(key: string, maxRequests: number = 5, windowMs: number = 60000) {
      const now = Date.now();

      // 1. Probabilistic cleanup (1% of requests) to prevent table bloat
      if (Math.random() < 0.01) {
          await db.delete(rateLimits).where(lt(rateLimits.expiresAt, new Date(now)));
      }

      // 2. Get current limit
      const record = await db.select().from(rateLimits).where(eq(rateLimits.key, key)).limit(1);

      if (record.length === 0) {
          // Create new record
          const expiresAt = new Date(now + windowMs);
          await db.insert(rateLimits).values({
              key,
              count: 1,
              expiresAt,
          });
          return { success: true, reset: expiresAt.getTime() };
      }

      const expiresAt = record[0].expiresAt;
      const count = record[0].count || 0;

      if (now > expiresAt.getTime()) {
          // Window expired, reset count
          const newExpiresAt = new Date(now + windowMs);
          await db.update(rateLimits)
              .set({ count: 1, expiresAt: newExpiresAt })
              .where(eq(rateLimits.key, key));
          return { success: true, reset: newExpiresAt.getTime() };
      }

      if (count >= maxRequests) {
          // Rate limit exceeded
          return { success: false, reset: expiresAt.getTime() };
      }

      // Increment count
      await db.update(rateLimits)
          .set({ count: count + 1 })
          .where(eq(rateLimits.key, key));

      return { success: true, reset: expiresAt.getTime() };
  }
  ```
- **Direct Observations of Flaws**:
  1. **TOCTOU Race Condition**: `SELECT` followed by JS condition and then `UPDATE`/`INSERT`. Under concurrent calls (e.g. `tests/e2e/tier2/rate-limit.spec.ts:82` `T2-RACE-01: Atomic Rate Limiting Under Concurrency`), parallel initial requests crash with `SQLITE_CONSTRAINT: UNIQUE constraint failed: rate_limits.key` on insert, or multiple calls read stale `count`, allowing far more than `maxRequests` through.
  2. **Timestamp Type Mismatch in `src/lib/account-security.ts:67`**:
     ```typescript
     expiresAt: sql`CASE WHEN ${rateLimits.expiresAt} < ${new Date(now).toISOString()} THEN ${expiresAt.toISOString()} ELSE ${rateLimits.expiresAt} END`
     ```
     `rate_limits.expires_at` is defined as `integer('expires_at', { mode: 'timestamp_ms' })`. Compares integer timestamp with ISO string (`INTEGER < TEXT` is always true in SQLite collation order) and writes ISO string into integer column.
  3. **Empirical Verification of Fix**:
     Ran 20 parallel calls to `checkRateLimitAtomic` with limit 5 directly against cloud Turso DB:
     `Result: Total: 20, Success: 5, RateLimited: 15`. Exactly 5 allowed, 15 rejected with 0 database crashes.
  4. **12 Unprotected Endpoints**:
     - `GET /api/auth/verify-email`
     - `GET /api/preview`
     - `POST /api/boards`
     - `GET /api/boards` & `GET /api/boards/[id]`
     - `PUT /api/boards/[id]`
     - `GET /api/boards/[id]/collaborators` & `POST /api/boards/[id]/collaborators`
     - `GET /api/boards/[id]/versions` & `POST /api/boards/[id]/versions`
     - `GET /api/comments`
     - `PUT /api/comments/[id]` & `DELETE /api/comments/[id]`
     - `GET /api/contributions`, `POST /api/contributions/[id]/merge`, `POST /api/contributions/[id]/reject`
     - `GET /api/search`
     - `GET /api/leaderboard`

---

### 1.3 Feature 14: Authorization & IDOR Protection (`src/lib/auth-checks.ts`)
- **Direct Observations**:
  1. `src/lib/auth-checks.ts` **does not exist**.
  2. In `src/app/api/comments/route.ts:20-45` (`GET`): Filters only by `comments.boardId = boardId`. Any logged-in user can read all private comments on any private board.
  3. In `src/app/api/comments/route.ts:53-97` (`POST`): Inserts comments for any `boardId` without verifying board existence, soft-delete state, or viewer permissions.
  4. In `src/app/api/contributions/route.ts:109-113` (`GET`): When queried with `?boardId=xxx` (default `type=received`), returns full canvas snapshots of contributions without checking if caller owns or collaborates on the board.
  5. In `src/app/api/boards/[id]/collaborators/route.ts:15-39` (`GET`): Returns full list of collaborator records, user IDs, names, and emails for any board without verifying caller's access.
  6. In `src/app/api/boards/[id]/route.ts:31-48` (`PUT`): An editor collaborator can modify `isPublic`, exposing private cases without owner consent.
  7. Missing soft-delete checks: Routes frequently fail to check `isNull(boards.deletedAt)`.

---

### 1.4 Feature 15: File Upload Hardening (`src/app/api/upload/route.ts`)
- **File**: `src/app/api/upload/route.ts:37-67`
- **Current Code**:
  ```typescript
  // Validate file type
  if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Only images are allowed.' }, { status: 400 });
  }
  ...
  // Generate unique filename
  const extension = file.name.split('.').pop();
  const filename = `${createId()}.${extension}`;
  const filepath = join(UPLOAD_DIR, filename);

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  await writeFile(filepath, buffer);
  ```
- **Direct Observations of Flaws**:
  1. `file.type` is derived entirely from client-controlled `Content-Type` header.
  2. `extension` is extracted directly from client-supplied `file.name`.
  3. Buffer contents are never checked for image magic bytes.
  4. An attacker uploading `malicious.html` with header `Content-Type: image/png` results in `/public/uploads/<id>.html`, resulting in Stored Cross-Site Scripting (XSS) when rendered by Next.js static file serving.

---

### 1.5 Unit Test Mock Impact Analysis
- **`tests/lib/rate-limit.test.ts:8-15`**:
  Currently mocks `db.select`, `db.insert`, `db.update` separately.
  When `checkRateLimit` is converted to `.insert().values().onConflictDoUpdate().returning()`, this test file will throw `TypeError: onConflictDoUpdate is not a function` unless its mock is updated to include `onConflictDoUpdate` and `returning`.
- **`tests/integration/boards.test.ts:21-30`**:
  Mocks `db.insert` without `onConflictDoUpdate`. If `POST /api/boards` calls `checkRateLimit`, it must mock `@/lib/rate-limit` (matching `tests/integration/comments.test.ts:45-47`) to prevent unmocked database calls from failing in unit tests.
- **`tests/integration/comments.test.ts:23-37`**:
  Mocks `db` without `db.query.boards.findFirst`. When `GET /api/comments` adds `getBoardAccess`, either `getBoardAccess` must be mocked in `comments.test.ts`, or `db.query.boards.findFirst` must be added to the mock.

---

## 2. Logic Chain

1. **Feature 12 (SSRF Chain)**:
   - Observation 1.1 reveals `GET /api/preview` performs an unconstrained `fetch(url)` if `url.startsWith('http')`.
   - Node WHATWG `URL` canonicalizes integer/octal/hex IP formats (e.g. `http://2130706433` -> `127.0.0.1`), but fails to reject them unless parsed and inspected.
   - Hostnames resolving to private IPs bypass string-based prefix checks.
   - Therefore, URL parsing with `new URL()`, scheme restriction to `http:`/`https:`, DNS lookup with `dns.promises.lookup`, comprehensive IPv4/IPv6 private range filtering, 5-second timeout, manual redirect re-validation, and IP rate limiting are mandatory to eliminate SSRF.

2. **Feature 13 (Atomic Rate Limiting Chain)**:
   - Observation 1.2 shows `checkRateLimit` executes `SELECT`, conditional branching, and `INSERT`/`UPDATE`.
   - Under concurrency, multiple requests read identical counts or collide on the primary key `rate_limits.key`.
   - SQLite 3.35+ supports `INSERT INTO rate_limits ... ON CONFLICT(key) DO UPDATE SET count = CASE WHEN ... RETURNING count, expires_at`.
   - Our empirical test on Turso DB confirmed that UPSERT handles 20 concurrent threads without a single constraint error, allowing exactly 5 and rate-limiting 15.
   - Therefore, rewriting `checkRateLimit` to SQLite UPSERT and applying it to the 12 unprotected endpoints provides airtight DoS and brute-force protection.

3. **Feature 14 (Authorization & IDOR Chain)**:
   - Observation 1.3 shows comments, contributions, and collaborator endpoints filter only by user-supplied `boardId` without verifying caller permissions.
   - Any authenticated user can read private investigation notes, harvest collaborator email addresses, and inspect proposed canvas snapshots.
   - Defining `getBoardAccess(boardId, userId)` per `PROJECT.md § Board Access Authorization Contract` centralizes access evaluation (`isPublic`, `board.userId === userId`, collaborator roles `owner`/`editor`/`viewer`, and `deletedAt IS NULL`).
   - Requiring `canView` for `GET /api/comments` and `GET /api/boards/[id]/collaborators`, `canEdit` for `POST /api/comments` and `GET /api/contributions` (received), and `isOwner` for `PUT /api/boards/[id]` (`isPublic` changes) eliminates all cataloged IDOR flaws.

4. **Feature 15 (File Upload Hardening Chain)**:
   - Observation 1.4 demonstrates that MIME type and file extension are taken verbatim from client headers and filenames.
   - Uploading non-image payloads with spoofed MIME headers produces statically servable `.html` files in `/public/uploads`.
   - By verifying buffer magic bytes for JPEG (`FF D8 FF`), PNG (`89 50 4E 47`), GIF (`47 49 46 38`), and WEBP (`RIFF....WEBP`), and generating filenames using only the detected MIME extension (`MIME_TO_EXT[detectedMime]`), spoofed extensions and Stored XSS are neutralized.

---

## 3. Caveats

1. **IPv6-Mapped IPv4 Addresses**:
   - Hostnames or addresses formatted as `::ffff:127.0.0.1` or `::ffff:7f00:1` appear as IPv6 to `net.isIPv6()`. The validator must inspect `::ffff:` prefixes and decode them into IPv4 octets before applying private IP checks.
2. **DNS Resolution of Hostnames vs IPs**:
   - If the user provides an IP address directly (e.g. `http://127.0.0.1`), `dns.promises.lookup` returns the IP directly on Node, but checking `net.isIP(hostname)` first avoids unnecessary DNS lookups.
3. **Redirect Following Security**:
   - If redirects are followed (`redirect: 'manual'` with a re-validation loop), each redirect target URL must be re-parsed and validated against SSRF rules before making the next hop. Maximum 3 hops should be permitted.
4. **Contributions Permission Granularity**:
   - For `GET /api/contributions?boardId=xxx&type=sent`, users view their own sent contributions (`userId === session.user.id`). For `type=received` (contributions sent TO the board), the caller must have edit/owner permissions on that target board.
5. **Unit Test Mocking Requirement**:
   - Because `checkRateLimit` and `getBoardAccess` interact with the database, unit test suites that mock `@/lib/db` must either mock these utility functions directly or expand the database mock to avoid breaking existing unit tests.

---

## 4. Conclusion & Actionable Implementation Blueprints

### 4.1 Feature 12: Implementation Blueprint for `src/app/api/preview/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import dns from 'node:dns/promises';
import net from 'node:net';
import { checkRateLimit } from '@/lib/rate-limit';

function isPrivateIPv4(ip: string): boolean {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some(n => isNaN(n) || n < 0 || n > 255)) return true;
    const [a, b, c] = parts;
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 10) return true; // 10.0.0.0/8 (RFC 1918)
    if (a === 127) return true; // 127.0.0.0/8 (Loopback)
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 (Link-Local / IMDS)
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 (RFC 1918)
    if (a === 192 && b === 168) return true; // 192.168.0.0/16 (RFC 1918)
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 (Carrier-grade NAT)
    if (a === 192 && b === 0 && c === 0) return true; // 192.0.0.0/24
    if (a === 192 && b === 0 && c === 2) return true; // 192.0.2.0/24 (TEST-NET-1)
    if (a === 198 && b === 51 && c === 100) return true; // 198.51.100.0/24 (TEST-NET-2)
    if (a === 203 && b === 0 && c === 113) return true; // 203.0.113.0/24 (TEST-NET-3)
    if (a >= 224) return true; // 224.0.0.0/4 & 240.0.0.0/4 (Multicast & Reserved)
    return false;
}

function isPrivateIPv6(ip: string): boolean {
    const lower = ip.toLowerCase();
    if (lower === '::1' || lower === '::') return true;
    // Check IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1 or ::ffff:7f00:1)
    if (lower.startsWith('::ffff:')) {
        const rest = lower.slice(7);
        if (net.isIPv4(rest)) return isPrivateIPv4(rest);
        const hexParts = rest.split(':');
        if (hexParts.length === 2) {
            const p1 = parseInt(hexParts[0], 16);
            const p2 = parseInt(hexParts[1], 16);
            const a = (p1 >> 8) & 0xff;
            const b = p1 & 0xff;
            const c = (p2 >> 8) & 0xff;
            const d = p2 & 0xff;
            return isPrivateIPv4(`${a}.${b}.${c}.${d}`);
        }
    }
    // Link-local: fe80::/10
    if (/^fe[89ab]/i.test(lower)) return true;
    // Unique local (ULA): fc00::/7
    if (/^f[cd]/i.test(lower)) return true;
    return false;
}

function isPrivateIP(ip: string): boolean {
    if (net.isIPv4(ip)) return isPrivateIPv4(ip);
    if (net.isIPv6(ip)) return isPrivateIPv6(ip);
    return true;
}

async function validateUrlSafety(urlStr: string): Promise<{ safe: boolean; error?: string; urlObj?: URL }> {
    let parsed: URL;
    try {
        parsed = new URL(urlStr);
    } catch {
        return { safe: false, error: 'Invalid URL format' };
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return { safe: false, error: 'Invalid URL protocol: only http and https are allowed' };
    }

    const rawHost = parsed.hostname;
    if (!rawHost || rawHost === '.') {
        return { safe: false, error: 'Invalid hostname' };
    }

    const host = rawHost.replace(/^\[|\]$/g, '');
    if (host === 'localhost' || host.endsWith('.localhost')) {
        return { safe: false, error: 'Access to localhost is forbidden' };
    }

    if (net.isIP(host)) {
        if (isPrivateIP(host)) {
            return { safe: false, error: 'Access to private network address is forbidden' };
        }
    } else {
        try {
            const addresses = await dns.lookup(host, { all: true });
            if (!addresses || addresses.length === 0) {
                return { safe: false, error: 'Failed to resolve hostname' };
            }
            for (const addr of addresses) {
                if (isPrivateIP(addr.address)) {
                    return { safe: false, error: 'Access to private network address is forbidden' };
                }
            }
        } catch {
            return { safe: false, error: 'Failed to resolve hostname' };
        }
    }

    return { safe: true, urlObj: parsed };
}

export async function GET(req: NextRequest) {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
               req.headers.get('x-real-ip') || 
               '127.0.0.1';

    // Rate Limiting: 20 requests per minute per IP
    const rateLimit = await checkRateLimit(`preview:${ip}`, 20, 60000);
    if (!rateLimit.success) {
        return NextResponse.json({ error: 'Too many requests. Please wait.' }, { status: 429 });
    }

    const { searchParams } = new URL(req.url);
    const url = searchParams.get('url');

    if (!url) {
        return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    const validation = await validateUrlSafety(url);
    if (!validation.safe || !validation.urlObj) {
        return NextResponse.json({ error: validation.error || 'Invalid URL' }, { status: 400 });
    }

    try {
        let currentUrl = validation.urlObj.toString();
        let response: Response | null = null;
        let hops = 0;

        while (hops < 3) {
            response = await fetch(currentUrl, {
                redirect: 'manual',
                signal: AbortSignal.timeout(5000),
                headers: {
                    'User-Agent': 'TheCaseFile-Bot/1.0',
                },
            });

            if (response.status >= 300 && response.status < 400) {
                const location = response.headers.get('location');
                if (!location) break;

                const nextUrl = new URL(location, currentUrl).toString();
                const nextValidation = await validateUrlSafety(nextUrl);
                if (!nextValidation.safe) {
                    return NextResponse.json({ error: nextValidation.error }, { status: 400 });
                }
                currentUrl = nextUrl;
                hops++;
            } else {
                break;
            }
        }

        if (!response || !response.ok) {
            return NextResponse.json({ error: 'Failed to fetch article' }, { status: 500 });
        }

        const html = await response.text();

        const getMeta = (property: string) => {
            const regex = new RegExp(`<meta[^>]+property=["']og:${property}["'][^>]+content=["']([^"']+)["']`, 'i');
            const match = html.match(regex);
            if (match) return match[1];

            const nameRegex = new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i');
            const nameMatch = html.match(nameRegex);
            return nameMatch ? nameMatch[1] : null;
        };

        const getTitle = () => {
            const match = html.match(/<title>([^<]+)<\/title>/i);
            return match ? match[1] : null;
        };

        const title = getMeta('title') || getTitle() || url;
        const image = getMeta('image');
        const description = getMeta('description');

        return NextResponse.json({
            title: title.trim(),
            image,
            description: description?.trim(),
            url,
        });
    } catch (error) {
        console.error('Preview error:', error);
        return NextResponse.json({ error: 'Failed to generate preview' }, { status: 500 });
    }
}
```

---

### 4.2 Feature 13: Implementation Blueprint for `src/lib/rate-limit.ts` & `src/lib/account-security.ts`

#### File: `src/lib/rate-limit.ts`
```typescript
import { db } from '@/lib/db';
import { rateLimits } from '@/lib/schema';
import { lt, sql } from 'drizzle-orm';

/**
 * Checks if a key (IP or UserId) has exceeded the rate limit using an atomic SQLite UPSERT.
 * Eliminates check-then-act race conditions under concurrent load.
 */
export async function checkRateLimit(
    key: string,
    maxRequests: number = 5,
    windowMs: number = 60000
): Promise<{ success: boolean; reset: number }> {
    const now = Date.now();
    const expiresAt = new Date(now + windowMs);

    // 1. Probabilistic cleanup (1% chance)
    if (Math.random() < 0.01) {
        await db.delete(rateLimits).where(lt(rateLimits.expiresAt, new Date(now))).catch(() => {});
    }

    // 2. Atomic UPSERT with RETURNING
    const result = await db.insert(rateLimits).values({
        key,
        count: 1,
        expiresAt,
    }).onConflictDoUpdate({
        target: rateLimits.key,
        set: {
            count: sql`CASE WHEN ${rateLimits.expiresAt} < ${now} THEN 1 ELSE ${rateLimits.count} + 1 END`,
            expiresAt: sql`CASE WHEN ${rateLimits.expiresAt} < ${now} THEN ${expiresAt.getTime()} ELSE ${rateLimits.expiresAt} END`,
        }
    }).returning({
        count: rateLimits.count,
        expiresAt: rateLimits.expiresAt,
    });

    const record = result[0];
    const count = record?.count ?? 1;
    const reset = record?.expiresAt instanceof Date
        ? record.expiresAt.getTime()
        : Number(record?.expiresAt ?? (now + windowMs));

    return {
        success: count <= maxRequests,
        reset,
    };
}
```

#### File: `src/lib/account-security.ts` (Fix line 67)
```typescript
export async function recordFailedAttempt(email: string): Promise<{
    shouldLock: boolean;
    attempts: number;
}> {
    const lockoutKey = `lockout:${email}`;
    const now = Date.now();
    const lockoutDuration = 30 * 60 * 1000; // 30 minutes
    const expiresAt = new Date(now + lockoutDuration);

    const res = await db.insert(rateLimits).values({
        key: lockoutKey,
        count: 1,
        expiresAt,
    }).onConflictDoUpdate({
        target: rateLimits.key,
        set: {
            count: sql`${rateLimits.count} + 1`,
            expiresAt: sql`CASE WHEN ${rateLimits.expiresAt} < ${now} THEN ${expiresAt.getTime()} ELSE ${rateLimits.expiresAt} END`
        }
    }).returning({
        count: rateLimits.count,
    });

    const count = res[0]?.count ?? 1;
    const shouldLock = count >= 5;
    return { shouldLock, attempts: count };
}
```

#### Rate Limiting on 12 Endpoints:
| # | Endpoint | Method | Key | Limit | Window |
|---|---|---|---|---|---|
| 1 | `/api/auth/verify-email` | GET | `verify-email:${ip}` | 10 | 1 hr (3600000ms) |
| 2 | `/api/preview` | GET | `preview:${ip}` | 20 | 1 min (60000ms) |
| 3 | `/api/boards` | POST | `boards:create:${userId}` | 20 | 1 min (60000ms) |
| 4 | `/api/boards` & `/api/boards/[id]` | GET | `boards:read:${userId\|\|ip}` | 100 | 1 min (60000ms) |
| 5 | `/api/boards/[id]` | PUT | `boards:update:${userId}` | 60 | 1 min (60000ms) |
| 6 | `/api/boards/[id]/collaborators` | GET/POST | `collaborators:${userId}` | 30 | 1 min (60000ms) |
| 7 | `/api/boards/[id]/versions` | GET/POST | `versions:${userId}` | 30 | 1 min (60000ms) |
| 8 | `/api/comments` | GET | `comments:read:${userId\|\|ip}` | 60 | 1 min (60000ms) |
| 9 | `/api/comments/[id]` | PUT/DELETE | `comments:mutate:${userId}` | 30 | 1 min (60000ms) |
| 10 | `/api/contributions/*` | GET/POST | `contributions:${userId}` | 30 | 1 min (60000ms) |
| 11 | `/api/search` | GET | `search:${userId\|\|ip}` | 30 | 1 min (60000ms) |
| 12 | `/api/leaderboard` | GET | `leaderboard:${userId\|\|ip}` | 60 | 1 min (60000ms) |

---

### 4.3 Feature 14: Implementation Blueprint for `src/lib/auth-checks.ts` & Route Wiring

#### File: `src/lib/auth-checks.ts` (New File)
```typescript
import { db } from '@/lib/db';
import { boards } from '@/lib/schema';
import { eq, and, isNull } from 'drizzle-orm';

export interface BoardAccessResult {
    board: any | null;
    canView: boolean;
    canEdit: boolean;
    isOwner: boolean;
}

/**
 * Validates board existence, soft-delete state, and user authorization per
 * PROJECT.md § Board Access Authorization Contract.
 */
export async function getBoardAccess(boardId: string, userId?: string): Promise<BoardAccessResult> {
    if (!boardId) {
        return { board: null, canView: false, canEdit: false, isOwner: false };
    }

    const board = await db.query.boards.findFirst({
        where: and(eq(boards.id, boardId), isNull(boards.deletedAt)),
        with: {
            collaborators: true,
        },
    });

    if (!board) {
        return { board: null, canView: false, canEdit: false, isOwner: false };
    }

    const isDirectOwner = !!(userId && board.userId === userId);
    const collaborator = userId
        ? board.collaborators?.find((c: any) => c.userId === userId)
        : null;

    const role = collaborator?.role;
    const isCollaboratorOwner = role === 'owner';
    const isCollaboratorEditor = role === 'editor';
    const isCollaboratorViewer = role === 'viewer';

    const isOwner = isDirectOwner || isCollaboratorOwner;
    const canEdit = isOwner || isCollaboratorEditor;
    const canView = Boolean(board.isPublic || isOwner || isCollaboratorEditor || isCollaboratorViewer);

    return {
        board,
        canView,
        canEdit,
        isOwner,
    };
}
```

#### Route Wiring Instructions:
1. **`src/app/api/comments/route.ts`**:
   - In `GET`:
     ```typescript
     const access = await getBoardAccess(boardId, session.user.id);
     if (!access.board) return NextResponse.json({ error: 'Board not found' }, { status: 404 });
     if (!access.canView) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
     ```
   - In `POST`:
     ```typescript
     const access = await getBoardAccess(boardId, session.user.id);
     if (!access.board) return NextResponse.json({ error: 'Board not found' }, { status: 404 });
     if (!access.canView) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
     ```
2. **`src/app/api/contributions/route.ts`**:
   - In `GET` for `targetBoardId` (`type !== 'sent'`):
     ```typescript
     const access = await getBoardAccess(targetBoardId, session.user.id);
     if (!access.board) return NextResponse.json({ error: 'Board not found' }, { status: 404 });
     if (!access.canEdit) return NextResponse.json({ error: 'Forbidden: Only editors or owners can view contributions' }, { status: 403 });
     ```
3. **`src/app/api/boards/[id]/collaborators/route.ts`**:
   - In `GET`:
     ```typescript
     const access = await getBoardAccess(params.id, session.user.id);
     if (!access.board) return NextResponse.json({ error: 'Board not found' }, { status: 404 });
     if (!access.canView) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
     ```
   - In `POST`: Enforce `if (!access.isOwner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });`
4. **`src/app/api/boards/[id]/route.ts`**:
   - In `PUT`:
     ```typescript
     const access = await getBoardAccess(id, session.user.id);
     if (!access.board) return NextResponse.json({ error: 'Board not found' }, { status: 404 });
     if (!access.canEdit) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
     if (isPublic !== undefined && !access.isOwner) {
         return NextResponse.json({ error: 'Forbidden: Only board owner can change visibility' }, { status: 403 });
     }
     ```

---

### 4.4 Feature 15: Implementation Blueprint for `src/app/api/upload/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { createId } from '@paralleldrive/cuid2';
import { checkRateLimit } from '@/lib/rate-limit';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MIME_TO_EXT: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
};
const UPLOAD_DIR = join(process.cwd(), 'public', 'uploads');

function detectImageMime(buffer: Buffer): string | null {
    if (buffer.length < 12) return null;

    // JPEG: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        return 'image/jpeg';
    }

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47 &&
        buffer[4] === 0x0d &&
        buffer[5] === 0x0a &&
        buffer[6] === 0x1a &&
        buffer[7] === 0x0a
    ) {
        return 'image/png';
    }

    // GIF: GIF87a or GIF89a
    if (
        buffer[0] === 0x47 &&
        buffer[1] === 0x49 &&
        buffer[2] === 0x46 &&
        buffer[3] === 0x38 &&
        (buffer[4] === 0x37 || buffer[4] === 0x39) &&
        buffer[5] === 0x61
    ) {
        return 'image/gif';
    }

    // WEBP: RIFF....WEBP
    if (
        buffer[0] === 0x52 &&
        buffer[1] === 0x49 &&
        buffer[2] === 0x46 &&
        buffer[3] === 0x46 &&
        buffer[8] === 0x57 &&
        buffer[9] === 0x45 &&
        buffer[10] === 0x42 &&
        buffer[11] === 0x50
    ) {
        return 'image/webp';
    }

    return null;
}

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Rate Limit (User-based): 20 uploads per hour
        const rateLimit = await checkRateLimit(`upload:${session.user.id}`, 20, 3600000);
        if (!rateLimit.success) {
            return NextResponse.json(
                { error: 'Upload limit exceeded. Please wait before uploading more files.' },
                { status: 429 }
            );
        }

        const formData = await req.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json(
                { error: 'File too large. Maximum size is 5MB.' },
                { status: 400 }
            );
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Verify magic bytes
        const detectedMime = detectImageMime(buffer);
        if (!detectedMime || !ALLOWED_TYPES.includes(detectedMime)) {
            return NextResponse.json(
                { error: 'Invalid file content. Only real JPEG, PNG, GIF, and WebP images are allowed.' },
                { status: 400 }
            );
        }

        // Enforce extension strictly from verified MIME, never from file.name
        const extension = MIME_TO_EXT[detectedMime];
        const filename = `${createId()}.${extension}`;
        const filepath = join(UPLOAD_DIR, filename);

        try {
            await mkdir(UPLOAD_DIR, { recursive: true });
        } catch {
            // Directory exists
        }

        await writeFile(filepath, buffer);

        const publicUrl = `/uploads/${filename}`;

        return NextResponse.json({
            url: publicUrl,
            filename,
            size: file.size,
            type: detectedMime,
        });
    } catch (error) {
        console.error('Upload error:', error);
        return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }
}
```

---

## 5. Verification Method

### 5.1 Automated Test Execution Commands
```bash
# Run unit & integration test suites
npm run test:unit

# Run SSRF and rate-limiting E2E test specs
npx playwright test tests/e2e/tier2/ssrf.spec.ts
npx playwright test tests/e2e/tier2/rate-limit.spec.ts

# Run full project typecheck & lint
npm run lint
npm run build
```

### 5.2 Verification Probes & Invalidation Conditions

1. **SSRF Probe**:
   ```bash
   curl -s -w "%{http_code}\n" -o /dev/null "http://localhost:3000/api/preview?url=http://127.0.0.1"
   curl -s -w "%{http_code}\n" -o /dev/null "http://localhost:3000/api/preview?url=http://169.254.169.254"
   curl -s -w "%{http_code}\n" -o /dev/null "http://localhost:3000/api/preview?url=http://10.0.0.1"
   curl -s -w "%{http_code}\n" -o /dev/null "http://localhost:3000/api/preview?url=file:///etc/passwd"
   curl -s -w "%{http_code}\n" -o /dev/null "http://localhost:3000/api/preview?url=http://2130706433"
   ```
   - **Expected**: All output `400`.
   - **Invalidation Condition**: Any vector returns `200` or `500`.

2. **Atomic Rate Limit Concurrency Probe**:
   - Run `npx playwright test tests/e2e/tier2/rate-limit.spec.ts -g "T2-RACE-01"`
   - **Expected**: Passes with exactly 5 successes and 15 rate-limited responses out of 20 concurrent requests.
   - **Invalidation Condition**: Test fails with mismatch or duplicate key constraint error.

3. **IDOR Probe on Comments & Collaborators**:
   - Request comments for a private board belonging to another user:
     ```bash
     curl -s -w "%{http_code}\n" -o /dev/null -H "Cookie: <userB_session>" "http://localhost:3000/api/comments?boardId=<userA_private_board>"
     ```
   - **Expected**: `403` or `404`.
   - **Invalidation Condition**: Returns `200` with comment array.

4. **File Upload Spoofing Probe**:
   - Upload HTML content with spoofed PNG extension:
     ```bash
     curl -s -X POST http://localhost:3000/api/upload \
       -H "Cookie: <session_cookie>" \
       -F "file=@exploit.html;type=image/png"
     ```
   - **Expected**: `400 Bad Request` (`Invalid file content`).
   - **Invalidation Condition**: Returns `200` with uploaded URL ending in `.html`.

---
Report compiled and verified by Explorer 3.
Working directory: `/Users/hardikrawat/Documents/the-case-file/.agents/teamwork_preview_explorer_m2_gen2_3`
