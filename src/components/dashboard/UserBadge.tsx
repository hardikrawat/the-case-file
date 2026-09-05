
import { UserProfile } from "@/hooks/useUser";
import Image from "next/image";
import { twMerge } from "tailwind-merge";

interface UserBadgeProps {
    user: UserProfile | null | undefined;
    rank: string;
    showName?: boolean;
    showRank?: boolean;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

export function UserBadge({
    user,
    rank,
    showName = true,
    showRank = true,
    size = 'md',
    className
}: UserBadgeProps) {
    if (!user) return null;

    const sizeClasses = {
        sm: "w-8 h-8 text-xs",
        md: "w-10 h-10 text-sm",
        lg: "w-16 h-16 text-base",
    };



    return (
        <div className={twMerge("flex items-center", size === 'sm' ? "gap-2" : "gap-3", className)}>
            <div className="relative group shrink-0">
                {/* ID Card / Badge Container for Avatar */}
                <div className={twMerge(
                    "relative overflow-hidden rounded-md border border-[var(--panel-border)] bg-[var(--panel-background)] shadow-sm",
                    sizeClasses[size].split(' ')[0],
                    sizeClasses[size].split(' ')[1]
                )}>
                    {user.image || user.avatarUrl ? (
                        <div className="relative w-full h-full grayscale hover:grayscale-0 transition-opacity duration-500">
                            <Image
                                src={user.image || user.avatarUrl || ''}
                                alt={user.name || "Agent"}
                                fill
                                className="object-cover"
                                unoptimized
                            />
                        </div>
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-[var(--background)] text-[var(--panel-foreground)]/40 font-bold font-mono">
                            {(user.name?.[0] || "A").toUpperCase()}
                        </div>
                    )}

                    {/* "Laminated" Overlay Reflection */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent opacity-30 pointer-events-none" />
                </div>

                {/* Status Indicator */}
                <div className={twMerge(
                    "absolute -bottom-0.5 -right-0.5 bg-green-500 rounded-full border-2 border-[var(--background)] shadow-sm",
                    size === 'sm' ? "w-2.5 h-2.5" : "w-3 h-3"
                )} />
            </div>

            {(showName || showRank) && (
                <div className="flex flex-col leading-tight min-w-0">
                    {showName && (
                        <span className={twMerge(
                            "font-mono font-bold text-[var(--foreground)] tracking-wider truncate",
                            size === 'sm' ? "text-xs max-w-[130px]" : "text-sm"
                        )}>
                            {user.name || "UNKNOWN AGENT"}
                        </span>
                    )}
                    {showRank && (
                        <span className={twMerge(
                            "font-bold text-[var(--sidebar-accent)] uppercase tracking-widest border border-[var(--sidebar-accent)]/20 rounded bg-[var(--sidebar-accent)]/10 inline-block shrink-0",
                            size === 'sm' ? "text-[9px] px-1 py-0 mt-0.5" : "text-[10px] px-1.5 py-0.5 mt-0.5"
                        )}>
                            {rank}
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}
