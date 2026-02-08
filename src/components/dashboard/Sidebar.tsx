"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FileText, Star, Settings, LogOut, Search, Bell, Trophy } from "lucide-react";
import { signOut } from "next-auth/react";
import { useState } from "react";
import { useUser } from "@/hooks/useUser";
import { UserBadge } from "./UserBadge";
import SearchModal from "@/components/SearchModal";

const navigation = [
    { name: "Discover", href: "/discover", icon: LayoutDashboard },
    { name: "My Cases", href: "/cases", icon: FileText },
    { name: "Leaderboard", href: "/leaderboard", icon: Trophy },
    { name: "Starred", href: "/starred", icon: Star },
    { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
    const pathname = usePathname();
    const [isSigningOut, setIsSigningOut] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const { user, rank, isAuthenticated } = useUser();

    const handleSignOut = async () => {
        setIsSigningOut(true);
        try {
            await signOut({ callbackUrl: '/' });
        } catch (error) {
            console.error('Sign out error:', error);
            setIsSigningOut(false);
        }
    };

    return (
        <>
            <div className="flex flex-col w-64 h-screen bg-sidebar border-r border-sidebar-accent/20 text-sidebar-foreground transition-colors duration-300">
                <div className="p-6">
                    <h1 className="text-2xl font-bold text-sidebar-accent tracking-wider font-serif">
                        THE CASE FILE
                    </h1>
                </div>

                <div className="px-4 mb-2">
                    <button
                        onClick={() => setIsSearchOpen(true)}
                        className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent/10 hover:text-sidebar-accent transition-colors border border-sidebar-accent/10 hover:border-sidebar-accent/30 text-left"
                    >
                        <Search className="w-5 h-5" />
                        <span className="font-medium">Search Evidence...</span>
                    </button>
                </div>

                <nav className="flex-1 px-4 space-y-2 overflow-y-auto no-scrollbar">
                    {/* Main Navigation */}
                    {navigation.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive
                                    ? "bg-sidebar-accent/10 text-sidebar-accent"
                                    : "hover:bg-sidebar-accent/5 hover:text-sidebar-foreground"
                                    }`}
                            >
                                <item.icon className="w-5 h-5" />
                                <span className="font-medium">{item.name}</span>
                            </Link>
                        );
                    })}

                    {/* Notifications as a nav item */}
                    <button
                        className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent/5 hover:text-sidebar-foreground transition-colors text-left relative"
                    >
                        <div className="relative">
                            <Bell className="w-5 h-5" />
                            {/* Notification dot placeholder */}
                            <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-sidebar"></span>
                        </div>
                        <span className="font-medium">Notifications</span>
                    </button>
                </nav>

                <div className="p-4 border-t border-[var(--sidebar-accent)]/10 bg-[var(--sidebar-background)]">
                    {isAuthenticated && (
                        <div className="mb-4 bg-[var(--panel-background)]/30 p-3 rounded-lg border border-[var(--panel-border)]/50 hover:border-[var(--sidebar-accent)]/40 transition-all group">
                            <Link href={`/profile/${user?.id}`} className="block hover:opacity-80 transition-opacity">
                                <UserBadge user={user} rank={rank} size="sm" />
                            </Link>
                        </div>
                    )}

                    <button
                        onClick={handleSignOut}
                        disabled={isSigningOut}
                        className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-[var(--sidebar-foreground)]/60 hover:bg-red-500/10 hover:text-red-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                    >
                        <LogOut className="w-5 h-5 opacity-50 group-hover:opacity-100" />
                        <span className="font-bold text-xs uppercase tracking-[0.2em]">{isSigningOut ? 'Signing out...' : 'Sign Out'}</span>
                    </button>
                </div>
            </div>

            <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
        </>
    );
}
