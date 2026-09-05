# Investigation Report & Handoff: Milestone 2 (Features 8, 9, 10, 11)
**Security Hardening: Eliminate Token & Credential Leakage, Privacy Protection**

- **Author**: Explorer 2 (Security & Auth Hardening)
- **Target Working Directory**: `/Users/hardikrawat/Documents/the-case-file/.agents/teamwork_preview_explorer_m2_gen2_2`
- **Parent**: Sub-Orchestrator Milestone 2 (`3cafafc6-bb20-4b00-bb5d-54223a3a8175`)
- **Date**: 2026-09-04
- **Focus**: Features 8, 9, 10, 11 (Eliminate Token & Credential Leakage, Privacy Hardening)

---

## 1. Observation

### 1.1 Feature 8: Verification Token Leakage in `POST /api/auth/signup` & Redirect in `src/app/signup/page.tsx`
- **File**: `src/app/api/auth/signup/route.ts`
- **Lines**: 68–80
- **Verbatim Code**:
  ```typescript
  // 6. Create verification token
  const verificationToken = await createVerificationToken(userId);

  // In a production app, send email with verification link
  // For now, we'll return the token in the response for testing
  return NextResponse.json({
      success: true,
      userId,
      message: 'Account created successfully',
      // TODO: Remove in production, send via email instead
      verificationToken,
  }, { status: 201 });
  ```
- **Finding**: The sensitive `verificationToken` is returned in plaintext within the JSON response body.
- **Client Consumer**: `src/app/signup/page.tsx:80–82`
- **Verbatim Code**:
  ```typescript
  toast.success('Agent registered. Verification required.');
  router.push(`/signup/verify?email=${encodeURIComponent(formData.email)}&token=${data.verificationToken}`);
  ```
- **Finding**: The client relies on `data.verificationToken` and exposes it directly as a GET query parameter in the browser URL (`&token=...`), violating requirement R2 / Acceptance Criteria 41 & 90.

---

### 1.2 Feature 9: Password Reset Token Leakage & User Enumeration in `POST /api/auth/forgot-password`
- **File**: `src/app/api/auth/forgot-password/route.ts`
- **Lines**: 29–47
- **Verbatim Code**:
  ```typescript
  const token = await createPasswordResetToken(email);

  if (!token) {
      // Don't reveal if email exists or not for security
      return NextResponse.json({
          success: true,
          message: 'If an account exists with this email, a password reset link has been sent',
      });
  }

  // TODO: Send email with reset link
  // For now, return token in response for testing
  return NextResponse.json({
      success: true,
      message: 'Password reset link sent',
      // TODO: Remove in production
      resetToken: token,
  });
  ```
- **Findings**:
  1. **Direct Account Takeover**: When an account exists, `resetToken` is returned in the HTTP response body (`resetToken: token`). Any anonymous attacker can request a reset for any email and obtain the valid token directly in the response, allowing immediate password reset via `POST /api/auth/reset-password` without email access.
  2. **User Enumeration**: The response differentiates between registered and unregistered emails (non-existent emails get `message: 'If an account exists with this email...'` with no token, while existent emails get `message: 'Password reset link sent'` with `resetToken: token`).
- **Client Consumer**: `src/app/forgot-password/page.tsx:17–33`
  - The frontend only inspects `response.ok` and sets `submitted = true`. It does NOT require or consume `resetToken`.

---

### 1.3 Feature 10: Password Hash Leakage in `GET /api/me` and `PUT /api/profile/[id]`

#### 1.3.1 `GET /api/me`
- **File**: `src/app/api/me/route.ts`
- **Lines**: 16–36
- **Verbatim Code**:
  ```typescript
  const user = await db.query.users.findFirst({
      where: eq(users.email, session.user.email),
      with: {
          reputation: true,
      },
  });

  if (!user) {
      return new NextResponse("User not found", { status: 404 });
  }

  // Return user data along with reputation stats
  const rep = user.reputation as unknown as { points: number; boardsCreated: number; contributionsAccepted: number } | null;

  return NextResponse.json({
      ...user,
      reputationPoints: rep?.points || 0,
      boardsCreated: rep?.boardsCreated || 0,
      contributionsAccepted: rep?.contributionsAccepted || 0,
  });
  ```
