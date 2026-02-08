'use client';

import { useState } from 'react';
import { Filter, X, Calendar, Eye, Lock } from 'lucide-react';

export type SortOption = 'updated' | 'created' | 'name';
export type FilterOption = 'all' | 'public' | 'private';

interface DashboardFiltersProps {
    sortBy: SortOption;
    filterBy: FilterOption;
    onSortChange: (sort: SortOption) => void;
    onFilterChange: (filter: FilterOption) => void;
}

export function DashboardFilters({ sortBy, filterBy, onSortChange, onFilterChange }: DashboardFiltersProps) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="relative">
            {/* Filter Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${isOpen || filterBy !== 'all' || sortBy !== 'updated'
                        ? 'bg-amber-600 text-stone-950 shadow-lg shadow-amber-900/20'
                        : 'bg-stone-800 border border-stone-700 text-stone-200 hover:bg-stone-700'
                    }`}
            >
                <Filter className="w-4 h-4" />
                Filters
                {(filterBy !== 'all' || sortBy !== 'updated') && (
                    <span className="w-2 h-2 rounded-full bg-stone-950" />
                )}
            </button>

            {/* Dropdown Panel */}
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-10"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Panel */}
                    <div className="absolute top-full right-0 mt-2 w-72 bg-stone-900 border border-stone-700 rounded-xl shadow-2xl overflow-hidden z-20">
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-stone-800">
                            <h3 className="font-semibold text-stone-200">Filters & Sort</h3>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="text-stone-400 hover:text-stone-200 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Sort Options */}
                        <div className="p-4 border-b border-stone-800">
                            <label className="block text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">
                                Sort By
                            </label>
                            <div className="space-y-1">
                                <button
                                    onClick={() => onSortChange('updated')}
                                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-left ${sortBy === 'updated'
                                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                                            : 'text-stone-300 hover:bg-stone-800'
                                        }`}
                                >
                                    <Calendar className="w-4 h-4" />
                                    <span className="text-sm">Last Updated</span>
                                </button>
                                <button
                                    onClick={() => onSortChange('created')}
                                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-left ${sortBy === 'created'
                                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                                            : 'text-stone-300 hover:bg-stone-800'
                                        }`}
                                >
                                    <Calendar className="w-4 h-4" />
                                    <span className="text-sm">Date Created</span>
                                </button>
                                <button
                                    onClick={() => onSortChange('name')}
                                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-left ${sortBy === 'name'
                                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                                            : 'text-stone-300 hover:bg-stone-800'
                                        }`}
                                >
                                    <span className="text-sm font-mono">Az</span>
                                    <span className="text-sm">Name</span>
                                </button>
                            </div>
                        </div>

                        {/* Filter Options */}
                        <div className="p-4">
                            <label className="block text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">
                                Show
                            </label>
                            <div className="space-y-1">
                                <button
                                    onClick={() => onFilterChange('all')}
                                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-left ${filterBy === 'all'
                                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                                            : 'text-stone-300 hover:bg-stone-800'
                                        }`}
                                >
                                    <span className="text-sm">All Cases</span>
                                </button>
                                <button
                                    onClick={() => onFilterChange('public')}
                                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-left ${filterBy === 'public'
                                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                                            : 'text-stone-300 hover:bg-stone-800'
                                        }`}
                                >
                                    <Eye className="w-4 h-4" />
                                    <span className="text-sm">Public Only</span>
                                </button>
                                <button
                                    onClick={() => onFilterChange('private')}
                                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-left ${filterBy === 'private'
                                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                                            : 'text-stone-300 hover:bg-stone-800'
                                        }`}
                                >
                                    <Lock className="w-4 h-4" />
                                    <span className="text-sm">Private Only</span>
                                </button>
                            </div>
                        </div>

                        {/* Reset */}
                        {(filterBy !== 'all' || sortBy !== 'updated') && (
                            <div className="p-4 border-t border-stone-800">
                                <button
                                    onClick={() => {
                                        onSortChange('updated');
                                        onFilterChange('all');
                                    }}
                                    className="w-full py-2 text-sm text-stone-400 hover:text-amber-400 transition-colors"
                                >
                                    Reset to defaults
                                </button>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
