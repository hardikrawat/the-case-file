'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface LeaderboardEntry {
    userId: string;
    points: number;
    boardsCreated: number;
    lastActive: Date | null;
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
        <div className="min-h-screen bg-gradient-to-br from-stone-950 via-stone-900 to-amber-950 p-8">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <Link href="/cases" className="text-amber-500 hover:text-amber-400 text-sm mb-4 inline-block">
                        ← Back to Dashboard
                    </Link>
                    <h1 className="text-4xl font-bold text-amber-500 font-serif mb-2">Leaderboard</h1>
                    <p className="text-stone-400">Top detectives by reputation</p>
                </div>

                {/* Leaderboard */}
                <div className="bg-stone-900/50 backdrop-blur-sm border border-stone-800 rounded-xl overflow-hidden">
                    {isLoading ? (
                        <p className="text-center text-stone-500 py-12">Loading...</p>
                    ) : leaders.length === 0 ? (
                        <p className="text-center text-stone-500 py-12">No data yet. Start solving cases!</p>
                    ) : (
                        <div className="divide-y divide-stone-800">
                            {leaders.map((entry, index) => (
                                <div
                                    key={entry.userId}
                                    className="flex items-center gap-4 p-4 hover:bg-stone-800/30 transition-colors"
                                >
                                    {/* Rank */}
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${index === 0 ? 'bg-yellow-500 text-stone-950' :
                                        index === 1 ? 'bg-gray-400 text-stone-950' :
                                            index === 2 ? 'bg-amber-700 text-stone-200' :
                                                'bg-stone-700 text-stone-300'
                                        }`}>
                                        {index + 1}
                                    </div>

                                    {/* User Info */}
                                    <div className="flex-1">
                                        <Link
                                            href={`/profile/${entry.userId}`}
                                            className="font-medium text-stone-200 hover:text-amber-500 transition-colors"
                                        >
                                            Detective #{entry.userId.slice(0, 8)}
                                        </Link>
                                        <p className="text-xs text-stone-500">{entry.boardsCreated} cases solved</p>
                                    </div>

                                    {/* Points */}
                                    <div className="text-right">
                                        <p className="text-2xl font-bold text-amber-500">{entry.points}</p>
                                        <p className="text-xs text-stone-400">points</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Info */}
                <div className="mt-6 p-4 bg-stone-900/30 border border-stone-800 rounded-lg">
                    <p className="text-sm text-stone-400">
                        💡 <strong className="text-stone-300">Earn reputation</strong> by creating boards, getting views, and receiving upvotes.
                    </p>
                </div>
            </div>
        </div>
    );
}