- **Finding**: Spreading `...user` serializes and exposes `user.passwordHash` directly to the client in JSON, violating AC 43 & 92.

#### 1.3.2 `PUT /api/profile/[id]`
- **File**: `src/app/api/profile/[id]/route.ts`
- **Lines**: 112–118
- **Verbatim Code**:
  ```typescript
  const updated = await db.update(users)
      .set(updateData)
      .where(eq(users.id, params.id))
      .returning();

  return NextResponse.json(updated[0]);
  ```
- **Finding**: Calling `.returning()` without specifying columns causes SQLite to return all columns of the `users` table, including `password_hash` (`passwordHash`). Any profile bio/name update exposes the user's password hash in the JSON response.

---

### 1.4 Feature 11: Privacy Exposure in `GET /api/profile/[id]`
- **File**: `src/app/api/profile/[id]/route.ts`
- **Lines**: 23–54
- **Verbatim Code**:
  ```typescript
  // Get user profile
  const userProfile = await db.select()
      .from(users)
      .where(eq(users.id, params.id))
      .limit(1);

  if (userProfile.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const user = userProfile[0];

  // Get user's boards count
  const userBoards = await db.select()
      .from(boards)
      .where(and(eq(boards.userId, params.id), isNull(boards.deletedAt)));

  // Get reputation if exists
  const reputation = await db.select()
      .from(userReputation)
      .where(eq(userReputation.userId, params.id))
      .limit(1);

  return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      boardsCount: userBoards.length,
      reputation: reputation.length > 0 ? reputation[0].points : 0,
  });
  ```
- **Findings**:
  1. **Email Exposure**: `email: user.email` is unconditionally returned to any caller, even unauthenticated guests.
  2. **Private Case Count Leak**: `boardsCount` queries `and(eq(boards.userId, params.id), isNull(boards.deletedAt))`, counting all cases regardless of `isPublic`. Non-owners can observe how many secret/private cases a detective maintains.
  3. `auth()` is currently not invoked in `GET /api/profile/[id]`.

---

### 1.5 Feature 11: Bulk User Email Harvesting via `src/lib/search.ts`
- **File**: `src/lib/search.ts`
- **Lines**: 15–20, 64–75
- **Verbatim Code**:
  ```typescript
  export interface SearchResult {
      ...
      users: Array<{
          id: string;
          name: string | null;
          email: string;
          avatarUrl: string | null;
      }>;
      totalResults: number;
  }
  ...
  // Search users (names and emails - limited for privacy)
  const userResults = await db
      .select({
          id: users.id,
          name: users.name,
          email: users.email,
          avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(or(like(users.name, searchTerm), like(users.email, searchTerm)))
      .limit(10);
  ```
- **Findings**:
  1. `email` is returned in user search objects to any caller of `GET /api/search?q=...`.
  2. The SQL query matches `like(users.email, searchTerm)`, enabling automated scripts to systematically harvest detective emails.
- **Client Consumer**: `src/components/SearchModal.tsx:18, 209, 213`
  - `SearchResult['users']` includes `email: string;`.
  - Line 209: `{(user.name || user.email)[0].toUpperCase()}`
  - Line 213: `<p className="text-[10px] font-mono text-[var(--panel-foreground)]/40 uppercase tracking-tighter">{user.email}</p>`
  - Must be updated to tolerate `email` omission without TypeScript errors or broken UI rendering.

---

