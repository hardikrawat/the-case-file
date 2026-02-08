"use client";

import { Search, Bell } from "lucide-react";
import { useState } from "react";
import SearchModal from "@/components/SearchModal";
import { useUser } from "@/hooks/useUser";
import { UserBadge } from "./UserBadge";
import Link from "next/link";

export function Header() {
    const { user, rank } = useUser();
    const [isSearchOpen, setIsSearchOpen] = useState(false);

    // Placeholder level calculation (in a real app, this would come from a reputation score in the session or DB)
    // const userLevel = "Level 1 Investigator";

    return (
        <>
            <header className="flex items-center justify-between px-8 py-4 border-b border-stone-800 bg-stone-950">
                <div className="flex-1 max-w-xl">
                    <div className="relative cursor-pointer" onClick={() => setIsSearchOpen(true)}>
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
                        <input
                            type="text"
                            readOnly
                            placeholder="Search cases, evidence, or detectives..."
                            className="w-full bg-stone-900 border border-stone-800 rounded-full py-2 pl-10 pr-4 text-sm text-stone-300 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all placeholder:text-stone-600 cursor-pointer"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-6 ml-4">
                    <button className="relative text-stone-400 hover:text-amber-500 transition-colors">
                        <Bell className="w-5 h-5" />
                        {/* Notification dot - dynamic logic could go here */}
                        <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border-2 border-stone-950"></span>
                    </button>

                    <div className="pl-6 border-l border-stone-800">
                        {/* User Badge with Dropdown Trigger (future) */}
                        <Link href={`/profile/${user?.id || '#'}`}>
                            <UserBadge
                                user={user}
                                rank={rank}
                                className="hover:opacity-80 transition-opacity cursor-pointer"
                            />
                        </Link>
                    </div>
                </div>
            </header>

            <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
        </>
    );
}
