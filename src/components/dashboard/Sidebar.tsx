"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FileText, Settings, LogOut, Search, Bell, Trophy, PanelLeftClose } from "lucide-react";
import { signOut } from "next-auth/react";
import { useState, useEffect } from "react";
import { useUser } from "@/hooks/useUser";
import { UserBadge } from "./UserBadge";
import SearchModal from "@/components/SearchModal";
import AppleSpinner from "@/components/ui/AppleSpinner";

const navigation = [
    { name: "Discover", href: "/discover", icon: LayoutDashboard },
    { name: "My Cases", href: "/cases", icon: FileText },
    { name: "Notifications", href: "/notifications", icon: Bell },
    { name: "Leaderboard", href: "/leaderboard", icon: Trophy },
    { name: "Settings", href: "/settings", icon: Settings },
];

interface SidebarProps {
    isBoard?: boolean;
    onClose?: () => void;
}

export function Sidebar({ isBoard, onClose }: SidebarProps = {}) {
    const pathname = usePathname();
    const [isSigningOut, setIsSigningOut] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const { user, rank, isAuthenticated } = useUser();

    useEffect(() => {
        if (!isAuthenticated) return;
        const fetchUnread = async () => {
            try {
                const res = await fetch('/api/notifications');
                if (res.ok) {
                    const data = await res.json();
                    setUnreadCount(typeof data.unreadCount === 'number' ? data.unreadCount : 0);
                }
            } catch {
                // Silently ignore network fetch errors
            }
        };
        fetchUnread();
        const timer = setInterval(fetchUnread, 30000);
        return () => clearInterval(timer);
    }, [isAuthenticated]);

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
                <div className="p-6 flex items-center justify-between">
                    <h1 className="text-2xl font-bold text-sidebar-accent tracking-wider font-serif">
                        THE CASE FILE
                    </h1>
                    {isBoard && onClose && (
                        <button
                            onClick={onClose}
                            className="p-1 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/10 rounded-lg transition-colors"
                            title="Collapse Sidebar"
                            aria-label="Collapse Sidebar"
                        >
                            <PanelLeftClose className="w-5 h-5 text-sidebar-accent" />
                        </button>
                    )}
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
                        const isNotifications = item.href === '/notifications';

                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors group relative ${isActive
                                    ? "bg-sidebar-accent/10 text-sidebar-accent font-semibold"
                                    : "hover:bg-sidebar-accent/5 hover:text-sidebar-foreground"
                                    }`}
                            >
                                <div className="relative">
                                    <item.icon className="w-5 h-5" />
                                    {isNotifications && unreadCount > 0 && (
                                        <span className="absolute -top-1 -right-1 flex h-2 w-2 rounded-full bg-red-600 animate-pulse" />
                                    )}
                                </div>
                                <span className="font-medium">{item.name}</span>
                                {isNotifications && unreadCount > 0 && (
                                    <span className="ml-auto text-xs px-1.5 py-0.5 rounded bg-red-950/80 text-red-400 border border-red-800 font-mono font-bold">
                                        {unreadCount > 9 ? '9+' : unreadCount}
                                    </span>
                                )}
                            </Link>
                        );
                    })}
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
                        {isSigningOut ? (
                            <>
                                <AppleSpinner size="sm" className="text-red-400" />
                                <span className="font-bold text-xs uppercase tracking-[0.2em]">Signing out...</span>
                            </>
                        ) : (
                            <>
                                <LogOut className="w-5 h-5 opacity-50 group-hover:opacity-100" />
                                <span className="font-bold text-xs uppercase tracking-[0.2em]">Sign Out</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
        </>
    );
}