### 1.6 Feature 11: Missing Rate Limiting & Token Expiration in `src/app/api/auth/verify-email/route.ts` & `src/lib/auth-utils.ts`
- **File**: `src/app/api/auth/verify-email/route.ts`
- **Lines**: 4–29
- **Verbatim Code**:
  ```typescript
  export async function GET(req: NextRequest) {
      try {
          const { searchParams } = new URL(req.url);
          const token = searchParams.get('token');

          if (!token) {
              return NextResponse.json(
                  { error: 'Verification token is required' },
                  { status: 400 }
              );
          }

          const result = await verifyEmailToken(token);
          ...
  ```
- **File**: `src/lib/auth-utils.ts:38–41`
- **Verbatim Code**:
  ```typescript
  // Check if token is expired
  if (new Date() > new Date(tokenData.expires)) {
      return { valid: false };
  }
  ```
- **Findings**:
  1. Zero rate limiting on `GET /api/auth/verify-email`, allowing brute-force token scanning.
  2. Missing input validation: `token` is not validated for length bounds or whitespace.
  3. Unlike `verifyResetToken` (which deletes expired tokens in lines 106–107), `verifyEmailToken` leaves expired tokens indefinitely in `email_verification_tokens`.

---

### 1.7 Test Suite Ground Truth
- **`tests/e2e/tier1/security.spec.ts`**:
  - `T1-SEC-01` (lines 24–49): Tests `POST /api/auth/signup`. Verifies `201 Created`, `res.data.userId` is defined, `SecurityAssertions.assertNoTokens(res.data)`, `verificationToken` is `undefined`, and `passwordHash` is `undefined`.
  - `T1-SEC-02` (lines 61–78): Tests `POST /api/auth/forgot-password`. Verifies `200 OK`, `res.data.success === true`, `SecurityAssertions.assertNoTokens(res.data)`, `resetToken` is `undefined`.
  - `T1-SEC-03` (lines 90–110): Tests `GET /api/me`. Verifies `200 OK`, `SecurityAssertions.assertNoPasswordHash(res.data)`, `passwordHash` is `undefined`.
  - `T1-SEC-04` (lines 113–135): Tests `PUT /api/profile/[id]`. Verifies `200 OK`, `SecurityAssertions.assertNoPasswordHash(res.data)`, `passwordHash` is `undefined`.
  - `T1-SEC-05` (lines 137–155): Tests `GET /api/profile/[id]` with unauthenticated session (`user: null`). Asserts `res.data.email` is `undefined` and `passwordHash` is `undefined`.
- **`tests/integration/auth-signup.test.ts`**:
  - Validates `POST /api/auth/signup` returns `201` with `res.data.userId === 'user_id_123'`, and creates token via `authUtils.createVerificationToken`. Does NOT assert `res.data.verificationToken`.
- **`tests/unit/search.test.ts`**:
  - Validates `searchDatabase` matches users by name. Does NOT require `email` on user search results.

---

## 2. Logic Chain

1. **Elimination of Signup Token Leakage (Feature 8)**:
   - *From Observation 1.1*: `POST /api/auth/signup` line 78 explicitly includes `verificationToken`.
   - *From Observation 1.7*: `tests/e2e/tier1/security.spec.ts:46` tests that `res.data.verificationToken` is `undefined`.
   - *Logic*: In a secure email verification architecture, the verification token must be delivered strictly out-of-band via email. Removing `verificationToken` from the response payload directly satisfies `T1-SEC-01` and AC 41.
   - *Coupled Change*: `src/app/signup/page.tsx:81` currently constructs a URL with `&token=${data.verificationToken}`. Because the API will no longer return `verificationToken`, passing `token` in the URL would be `&token=undefined`. Updating `src/app/signup/page.tsx` to redirect to `/signup/verify?email=${encodeURIComponent(formData.email)}` removes the token from the client URL entirely.

2. **Elimination of Password Reset Token Leakage & User Enumeration (Feature 9)**:
   - *From Observation 1.2*: `POST /api/auth/forgot-password` returns `resetToken: token` when the email exists, enabling immediate account takeover. Additionally, different response messages leak whether an email is registered.
   - *From Observation 1.7*: `tests/e2e/tier1/security.spec.ts:76` asserts `res.data.resetToken` is `undefined`.
   - *Logic*: The endpoint must call `await createPasswordResetToken(email)` to insert the token into `password_reset_tokens` for email dispatch, but must return a uniform response: `{ success: true, message: 'If an account exists with this email, a password reset link has been sent' }` regardless of whether the email exists. This simultaneously prevents account takeover and eliminates user enumeration.

