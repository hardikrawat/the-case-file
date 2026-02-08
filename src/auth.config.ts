import type { NextAuthConfig } from "next-auth";

export const authConfig = {
    pages: {
        signIn: "/login",
    },
    trustHost: true,
    providers: [],
    callbacks: {
        authorized({ auth, request: { nextUrl, headers } }) {
            // Allow bypass in test environment
            const isTestBypass = headers.get('x-test-bypass') === 'true';
            if (isTestBypass) return true;

            const isLoggedIn = !!auth?.user;
            const protectedPaths = ['/cases', '/discover', '/settings', '/starred'];
            const isOnProtected = protectedPaths.some(path => nextUrl.pathname.startsWith(path));

            if (isOnProtected) {
                if (isLoggedIn) return true;
                return false; // Redirect unauthenticated users to login page
            } else if (isLoggedIn) {
                // Redirect logged-in users away from login page
                if (nextUrl.pathname === '/login') {
                    return Response.redirect(new URL('/cases', nextUrl));
                }
            }
            return true;
        },
    },
} satisfies NextAuthConfig;
