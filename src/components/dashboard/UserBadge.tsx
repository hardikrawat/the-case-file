
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
        <div className={twMerge("flex items-center gap-3", className)}>
            <div className="relative group">
                {/* ID Card / Badge Container for Avatar */}
                <div className={twMerge(
                    "relative overflow-hidden rounded-md border-2 border-stone-700 bg-stone-800 shadow-lg",
                    sizeClasses[size].split(' ')[0],
                    sizeClasses[size].split(' ')[1]
                )}>
                    {user.image || user.avatarUrl ? (
                        <div className="relative w-full h-full grayscale contrast-125 sepia-[.3]">
                            <Image
                                src={user.image || user.avatarUrl || ''}
                                alt={user.name || "Agent"}
                                fill
                                className="object-cover"
                                unoptimized
                            />
                        </div>
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-stone-900 text-stone-500 font-bold font-mono">
                            {(user.name?.[0] || "A").toUpperCase()}
                        </div>
                    )}

                    {/* "Laminated" Overlay Reflection */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent opacity-50 pointer-events-none" />
                </div>

                {/* Status Indicator */}
                <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-stone-950 shadow-sm" />
            </div>

            {(showName || showRank) && (
                <div className="flex flex-col">
                    {showName && (
                        <span className="font-mono font-bold text-stone-200 tracking-wider">
                            {user.name || "UNKNOWN AGENT"}
                        </span>
                    )}
                    {showRank && (
                        <span className="text-xs font-bold text-amber-600 uppercase tracking-widest border border-amber-900/30 px-1 py-0.5 rounded bg-amber-950/20 inline-block mt-0.5">
                            {rank}
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}