3. **Elimination of Password Hash Leakage (Feature 10)**:
   - *From Observation 1.3.1*: `GET /api/me` spreads `...user`, dumping the raw `passwordHash` into client state.
   - *From Observation 1.3.2*: `PUT /api/profile/[id]` calls `.returning()`, dumping `passwordHash` into the update response.
   - *From Observation 1.7*: `T1-SEC-03` and `T1-SEC-04` assert `passwordHash` is `undefined` and stringified JSON contains zero occurrence of `"passwordHash"` or `"password_hash"`.
   - *Logic*:
     - In `GET /api/me`: Destructuring `const { passwordHash, ...safeUser } = user;` ensures `passwordHash` is omitted from the JSON payload.
     - In `PUT /api/profile/[id]`: Specifying explicit returning fields `.returning({ id: users.id, name: users.name, bio: users.bio, avatarUrl: users.avatarUrl })` guarantees at the database query level that sensitive credential columns are neither selected nor transmitted.

4. **Privacy Hardening: Profile Email & Private Boards Count (Feature 11)**:
   - *From Observation 1.4*: `GET /api/profile/[id]` unconditionally includes `email: user.email` and counts all non-deleted cases (`boards.userId === params.id`) regardless of `isPublic`.
   - *From Observation 1.7*: `T1-SEC-05` asserts that unauthenticated requests to `GET /api/profile/[id]` return `res.data.email === undefined`.
   - *Logic*:
     - Invoking `const session = await auth();` provides the caller's identity.
     - `const isOwner = !!(session?.user?.id && session.user.id === params.id);`.
     - When `isOwner` is false: `email` must be omitted from the response, and `boardsCount` must query `and(eq(boards.userId, params.id), eq(boards.isPublic, true), isNull(boards.deletedAt))`.
     - When `isOwner` is true: `email: user.email` is included, and `boardsCount` counts all active cases (`and(eq(boards.userId, params.id), isNull(boards.deletedAt))`).

5. **Privacy Hardening: User Search Email Omission (Feature 11)**:
   - *From Observation 1.5*: `src/lib/search.ts` returns `email` and allows searching with `like(users.email, searchTerm)`.
   - *Logic*:
     - Removing `email` from `SearchResult['users']` and the `db.select` query prevents bulk email harvesting.
     - Restricting user search matching to `where(like(users.name, searchTerm))` prevents brute-force discovery of registered user email addresses.
     - Updating `src/components/SearchModal.tsx` ensures type-safety and visual consistency when `user.email` is absent.

6. **Email Verification Protection (Feature 11)**:
   - *From Observation 1.6*: `src/app/api/auth/verify-email/route.ts` lacks rate limiting.
   - *Logic*: Enforcing `await checkRateLimit(`verify-email:${ip}`, 10, 60000)` limits automated token brute-force attempts to 10 requests per minute.
   - In `src/lib/auth-utils.ts`, deleting expired verification tokens cleans up dead tokens and prevents database bloat.

---

## 3. Caveats

1. **`tests/e2e/tier1/security.spec.ts:82` SQL Query Bug in E2E Suite**:
   - In `T1-SEC-02` line 82:
     ```typescript
     const tokenRows = await db.execute({
         sql: `SELECT identifier, token, expires FROM passwordResetTokens 
               WHERE identifier = ? 
               ORDER BY expires DESC LIMIT 1`,
         args: [DETECTIVE_ALPHA.email],
     });
     ```
   - *Notice*: In the project's actual SQLite schema (`src/lib/schema.ts:101–111`), the table is named `password_reset_tokens` (not `passwordResetTokens`), and the foreign key column is `user_id` (referencing `users.id`), NOT `identifier`. NextAuth's table `verificationToken` has `identifier`, but custom `password_reset_tokens` stores `user_id`. If `T1-SEC-02` fails during direct DB assertion, the query in the E2E test file will need to join `users` on `user_id` or query `password_reset_tokens`. The API implementation itself correctly calls `createPasswordResetToken(email)`.
