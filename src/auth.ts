import NextAuth from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/lib/db";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { comparePassword } from "@/lib/password";
import { loginSchema } from "@/lib/validations/auth";

export const { handlers, auth, signIn, signOut } = NextAuth({
    ...authConfig,
    trustHost: true,
    adapter: DrizzleAdapter(db),
    providers: [
        // Only include OAuth providers if credentials are configured
        ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
            ? [GitHub]
            : []
        ),
        ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
            ? [Google]
            : []
        ),
        Credentials({
            name: "Email",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials) {
                const validationResult = loginSchema.safeParse(credentials);

                if (!validationResult.success) {
                    throw new Error('INVALID_CREDENTIALS');
                }

                const { email, password } = validationResult.data;

                // Check if account is locked due to failed attempts
                const { checkAccountLockout, recordFailedAttempt, clearFailedAttempts } = await import('@/lib/account-security');
                const lockoutCheck = await checkAccountLockout(email);

                if (lockoutCheck.isLocked) {
                    throw new Error(`ACCOUNT_LOCKED:${lockoutCheck.remainingTime}`);
                }

                const userResult = await db.select().from(users)
                    .where(eq(users.email, email))
                    .limit(1);

                if (userResult.length === 0 || !userResult[0].passwordHash) {
                    // Record failed attempt (user not found)
                    await recordFailedAttempt(email);
                    throw new Error('INVALID_CREDENTIALS');
                }

                const user = userResult[0];

                if (!user.passwordHash) {
                    await recordFailedAttempt(email);
                    throw new Error('INVALID_CREDENTIALS');
                }

                const isValid = await comparePassword(
                    password,
                    user.passwordHash
                );

                if (!isValid) {
                    // Record failed attempt (wrong password)
                    await recordFailedAttempt(email);
                    throw new Error('INVALID_CREDENTIALS');
                }

                // Check if email is verified
                if (!user.emailVerifiedFlag) {
                    throw new Error('EMAIL_NOT_VERIFIED');
                }

                // Clear failed attempts on successful login
                await clearFailedAttempts(email);

                return {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                };
            }
        })
    ],
    callbacks: {
        ...authConfig.callbacks,
        async session({ session, user, token }) {
            if (session.user) {
                // For credentials provider, use token.sub
                session.user.id = user?.id || token.sub || '';
            }
            return session;
        },
    },
    session: {
        strategy: "jwt", // Use JWT for credentials provider
        maxAge: 30 * 24 * 60 * 60, // 30 days
        updateAge: 24 * 60 * 60, // 24 hours - refresh session token
    },
});
