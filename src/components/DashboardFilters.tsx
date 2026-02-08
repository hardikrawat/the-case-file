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
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest transition-all ${isOpen || filterBy !== 'all' || sortBy !== 'updated'
                    ? 'bg-[var(--sidebar-accent)] text-[var(--sidebar-accent-foreground)] shadow-lg shadow-[var(--sidebar-accent)]/20'
                    : 'bg-[var(--sidebar-background)] border border-[var(--sidebar-accent)]/20 text-[var(--sidebar-foreground)] hover:border-[var(--sidebar-accent)]/50'
                    }`}
            >
                <Filter className="w-3.5 h-3.5" />
                Filters
                {(filterBy !== 'all' || sortBy !== 'updated') && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--sidebar-accent-foreground)]" />
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
                    <div className="absolute top-full right-0 mt-2 w-72 bg-[var(--panel-background)] border border-[var(--panel-border)] rounded-xl shadow-2xl overflow-hidden z-20 animate-in fade-in slide-in-from-top-2 duration-200">
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-[var(--panel-border)]/50 bg-[var(--background)]/50">
                            <h3 className="text-[10px] font-bold text-[var(--panel-foreground)]/60 uppercase tracking-[0.2em] flex items-center gap-2">
                                <Filter className="w-3 h-3 text-[var(--sidebar-accent)]" />
                                Filters & Sort
                            </h3>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="text-[var(--panel-foreground)]/40 hover:text-[var(--sidebar-accent)] transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Sort Options */}
                        <div className="p-4 border-b border-[var(--panel-border)]/50">
                            <label className="block text-[9px] font-bold text-[var(--panel-foreground)]/40 uppercase tracking-widest mb-3">
                                Sort By
                            </label>
                            <div className="space-y-1">
                                {[
                                    { id: 'updated', label: 'Last Updated', icon: Calendar },
                                    { id: 'created', label: 'Date Created', icon: Calendar },
                                    { id: 'name', label: 'Name', icon: null, mono: 'Az' }
                                ].map((opt) => (
                                    <button
                                        key={opt.id}
                                        onClick={() => onSortChange(opt.id as SortOption)}
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left group ${sortBy === opt.id
                                            ? 'bg-[var(--sidebar-accent)]/10 text-[var(--sidebar-accent)] border border-[var(--sidebar-accent)]/20'
                                            : 'text-[var(--panel-foreground)]/70 hover:bg-[var(--background)]'
                                            }`}
                                    >
                                        {opt.icon ? <opt.icon className="w-4 h-4 opacity-50 group-hover:opacity-100" /> : <span className="text-sm font-mono opacity-50 group-hover:opacity-100">{opt.mono}</span>}
                                        <span className="text-xs font-bold">{opt.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Filter Options */}
                        <div className="p-4 bg-[var(--background)]/20">
                            <label className="block text-[9px] font-bold text-[var(--panel-foreground)]/40 uppercase tracking-widest mb-3">
                                Show
                            </label>
                            <div className="space-y-1">
                                {[
                                    { id: 'all', label: 'All Investigations', icon: null },
                                    { id: 'public', label: 'Public Access', icon: Eye },
                                    { id: 'private', label: 'Classified Only', icon: Lock }
                                ].map((opt) => (
                                    <button
                                        key={opt.id}
                                        onClick={() => onFilterChange(opt.id as FilterOption)}
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left group ${filterBy === opt.id
                                            ? 'bg-[var(--sidebar-accent)]/10 text-[var(--sidebar-accent)] border border-[var(--sidebar-accent)]/20'
                                            : 'text-[var(--panel-foreground)]/70 hover:bg-[var(--background)]'
                                            }`}
                                    >
                                        {opt.icon && <opt.icon className="w-4 h-4 opacity-50 group-hover:opacity-100" />}
                                        <span className="text-xs font-bold">{opt.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Reset */}
                        {(filterBy !== 'all' || sortBy !== 'updated') && (
                            <div className="p-3 border-t border-[var(--panel-border)]/50 bg-[var(--background)]/50">
                                <button
                                    onClick={() => {
                                        onSortChange('updated');
                                        onFilterChange('all');
                                    }}
                                    className="w-full py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--panel-foreground)]/40 hover:text-[var(--sidebar-accent)] transition-colors"
                                >
                                    Reset to Bureau Defaults
                                </button>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