2. **Developer Mock Notice on `src/app/signup/verify/page.tsx`**:
   - Lines 58–72 of `src/app/signup/verify/page.tsx` contain a "Simulate Email Verification" button which requires `token` from `searchParams.get('token')`. When `src/app/signup/page.tsx` stops passing `&token=...`, this simulate button will do nothing unless the URL includes `?token=...` (such as from a simulated email link). The simulate card should conditionally render only if `token` is present: `{token && <div ...>}`.
3. **Soft-Delete Integration Tests Compatibility**:
   - `tests/integration/soft-delete-api.test.ts:285–328` tests `GET /api/profile/[id]` with mocked `db.select`. Because the mock resolves `mockActiveBoards` unconditionally on the second call regardless of SQL `where` arguments, modifying `where(...)` in `route.ts` does not break this test.
4. **No Other Leaks**:
   - Grep searches confirmed that `passwordHash` is nowhere else exposed across the entire `src/` tree.

---

## 4. Conclusion & Concrete Implementation Specifications

All 4 target features have clean, isolated solution paths without breaking existing architectural contracts or valid unit tests.

### 4.1 Changes to `src/app/api/auth/signup/route.ts`
- **Lines 68–80**:
```typescript
<<<< BEFORE
        // 6. Create verification token
        const verificationToken = await createVerificationToken(userId);

        // In a production app, send email with verification link
        // For now, we'll return the token in the response for testing
        return NextResponse.json({
            success: true,
            userId,
            message: 'Account created successfully',
            // TODO: Remove in production, send via email instead
            verificationToken,
        }, { status: 201 });
==== AFTER
        // 6. Create verification token (saved to DB; dispatched out-of-band via email)
        await createVerificationToken(userId);

        return NextResponse.json({
            success: true,
            userId,
            message: 'Account created successfully. Please check your email to verify your account.',
        }, { status: 201 });
>>>>
```

---

### 4.2 Changes to `src/app/signup/page.tsx`
- **Line 81**:
```typescript
<<<< BEFORE
            toast.success('Agent registered. Verification required.');
            router.push(`/signup/verify?email=${encodeURIComponent(formData.email)}&token=${data.verificationToken}`);
==== AFTER
            toast.success('Agent registered. Verification required.');
            router.push(`/signup/verify?email=${encodeURIComponent(formData.email)}`);
>>>>
```

---

### 4.3 Changes to `src/app/signup/verify/page.tsx`
- **Lines 59–72**:
```tsx
<<<< BEFORE
                    {/* Developer Mock Info */}
                    <div className="p-4 bg-amber-950/20 border border-amber-900/30 rounded-lg mb-8 text-left">
                        <p className="text-xs font-bold text-amber-500 uppercase tracking-wider mb-2">Developer Notice (Mocked Email)</p>
                        <p className="text-sm text-stone-300 mb-4">
                            In this production-hardened environment, the email service is currently mocked.
                            You can simulate clicking the verification link by using the button below.
                        </p>
                        <button
                            onClick={handleVerify}
                            disabled={isVerifying}
                            className="w-full py-2 px-4 bg-amber-600 hover:bg-amber-700 text-stone-950 font-bold rounded transition-colors disabled:opacity-50"
                        >
                            {isVerifying ? 'Verifying...' : 'Simulate Email Verification'}
                        </button>
                    </div>
==== AFTER
                    {/* Developer Mock Info (Rendered only if verification link containing token was opened) */}
                    {token && (
                        <div className="p-4 bg-amber-950/20 border border-amber-900/30 rounded-lg mb-8 text-left">
                            <p className="text-xs font-bold text-amber-500 uppercase tracking-wider mb-2">Developer Notice (Mocked Email)</p>
                            <p className="text-sm text-stone-300 mb-4">
                                In this production-hardened environment, the email service is currently mocked.
                                You can simulate clicking the verification link by using the button below.
                            </p>
                            <button
                                onClick={handleVerify}
                                disabled={isVerifying}
                                className="w-full py-2 px-4 bg-amber-600 hover:bg-amber-700 text-stone-950 font-bold rounded transition-colors disabled:opacity-50"
                            >
                                {isVerifying ? 'Verifying...' : 'Simulate Email Verification'}
                            </button>
                        </div>
                    )}
>>>>
```

