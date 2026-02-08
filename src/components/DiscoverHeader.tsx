"use client";

import Link from "next/link";
import { Search, Fingerprint } from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { UserBadge } from "./dashboard/UserBadge";

export function DiscoverHeader() {
    const { user, isAuthenticated, isLoading, rank } = useUser();

    return (
        <header className="fixed top-0 left-0 right-0 z-50 bg-stone-950/80 backdrop-blur-md border-b border-stone-800">
            <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Fingerprint className="w-8 h-8 text-amber-500" />
                    <h1 className="text-xl font-bold font-serif tracking-wider text-amber-500">THE CASE FILE</h1>
                </div>

                <div className="flex-1 max-w-xl mx-8 hidden md:block">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
                        <input
                            type="text"
                            placeholder="Search public investigations..."
                            className="w-full bg-stone-900 border border-stone-800 rounded-full py-2 pl-10 pr-4 text-sm text-stone-300 focus:outline-none focus:border-amber-500/50 transition-colors"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {isLoading ? (
                        <div className="px-4 py-2 text-sm text-stone-400">Loading...</div>
                    ) : isAuthenticated ? (
                        <div className="flex items-center gap-4">
                            <Link href={`/profile/${user?.id}`}>
                                <UserBadge user={user} rank={rank} size="sm" showRank={false} />
                            </Link>
                            <Link
                                href="/cases"
                                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-bold transition-colors"
                            >
                                Dashboard
                            </Link>
                        </div>
                    ) : (
                        <>
                            <Link
                                href="/login"
                                className="text-sm font-medium text-stone-400 hover:text-stone-200 transition-colors"
                            >
                                Log In
                            </Link>
                            <Link
                                href="/signup"
                                className="px-4 py-2 bg-stone-100 text-stone-950 rounded-lg text-sm font-bold hover:bg-white transition-colors"
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
