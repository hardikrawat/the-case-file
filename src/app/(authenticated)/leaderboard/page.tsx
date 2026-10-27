'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import AppleSpinner from '@/components/ui/AppleSpinner';

interface LeaderboardEntry {
    userId: string;
    points: number;
    boardsCreated: number;
    lastUpdated?: Date | null;
    userName?: string | null;
    userImage?: string | null;
}

export default function LeaderboardPage() {
    const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetch('/api/leaderboard')
            .then(res => res.json())
            .then(data => setLeaders(data))
            .catch(err => console.error(err))
            .finally(() => setIsLoading(false));
    }, []);

    return (
        <div className="min-h-screen p-8 bg-transparent text-[var(--foreground)] transition-colors duration-500">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <Link href="/cases" className="text-[var(--sidebar-accent)] hover:underline text-sm mb-4 inline-block font-mono">
                        ← Back to Dashboard
                    </Link>
                    <h1 className="text-4xl font-bold text-[var(--sidebar-accent)] font-serif mb-2">Leaderboard</h1>
                    <p className="text-[var(--panel-foreground)]/60">Top detectives by reputation</p>
                </div>

                {/* Leaderboard */}
                <div className="bg-[var(--panel-background)]/80 backdrop-blur-sm border border-[var(--panel-border)] rounded-xl overflow-hidden shadow-2xl">
                    {isLoading ? (
                        <div className="py-16 flex flex-col items-center justify-center">
                            <AppleSpinner size="lg" label="Decrypting leaderboard dossiers..." />
                        </div>
                    ) : leaders.length === 0 ? (
                        <p className="text-center text-[var(--panel-foreground)]/60 py-12">No data yet. Start solving cases!</p>
                    ) : (
                        <div className="divide-y divide-[var(--panel-border)]">
                            {leaders.map((entry, index) => (
                                <div
                                    key={entry.userId}
                                    className="flex items-center gap-4 p-4 hover:bg-[var(--background)]/40 transition-colors"
                                >
                                    {/* Rank */}
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${index === 0 ? 'bg-[var(--sidebar-accent)] text-[var(--sidebar-accent-foreground)]' :
                                        index === 1 ? 'bg-stone-400 text-stone-950' :
                                            index === 2 ? 'bg-amber-800 text-amber-100' :
                                                'bg-[var(--background)] text-[var(--panel-foreground)] border border-[var(--panel-border)]'
                                        }`}>
                                        {index + 1}
                                    </div>

                                    {/* User Info */}
                                    <div className="flex-1">
                                        <Link
                                            href={`/profile/${entry.userId}`}
                                            className="font-medium text-[var(--foreground)] hover:text-[var(--sidebar-accent)] transition-colors"
                                        >
                                            {entry.userName || `Detective #${entry.userId.slice(0, 8)}`}
                                        </Link>
                                        <p className="text-xs text-[var(--panel-foreground)]/60">{entry.boardsCreated} cases solved</p>
                                    </div>

                                    {/* Points */}
                                    <div className="text-right">
                                        <p className="text-2xl font-bold text-[var(--sidebar-accent)]">{entry.points}</p>
                                        <p className="text-xs text-[var(--panel-foreground)]/60">points</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Info */}
                <div className="mt-6 p-4 bg-[var(--panel-background)]/30 border border-[var(--panel-border)] rounded-lg">
                    <p className="text-sm text-[var(--panel-foreground)]/70">
                        💡 <strong className="text-[var(--foreground)]">Earn reputation</strong> by creating boards, getting views, and receiving upvotes.
                    </p>
                </div>
            </div>
        </div>
    );
}