---

### 4.4 Changes to `src/app/api/auth/forgot-password/route.ts`
- **Lines 29–47**:
```typescript
<<<< BEFORE
        const token = await createPasswordResetToken(email);

        if (!token) {
            // Don't reveal if email exists or not for security
            return NextResponse.json({
                success: true,
                message: 'If an account exists with this email, a password reset link has been sent',
            });
        }

        // TODO: Send email with reset link
        // For now, return token in response for testing
        return NextResponse.json({
            success: true,
            message: 'Password reset link sent',
            // TODO: Remove in production
            resetToken: token,
        });
==== AFTER
        // Create reset token if user exists (persisted in DB; never leaked to client)
        await createPasswordResetToken(email);

        // Always return generic success message to prevent user enumeration and token leakage
        return NextResponse.json({
            success: true,
            message: 'If an account exists with this email, a password reset link has been sent',
        });
>>>>
```

---

### 4.5 Changes to `src/app/api/me/route.ts`
- **Lines 27–36**:
```typescript
<<<< BEFORE
        // Return user data along with reputation stats
        const rep = user.reputation as unknown as { points: number; boardsCreated: number; contributionsAccepted: number } | null;

        return NextResponse.json({
            ...user,
            reputationPoints: rep?.points || 0,
            boardsCreated: rep?.boardsCreated || 0,
            contributionsAccepted: rep?.contributionsAccepted || 0,
        });
==== AFTER
        // Exclude passwordHash and any raw password fields
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { passwordHash, ...safeUser } = user as typeof user & { password_hash?: string };

        // Return user data along with reputation stats
        const rep = user.reputation as unknown as { points: number; boardsCreated: number; contributionsAccepted: number } | null;

        return NextResponse.json({
            ...safeUser,
            reputationPoints: rep?.points || 0,
            boardsCreated: rep?.boardsCreated || 0,
            contributionsAccepted: rep?.contributionsAccepted || 0,
        });
>>>>
```

---

