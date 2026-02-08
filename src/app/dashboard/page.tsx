"use client";

import { useState, useEffect, useMemo } from "react";
import { Plus } from "lucide-react";
import { NewBoardModal } from "@/components/dashboard/NewBoardModal";
import { DashboardFilters, SortOption, FilterOption } from "@/components/DashboardFilters";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
    const { data: session, status } = useSession();
    const router = useRouter();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [boards, setBoards] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [sortBy, setSortBy] = useState<SortOption>('updated');
    const [filterBy, setFilterBy] = useState<FilterOption>('all');

    // Redirect if not authenticated
    useEffect(() => {
        if (status === "unauthenticated") {
            router.push('/login');
        }
    }, [status, router]);

    useEffect(() => {
        fetch('/api/boards')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    setBoards(data);
                }
            })
            .catch(err => console.error(err))
            .finally(() => setLoading(false));
    }, [isModalOpen]); // Refresh when modal closes (new board created)

    // Filter and sort boards
    const filteredAndSortedBoards = useMemo(() => {
        let result = [...boards];

        // Apply filter
        if (filterBy === 'public') {
            result = result.filter(b => b.isPublic);
        } else if (filterBy === 'private') {
            result = result.filter(b => !b.isPublic);
        }

        // Apply sort
        result.sort((a, b) => {
            if (sortBy === 'updated') {
                return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
            } else if (sortBy === 'created') {
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            } else if (sortBy === 'name') {
                return (a.title || '').localeCompare(b.title || '');
            }
            return 0;
        });

        return result;
    }, [boards, filterBy, sortBy]);

    // Show loading state while checking authentication
    if (status === "loading") {
        return (
            <div className="flex items-center justify-center h-screen bg-stone-950">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto mb-4"></div>
                    <p className="text-stone-400">Loading...</p>
                </div>
            </div>
        );
    }

    // Don't render if not authenticated (will redirect)
    if (!session) {
        return null;
    }

    return (
        <div className="p-8">
            <NewBoardModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />

            <header className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-3xl font-bold font-serif text-stone-100">My Cases</h2>
                    <p className="text-stone-400 mt-1">
                        {filteredAndSortedBoards.length} {filteredAndSortedBoards.length === 1 ? 'case' : 'cases'}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <DashboardFilters
                        sortBy={sortBy}
                        filterBy={filterBy}
                        onSortChange={setSortBy}
                        onFilterChange={setFilterBy}
                    />
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-lg shadow-amber-900/20"
                    >
                        <Plus className="w-5 h-5" />
                        New Case
                    </button>
                </div>
            </header>

            {loading ? (
                <div className="text-stone-500 animate-pulse">Loading cases...</div>
            ) : filteredAndSortedBoards.length === 0 ? (
                <div className="text-center py-20 bg-stone-900/30 rounded-xl border border-stone-800 border-dashed">
                    <p className="text-stone-500 mb-4">
                        {boards.length === 0 ? 'No cases found.' : 'No cases match your filters.'}
                    </p>
                    <button
                        onClick={() => {
                            if (boards.length === 0) {
                                setIsModalOpen(true);
                            } else {
                                setSortBy('updated');
                                setFilterBy('all');
                            }
                        }}
                        className="text-amber-500 hover:text-amber-400 font-bold"
                    >
                        {boards.length === 0 ? 'Create your first case' : 'Reset filters'}
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredAndSortedBoards.map((board) => (
                        <Link
                            key={board.id}
                            href={`/board/${board.id}`}
                            className="group relative aspect-video bg-stone-900 rounded-xl border border-stone-800 overflow-hidden hover:border-amber-500/50 transition-colors cursor-pointer block"
                        >
                            {/* Thumbnail or fallback */}
                            {board.thumbnail ? (
                                <img
                                    src={board.thumbnail}
                                    alt={board.title}
                                    className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity"
                                />
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <svg className="w-20 h-20 text-stone-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                </div>
                            )}

                            {/* Privacy badge */}
                            <div className="absolute top-3 right-3">
                                <span className={`text-xs px-2 py-1 rounded ${board.isPublic
                                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                    : 'bg-stone-700/80 text-stone-300 border border-stone-600'
                                    }`}>
                                    {board.isPublic ? 'Public' : 'Private'}
                                </span>
                            </div>

                            {/* Gradient overlay */}
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-4 pt-12">
                                <h3 className="text-lg font-bold text-stone-200 group-hover:text-amber-500 transition-colors">
                                    {board.title}
                                </h3>
                                <p className="text-xs text-stone-400 mt-1">Last updated {new Date(board.updatedAt).toLocaleDateString()}</p>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>

    );
}
