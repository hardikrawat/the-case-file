"use client";

import { useState, useEffect, useMemo } from "react";
import { Plus } from "lucide-react";
import { NewBoardModal } from "@/components/dashboard/NewBoardModal";
import { DashboardFilters, SortOption, FilterOption } from "@/components/DashboardFilters";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Board } from "@/lib/types";
import BoardCard from "@/components/dashboard/BoardCard";
import DashboardLoading from "@/components/dashboard/DashboardLoading";

export default function DashboardPage() {
    const { data: session, status } = useSession();
    const router = useRouter();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [boards, setBoards] = useState<Board[]>([]);
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
                const dateB = new Date((b.updatedAt as string | number | Date) || 0).getTime();
                const dateA = new Date((a.updatedAt as string | number | Date) || 0).getTime();
                return dateB - dateA;
            } else if (sortBy === 'created') {
                const dateB = new Date((b.createdAt as string | number | Date) || 0).getTime();
                const dateA = new Date((a.createdAt as string | number | Date) || 0).getTime();
                return dateB - dateA;
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
            <DashboardLoading status="Authenticating Detective..." />
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
                    <h2 className="text-3xl font-bold font-serif text-[var(--foreground)]">My Cases</h2>
                    <p className="text-[var(--panel-foreground)]/60 mt-1">
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
                        className="flex items-center gap-2 bg-[var(--sidebar-accent)] hover:bg-[var(--sidebar-accent)]/90 text-[var(--sidebar-accent-foreground)] px-4 py-2 rounded-lg font-medium transition-colors shadow-lg shadow-[var(--sidebar-accent)]/20"
                    >
                        <Plus className="w-5 h-5" />
                        New Case
                    </button>
                </div>
            </header>

            {loading ? (
                <DashboardLoading status="Retrieving Case Files..." />
            ) : filteredAndSortedBoards.length === 0 ? (
                <div className="text-center py-20 bg-[var(--panel-background)]/30 rounded-xl border border-[var(--panel-border)] border-dashed">
                    <p className="text-[var(--panel-foreground)]/60 mb-4">
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
                        className="text-[var(--sidebar-accent)] hover:underline font-bold"
                    >
                        {boards.length === 0 ? 'Create your first case' : 'Reset filters'}
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredAndSortedBoards.map((board) => (
                        <BoardCard key={board.id} board={board} />
                    ))}
                </div>
            )}
        </div>

    );
}