### 4.6 Changes to `src/app/api/profile/[id]/route.ts`
- **Lines 16–58 (`GET`) & Lines 112–118 (`PUT`)**:
```typescript
<<<< BEFORE (GET)
// GET /api/profile/[id]
export async function GET(
    req: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const params = await props.params;
        // Get user profile
        const userProfile = await db.select()
            .from(users)
            .where(eq(users.id, params.id))
            .limit(1);

        if (userProfile.length === 0) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const user = userProfile[0];

        // Get user's boards count
        const userBoards = await db.select()
            .from(boards)
            .where(and(eq(boards.userId, params.id), isNull(boards.deletedAt)));

        // Get reputation if exists
        const reputation = await db.select()
            .from(userReputation)
            .where(eq(userReputation.userId, params.id))
            .limit(1);

        return NextResponse.json({
            id: user.id,
            name: user.name,
            email: user.email,
            bio: user.bio,
            avatarUrl: user.avatarUrl,
            boardsCount: userBoards.length,
            reputation: reputation.length > 0 ? reputation[0].points : 0,
        });
==== AFTER (GET)
// GET /api/profile/[id]
export async function GET(
    req: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const params = await props.params;
        const session = await auth();
        const isOwner = !!(session?.user?.id && session.user.id === params.id);

        // Get user profile (explicit column selection)
        const userProfile = await db.select({
            id: users.id,
            name: users.name,
            email: users.email,
            bio: users.bio,
            avatarUrl: users.avatarUrl,
            createdAt: users.createdAt,
        })
            .from(users)
            .where(eq(users.id, params.id))
            .limit(1);

        if (userProfile.length === 0) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const user = userProfile[0];

        // Get user's boards count: non-owners only count public boards
        const boardConditions = [
            eq(boards.userId, params.id),
            isNull(boards.deletedAt),
        ];
        if (!isOwner) {
            boardConditions.push(eq(boards.isPublic, true));
        }

        const userBoards = await db.select({ id: boards.id })
            .from(boards)
            .where(and(...boardConditions));

        // Get reputation if exists
        const reputation = await db.select()
            .from(userReputation)
            .where(eq(userReputation.userId, params.id))
            .limit(1);

        const responsePayload: Record<string, any> = {
            id: user.id,
            name: user.name,
            bio: user.bio,
            avatarUrl: user.avatarUrl,
            createdAt: user.createdAt,
            boardsCount: userBoards.length,
            reputation: reputation.length > 0 ? reputation[0].points : 0,
        };

        // Privacy Hardening: only expose email to account owner
        if (isOwner) {
            responsePayload.email = user.email;
        }

        return NextResponse.json(responsePayload);
>>>>

<<<< BEFORE (PUT)
        const updated = await db.update(users)
            .set(updateData)
            .where(eq(users.id, params.id))
            .returning();

        return NextResponse.json(updated[0]);
==== AFTER (PUT)
        const updated = await db.update(users)
            .set(updateData)
            .where(eq(users.id, params.id))
            .returning({
                id: users.id,
                name: users.name,
                bio: users.bio,
                avatarUrl: users.avatarUrl,
            });

        return NextResponse.json(updated[0]);
>>>>
```

---

### 4.7 Changes to `src/lib/search.ts` & `src/components/SearchModal.tsx`
- **In `src/lib/search.ts`**:
```typescript
<<<< BEFORE
export interface SearchResult {
    boards: Array<{
        id: string;
        title: string;
        userId: string;
        userName: string | null;
        isPublic: boolean;
        thumbnail: string | null;
        createdAt: Date | null;
    }>;
    users: Array<{
        id: string;
        name: string | null;
        email: string;
        avatarUrl: string | null;
    }>;
    totalResults: number;
}
...
    // Search users (names and emails - limited for privacy)
    const userResults = await db
        .select({
            id: users.id,
            name: users.name,
            email: users.email,
            avatarUrl: users.avatarUrl,
        })
        .from(users)
        .where(or(like(users.name, searchTerm), like(users.email, searchTerm)))
        .limit(10);
==== AFTER
export interface SearchResult {
    boards: Array<{
        id: string;
        title: string;
        userId: string;
        userName: string | null;
        isPublic: boolean;
        thumbnail: string | null;
        createdAt: Date | null;
    }>;
    users: Array<{
        id: string;
        name: string | null;
        avatarUrl: string | null;
    }>;
    totalResults: number;
}
...
    // Search users (names only - email omitted for privacy)
    const userResults = await db
        .select({
            id: users.id,
            name: users.name,
            avatarUrl: users.avatarUrl,
        })
        .from(users)
        .where(like(users.name, searchTerm))
        .limit(10);
>>>>
```

- **In `src/components/SearchModal.tsx`**:
  - Update `SearchResult['users']` (lines 15–19):
    ```typescript
    users: Array<{
        id: string;
        name: string | null;
        avatarUrl?: string | null;
    }>;
    ```
  - Update avatar letter fallback (line 209):
    ```tsx
    {(user.name || 'Agent')[0].toUpperCase()}
    ```
  - Update line 213 to omit email:
    ```tsx
    <p className="text-[10px] font-mono text-[var(--panel-foreground)]/40 uppercase tracking-tighter">Agent Dossier</p>
    ```

