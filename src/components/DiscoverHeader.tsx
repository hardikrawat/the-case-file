"use client";

import Link from "next/link";
import { Search, Fingerprint } from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { UserBadge } from "./dashboard/UserBadge";
import AppleSpinner from "@/components/ui/AppleSpinner";

export function DiscoverHeader() {
    const { user, isAuthenticated, isLoading, rank } = useUser();

    return (
        <header className="fixed top-0 left-0 right-0 z-50 bg-[var(--header-background)]/90 backdrop-blur-md border-b border-[var(--header-border)] text-[var(--header-foreground)] transition-colors duration-300">
            <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Fingerprint className="w-8 h-8 text-[var(--sidebar-accent)]" />
                    <h1 className="text-xl font-bold font-serif tracking-wider text-[var(--sidebar-accent)]">THE CASE FILE</h1>
                </div>

                <div className="flex-1 max-w-xl mx-8 hidden md:block">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--panel-foreground)]/40" />
                        <input
                            type="text"
                            placeholder="Search public investigations..."
                            className="w-full bg-[var(--panel-background)] border border-[var(--panel-border)] rounded-full py-2 pl-10 pr-4 text-sm text-[var(--foreground)] placeholder-[var(--panel-foreground)]/40 focus:outline-none focus:border-[var(--sidebar-accent)]/50 transition-colors"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {isLoading ? (
                        <div className="px-4 py-2 flex items-center">
                            <AppleSpinner size="xs" />
                        </div>
                    ) : isAuthenticated ? (
                        <div className="flex items-center gap-4">
                            <Link href={`/profile/${user?.id}`}>
                                <UserBadge user={user} rank={rank} size="sm" showRank={false} />
                            </Link>
                            <Link
                                href="/cases"
                                className="px-4 py-2 bg-[var(--sidebar-accent)] hover:bg-[var(--sidebar-accent)]/90 text-[var(--sidebar-accent-foreground)] rounded-lg text-sm font-bold transition-colors shadow-md"
                            >
                                Dashboard
                            </Link>
                        </div>
                    ) : (
                        <>
                            <Link
                                href="/login"
                                className="text-sm font-medium text-[var(--panel-foreground)]/60 hover:text-[var(--foreground)] transition-colors"
                            >
                                Log In
                            </Link>
                            <Link
                                href="/signup"
                                className="px-4 py-2 bg-[var(--sidebar-accent)] text-[var(--sidebar-accent-foreground)] rounded-lg text-sm font-bold hover:bg-[var(--sidebar-accent)]/90 transition-colors shadow-md"
                            >
                                Sign In to Start
                            </Link>
                        </>
                    )}
                </div>
            </div>
        </header>
    );
}
