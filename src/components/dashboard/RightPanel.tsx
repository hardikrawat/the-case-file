import { db } from "@/lib/db";
import { userReputation, comments } from "@/lib/schema";
import { desc } from "drizzle-orm";
import { formatDistanceToNow } from "date-fns";
import Image from "next/image";
import { Shield, Zap, Terminal, Search, User } from "lucide-react";

interface Detective {
    userId: string;
    points: number | null;
    user: {
        name: string | null;
        image: string | null;
    };
}

interface Activity {
    id: string;
    content: string;
    createdAt: Date | string | null;
    user: {
        name: string | null;
    };
    board: {
        title: string;
    } | null;
}

export async function RightPanel() {
    let topDetectives: Detective[] = [];
    let recentActivity: Activity[] = [];

    // Only query DB if credentials exist
    if (process.env.TURSO_DATABASE_URL) {
        // 1. Fetch Top Detectives
        topDetectives = (await db.query.userReputation.findMany({
            orderBy: [desc(userReputation.points)],
            limit: 5,
            with: {
                user: true
            }
        })) as unknown as Detective[];

        // 2. Fetch Recent System Activity (Comments for now)
        recentActivity = (await db.query.comments.findMany({
            orderBy: [desc(comments.createdAt)],
            limit: 8,
            with: {
                user: true,
                board: true
            }
        })) as unknown as Activity[];
    }

    return (
        <aside className="w-80 border-l border-[var(--panel-border)] bg-[var(--panel-background)] text-[var(--panel-foreground)] p-0 hidden xl:flex flex-col h-screen transition-colors duration-500">
            {/* Bureau Hierarchy Section */}
            <div className="p-6 border-b border-[var(--panel-border)]/50">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-[10px] font-bold text-[var(--panel-foreground)]/60 uppercase tracking-[0.2em] flex items-center gap-2">
                        <Shield className="w-3 h-3 text-[var(--sidebar-accent)]" />
                        Bureau Hierarchy
                    </h3>
                    <div className="h-[1px] flex-1 bg-[var(--panel-border)]/30 ml-4"></div>
                </div>

                <div className="space-y-3">
                    {topDetectives.length > 0 ? (
                        topDetectives.map((detective, index) => (
                            <div
                                key={detective.userId}
                                className="relative group flex items-center p-3 bg-[var(--background)] border border-[var(--panel-border)] rounded-lg shadow-sm hover:border-[var(--sidebar-accent)]/50 transition-all cursor-default"
                            >
                                {/* Rank Badge */}
                                <div className={`absolute -left-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold shadow-lg ring-2 ring-[var(--background)] border ${index === 0 ? "bg-[var(--sidebar-accent)] text-[var(--sidebar-accent-foreground)] border-[var(--sidebar-accent)]/50" :
                                        index === 1 ? "bg-stone-300 text-stone-950 border-stone-200" :
                                            index === 2 ? "bg-amber-800 text-amber-100 border-amber-700" :
                                                "bg-[var(--panel-background)] text-[var(--panel-foreground)]/60 border-[var(--panel-border)]"
                                    }`}>
                                    {index + 1}
                                </div>

                                <div className="ml-4 flex items-center gap-3 flex-1 overflow-hidden">
                                    <div className="relative w-10 h-10 shrink-0">
                                        <div className="w-full h-full rounded-md border border-[var(--panel-border)] overflow-hidden bg-[var(--panel-background)] flex items-center justify-center">
                                            {detective.user?.image ? (
                                                <Image src={detective.user.image} alt={detective.user.name || "User"} fill className="object-cover grayscale hover:grayscale-0 transition-all duration-500" unoptimized />
                                            ) : (
                                                <User className="w-5 h-5 text-[var(--panel-foreground)]/40" />
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        <p className="text-xs font-bold text-[var(--foreground)] truncate font-serif">
                                            {detective.user?.name || "Anonymous Agent"}
                                        </p>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <Zap className="w-2.5 h-2.5 text-[var(--sidebar-accent)]" />
                                            <span className="text-[10px] font-mono text-[var(--panel-foreground)]/60 uppercase tracking-tighter">
                                                {detective.points || 0} Performance Pts
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-6 border-2 border-dashed border-[var(--panel-border)]/30 rounded-xl">
                            <p className="text-[var(--panel-foreground)]/40 text-[10px] uppercase font-bold tracking-widest">No active dossiers</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Intel Scanner Section */}
            <div className="flex-1 overflow-hidden flex flex-col p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[10px] font-bold text-[var(--panel-foreground)]/60 uppercase tracking-[0.2em] flex items-center gap-2">
                        <Terminal className="w-3 h-3 text-[var(--sidebar-accent)]" />
                        Intel Scanner
                    </h3>
                    <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-[var(--sidebar-accent)] animate-pulse"></div>
                        <div className="w-1.5 h-1.5 rounded-full bg-[var(--sidebar-accent)]/40 animate-pulse delay-150"></div>
                        <div className="w-1.5 h-1.5 rounded-full bg-[var(--sidebar-accent)]/20 animate-pulse delay-300"></div>
                    </div>
                </div>

                <div className="flex-1 bg-[var(--background)] border border-[var(--panel-border)] rounded-lg relative overflow-hidden flex flex-col font-mono text-[11px]">
                    {/* Scanline Overlay */}
                    <div className="absolute inset-0 bg-scanline pointer-events-none opacity-[0.03] z-10" />
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[var(--sidebar-accent)]/5 to-transparent h-1/4 w-full animate-scan-roll pointer-events-none z-10" />

                    <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4">
                        {recentActivity.length > 0 ? (
                            recentActivity.map((activity) => (
                                <div key={activity.id} className="relative group border-l-2 border-[var(--panel-border)]/50 pl-3 py-0.5 hover:border-[var(--sidebar-accent)] transition-colors">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[var(--sidebar-accent)] font-bold uppercase tracking-widest text-[9px] px-1.5 py-0.5 bg-[var(--sidebar-accent)]/10 rounded border border-[var(--sidebar-accent)]/20">
                                            [Comms]
                                        </span>
                                        <span className="text-[var(--panel-foreground)]/50 text-[9px]">
                                            {activity.createdAt ? formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true }) : 'Realtime'}
                                        </span>
                                    </div>
                                    <p className="text-[var(--panel-foreground)]/80 leading-tight">
                                        <span className="text-[var(--foreground)] font-bold">{activity.user?.name || "Agent"}</span>
                                        {" intercepted a transmission on "}
                                        <span className="text-[var(--sidebar-accent)]/80 underline decoration-[var(--sidebar-accent)]/30 underline-offset-2">
                                            {activity.board?.title || "Classified"}
                                        </span>
                                    </p>
                                </div>
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-[var(--panel-foreground)]/40 gap-2 opacity-50">
                                <Search className="w-6 h-6 animate-pulse" />
                                <p className="uppercase tracking-widest text-[9px] font-bold">Scanning for Intel...</p>
                            </div>
                        )}
                    </div>

                    {/* Bottom Status Hook */}
                    <div className="p-2 border-t border-[var(--panel-border)]/50 bg-[var(--panel-background)]/50 flex items-center justify-between text-[9px] uppercase tracking-tighter text-[var(--panel-foreground)]/50 font-bold">
                        <span>Terminal: L-2394</span>
                        <span>Secure Feed v.0.0.1</span>
                    </div>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes scan-roll {
                    0% { transform: translateY(-100%); opacity: 0; }
                    50% { opacity: 1; }
                    100% { transform: translateY(400%); opacity: 0; }
                }
                .animate-scan-roll {
                    animation: scan-roll 4s linear infinite;
                }
                .bg-scanline {
                    background: linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.1) 50%);
                    background-size: 100% 4px;
                }
            ` }} />
        </aside>
    );
}
