"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FileText, Star, Settings, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { useState } from "react";
import { useUser } from "@/hooks/useUser";
import { UserBadge } from "./UserBadge";

const navigation = [
    { name: "Discover", href: "/dashboard/discover", icon: LayoutDashboard },
    { name: "My Cases", href: "/dashboard", icon: FileText },
    { name: "Starred", href: "/dashboard/starred", icon: Star },
    { name: "Settings", href: "/dashboard/settings", icon: Settings },
];

export function Sidebar() {
    const pathname = usePathname();
    const [isSigningOut, setIsSigningOut] = useState(false);
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
        <div className="flex flex-col w-64 h-screen bg-stone-900 border-r border-stone-800 text-stone-300">
            <div className="p-6">
                <h1 className="text-2xl font-bold text-amber-500 tracking-wider font-serif">
                    THE CASE FILE
                </h1>
            </div>

            <nav className="flex-1 px-4 space-y-2">
                {navigation.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive
                                ? "bg-amber-900/20 text-amber-500"
                                : "hover:bg-stone-800 hover:text-stone-100"
                                }`}
                        >
                            <item.icon className="w-5 h-5" />
                            <span className="font-medium">{item.name}</span>
                        </Link>
                    );
                })}
            </nav>

            <div className="p-4 border-t border-stone-800">
                {isAuthenticated && (
                    <div className="mb-4 bg-stone-950/50 p-3 rounded-lg border border-stone-800">
                        <Link href={`/profile/${user?.id}`} className="block hover:opacity-80 transition-opacity">
                            <UserBadge user={user} rank={rank} size="sm" />
                        </Link>
                    </div>
                )}

                <button
                    onClick={handleSignOut}
                    disabled={isSigningOut}
                    className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-stone-400 hover:bg-stone-800 hover:text-red-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <LogOut className="w-5 h-5" />
                    <span className="font-medium">{isSigningOut ? 'Signing out...' : 'Sign Out'}</span>
                </button>
            </div>
        </div>
    );
}
