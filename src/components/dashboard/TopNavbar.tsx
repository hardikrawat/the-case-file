'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    FileText,
    Settings,
    LogOut,
    Search,
    Bell,
    Trophy,
    Shield,
    Menu,
    X,
} from 'lucide-react';
import { signOut } from 'next-auth/react';
import Image from 'next/image';
import { useUser } from '@/hooks/useUser';
import { UserBadge } from '@/components/dashboard/UserBadge';
import SearchModal from '@/components/SearchModal';
import AppleSpinner from '@/components/ui/AppleSpinner';

const navItems = [
    { name: 'Discover', href: '/discover', icon: LayoutDashboard },
    { name: 'My Cases', href: '/cases', icon: FileText },
    { name: 'Notifications', href: '/notifications', icon: Bell },
    { name: 'Leaderboard', href: '/leaderboard', icon: Trophy },
];

export function TopNavbar() {
    const pathname = usePathname();
    const [isSigningOut, setIsSigningOut] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const { user, rank, isAuthenticated } = useUser();

    // Close mobile menu on route change
    useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [pathname]);

    // Unread notifications polling (30s)
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

    // Keyboard shortcut listener for Cmd+K / Ctrl+K
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            setIsSearchOpen((prev) => !prev);
        }
    }, []);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

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
            <header className="h-14 w-full bg-[var(--panel-background)]/90 backdrop-blur-md border-b border-[var(--panel-border)] text-[var(--panel-foreground)] transition-colors duration-300 z-40 sticky top-0 flex-shrink-0 px-4 flex items-center justify-between shadow-sm">
                {/* Left Section: Brand / Title */}
                <div className="flex items-center gap-3 shrink-0">
                    <Link
                        href="/cases"
                        className="flex items-center gap-2 group hover:opacity-90 transition-opacity"
                        title="The Case File Headquarters"
                    >
                        <div className="w-8 h-8 rounded-lg bg-[var(--sidebar-accent)]/15 border border-[var(--sidebar-accent)]/30 flex items-center justify-center text-[var(--sidebar-accent)] group-hover:scale-105 transition-transform">
                            <Shield className="w-4 h-4" />
                        </div>
                        <span className="text-base md:text-lg font-bold font-serif tracking-wider text-[var(--sidebar-accent)] whitespace-nowrap">
                            THE CASE FILE
                        </span>
                    </Link>
                </div>

                {/* Center Section: Primary Navigation Links & Quick Search (Desktop) */}
                <div className="hidden md:flex items-center gap-1.5 lg:gap-2">
                    {/* Navigation Pills */}
                    <nav className="flex items-center gap-1 bg-[var(--background)]/40 p-1 rounded-xl border border-[var(--panel-border)]/50">
                        {navItems.map((item) => {
                            const isActive = pathname === item.href;
                            const isNotifications = item.href === '/notifications';

                            return (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all relative ${
                                        isActive
                                            ? 'bg-[var(--sidebar-accent)] text-[var(--sidebar-accent-foreground)] shadow-sm'
                                            : 'text-[var(--panel-foreground)]/80 hover:text-[var(--panel-foreground)] hover:bg-[var(--sidebar-accent)]/10'
                                    }`}
                                >
                                    <div className="relative flex items-center">
                                        <item.icon className="w-3.5 h-3.5" />
                                        {isNotifications && unreadCount > 0 && (
                                            <span className="absolute -top-1 -right-1 flex h-2 w-2 rounded-full bg-red-600 animate-pulse" />
                                        )}
                                    </div>
                                    <span>{item.name}</span>
                                    {isNotifications && unreadCount > 0 && (
                                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                                            isActive
                                                ? 'bg-red-900 text-white'
                                                : 'bg-red-950/80 text-red-400 border border-red-800'
                                        }`}>
                                            {unreadCount > 9 ? '9+' : unreadCount}
                                        </span>
                                    )}
                                </Link>
                            );
                        })}
                    </nav>

                    {/* Quick Search Trigger */}
                    <button
                        onClick={() => setIsSearchOpen(true)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--background)]/50 hover:bg-[var(--sidebar-accent)]/10 border border-[var(--panel-border)] hover:border-[var(--sidebar-accent)]/40 text-[var(--panel-foreground)]/70 hover:text-[var(--foreground)] text-xs transition-all shadow-sm group"
                        title="Search Evidence (⌘K)"
                        aria-label="Search Evidence"
                    >
                        <Search className="w-3.5 h-3.5 text-[var(--sidebar-accent)] group-hover:scale-110 transition-transform" />
                        <span className="hidden lg:inline text-xs font-medium">Search Evidence...</span>
                        <kbd className="hidden sm:inline-block text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--background)] border border-[var(--panel-border)] text-[var(--panel-foreground)]/60">
                            ⌘K
                        </kbd>
                    </button>
                </div>

                {/* Right Section: Detective Profile & Actions Group */}
                <div className="flex items-center gap-2 shrink-0">
                    {isAuthenticated && user && (
                        <Link
                            href={`/profile/${user.id}`}
                            className="hidden sm:flex items-center gap-2.5 px-2.5 py-1 rounded-xl bg-[var(--background)]/50 hover:bg-[var(--sidebar-accent)]/15 border border-[var(--panel-border)] hover:border-[var(--sidebar-accent)]/40 transition-all shadow-sm group"
                            title="View Detective Dossier"
                        >
                            {/* Avatar with Status Dot */}
                            <div className="relative shrink-0">
                                <div className="w-7 h-7 rounded-lg border border-[var(--panel-border)] bg-[var(--panel-background)] overflow-hidden flex items-center justify-center text-[var(--sidebar-accent)] font-bold text-xs font-mono shadow-inner group-hover:border-[var(--sidebar-accent)]/50 transition-colors">
                                    {user.image || user.avatarUrl ? (
                                        <Image
                                            src={user.image || user.avatarUrl || ''}
                                            alt={user.name || 'Agent'}
                                            width={28}
                                            height={28}
                                            className="w-full h-full object-cover"
                                            unoptimized
                                        />
                                    ) : (
                                        <span>{(user.name?.[0] || 'A').toUpperCase()}</span>
                                    )}
                                </div>
                                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full ring-2 ring-[var(--panel-background)]" />
                            </div>

                            {/* Name & Rank Details */}
                            <div className="flex flex-col items-start leading-tight">
                                <span className="text-xs font-bold text-[var(--foreground)] tracking-tight group-hover:text-[var(--sidebar-accent)] transition-colors truncate max-w-[120px] sm:max-w-[150px]">
                                    {user.name || 'Agent'}
                                </span>
                                <span className="text-[9px] font-mono font-semibold uppercase tracking-wider text-[var(--sidebar-accent)]/90">
                                    {rank || 'Agent'}
                                </span>
                            </div>
                        </Link>
                    )}

                    <div className="w-px h-5 bg-[var(--panel-border)] mx-0.5 hidden sm:block" />

                    {/* Quick Action Icons Group */}
                    <div className="flex items-center gap-0.5 bg-[var(--background)]/40 p-0.5 rounded-xl border border-[var(--panel-border)]/60">
                        <Link
                            href="/settings"
                            className={`p-1.5 rounded-lg transition-colors flex items-center justify-center ${
                                pathname === '/settings'
                                    ? 'bg-[var(--sidebar-accent)] text-[var(--sidebar-accent-foreground)] shadow-sm'
                                    : 'text-[var(--panel-foreground)]/70 hover:text-[var(--foreground)] hover:bg-[var(--sidebar-accent)]/15'
                            }`}
                            title="HQ Settings"
                            aria-label="HQ Settings"
                        >
                            <Settings className="w-4 h-4" />
                        </Link>

                        <button
                            onClick={handleSignOut}
                            disabled={isSigningOut}
                            className="p-1.5 rounded-lg text-[var(--panel-foreground)]/70 hover:text-red-400 hover:bg-red-500/15 transition-colors disabled:opacity-50 flex items-center justify-center"
                            title="Sign Out"
                            aria-label="Sign Out"
                        >
                            {isSigningOut ? (
                                <AppleSpinner size="xs" className="text-red-400" />
                            ) : (
                                <LogOut className="w-4 h-4" />
                            )}
                        </button>
                    </div>

                    {/* Mobile Hamburger Toggle */}
                    <button
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        className="p-1.5 md:hidden rounded-lg bg-[var(--background)]/50 border border-[var(--panel-border)] text-[var(--panel-foreground)] hover:bg-[var(--sidebar-accent)]/10 flex items-center justify-center"
                        title="Toggle Navigation Menu"
                        aria-label="Toggle Navigation Menu"
                    >
                        {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </button>
                </div>
            </header>

            {/* Mobile Dropdown Navigation Drawer */}
            {isMobileMenuOpen && (
                <div className="md:hidden fixed top-14 inset-x-0 bg-[var(--panel-background)]/98 backdrop-blur-xl border-b border-[var(--panel-border)] p-4 z-40 shadow-2xl animate-in slide-in-from-top-2 duration-200">
                    <button
                        onClick={() => {
                            setIsMobileMenuOpen(false);
                            setIsSearchOpen(true);
                        }}
                        className="w-full flex items-center justify-between p-3 rounded-xl bg-[var(--background)]/60 border border-[var(--panel-border)] mb-3 text-sm text-[var(--panel-foreground)]"
                    >
                        <span className="flex items-center gap-2">
                            <Search className="w-4 h-4 text-[var(--sidebar-accent)]" />
                            Search Evidence...
                        </span>
                        <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--background)] border border-[var(--panel-border)]">
                            ⌘K
                        </kbd>
                    </button>

                    <nav className="space-y-1">
                        {navItems.map((item) => {
                            const isActive = pathname === item.href;
                            const isNotifications = item.href === '/notifications';

                            return (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                                        isActive
                                            ? 'bg-[var(--sidebar-accent)] text-[var(--sidebar-accent-foreground)]'
                                            : 'text-[var(--panel-foreground)] hover:bg-[var(--sidebar-accent)]/10'
                                    }`}
                                >
                                    <span className="flex items-center gap-3">
                                        <item.icon className="w-4 h-4" />
                                        {item.name}
                                    </span>
                                    {isNotifications && unreadCount > 0 && (
                                        <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-red-600 text-white font-bold">
                                            {unreadCount}
                                        </span>
                                    )}
                                </Link>
                            );
                        })}
                    </nav>

                    {isAuthenticated && user && (
                        <div className="mt-4 pt-4 border-t border-[var(--panel-border)]">
                            <Link href={`/profile/${user.id}`} className="block">
                                <UserBadge user={user} rank={rank} size="sm" />
                            </Link>
                        </div>
                    )}
                </div>
            )}

            <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
        </>
    );
}

export default TopNavbar;