---

### 4.8 Changes to `src/app/api/auth/verify-email/route.ts` & `src/lib/auth-utils.ts`
- **In `src/app/api/auth/verify-email/route.ts`**:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifyEmailToken } from '@/lib/auth-utils';
import { checkRateLimit } from '@/lib/rate-limit';

export async function GET(req: NextRequest) {
    try {
        // Rate limiting (IP-based) to prevent brute-force attacks
        const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
        const rateLimit = await checkRateLimit(`verify-email:${ip}`, 10, 60000); // 10 attempts per minute
        if (!rateLimit.success) {
            return NextResponse.json(
                { error: 'Too many verification attempts. Please try again later.' },
                { status: 429 }
            );
        }

        const { searchParams } = new URL(req.url);
        const token = searchParams.get('token');

        if (!token || typeof token !== 'string' || token.trim().length === 0 || token.length > 128) {
            return NextResponse.json(
                { error: 'Verification token is required' },
                { status: 400 }
            );
        }

        const result = await verifyEmailToken(token.trim());

        if (!result.valid) {
            return NextResponse.json(
                { error: 'Invalid or expired verification token' },
                { status: 400 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Email verified successfully',
        });

    } catch (error) {
        console.error('Email verification error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
```

- **In `src/lib/auth-utils.ts:38–42` (`verifyEmailToken`)**:
```typescript
    // Check if token is expired
    if (new Date() > new Date(tokenData.expires)) {
        // Delete expired token to prevent table bloat
        await db.delete(emailVerificationTokens)
            .where(eq(emailVerificationTokens.token, token));
        return { valid: false };
    }
```

---

## 5. Verification Method

### 5.1 Automated Command Checks
Run the following test suites to independently verify these changes:

1. **Unit & Integration Test Suites**:
   ```bash
   # Run all unit tests including search and password suites
   npm run test:unit

   # Run auth signup integration tests
   npx vitest run tests/integration/auth-signup.test.ts

   # Run soft-delete and profile query integration tests
   npx vitest run tests/integration/soft-delete-api.test.ts

   # Run search unit tests
   npx vitest run tests/unit/search.test.ts
   ```

2. **Code Quality & Typecheck**:
   ```bash
   npm run lint
   ```

3. **E2E Security Hardening Spec**:
   ```bash
   npx playwright test tests/e2e/tier1/security.spec.ts
   ```

4. **E2E Rate Limiting & Concurrency Spec**:
   ```bash
   npx playwright test tests/e2e/tier2/rate-limit.spec.ts
   ```

### 5.2 Specific Assertions to Inspect
- `T1-SEC-01`: `POST /api/auth/signup` response JSON contains `userId` and `success: true`, but strictly DOES NOT contain `verificationToken` or `token`.
- `T1-SEC-02`: `POST /api/auth/forgot-password` response JSON contains `{ success: true, message: '...' }`, but strictly DOES NOT contain `resetToken`.
- `T1-SEC-03`: `GET /api/me` response JSON contains `id`, `name`, `email`, but strictly DOES NOT contain `passwordHash` or `password_hash`.
- `T1-SEC-04`: `PUT /api/profile/[id]` response JSON strictly DOES NOT contain `passwordHash` or `password_hash`.
- `T1-SEC-05`: `GET /api/profile/[id]` without auth returns `res.data.email === undefined` and `res.data.passwordHash === undefined`.
- `GET /api/search?q=test`: Returned `users` array items have `{ id, name, avatarUrl }` and NO `email` property.

### 5.3 Invalidation Conditions
- Any change that returns `verificationToken` in `POST /api/auth/signup` or `resetToken` in `POST /api/auth/forgot-password` immediately invalidates this audit.
- Any change that leaks `passwordHash` in `GET /api/me` or `PUT /api/profile/[id]` immediately invalidates this audit.
- Any change that exposes `email` to third parties in `GET /api/profile/[id]` or `GET /api/search` immediately invalidates this audit.
