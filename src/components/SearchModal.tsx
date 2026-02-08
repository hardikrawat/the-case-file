'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';


interface SearchResult {
    boards: Array<{
        id: string;
        title: string;
        userName: string | null;
        thumbnail: string | null;
    }>;
    users: Array<{
        id: string;
        name: string | null;
        email: string;
    }>;
}

export default function SearchModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const performSearch = useCallback(async (searchQuery: string) => {
        if (searchQuery.length < 2) {
            setResults(null);
            return;
        }

        setIsLoading(true);
        try {
            const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
            const data = await response.json();

            if (response.ok) {
                setResults(data);
            }
        } catch (error) {
            console.error('Search failed:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!isOpen) {
            setQuery('');
            setResults(null);
            return;
        }

        // Focus input when modal opens
        inputRef.current?.focus();

        const debounce = setTimeout(() => {
            performSearch(query);
        }, 300);

        return () => clearTimeout(debounce);
    }, [query, isOpen, performSearch]);

    // Handle escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-2xl bg-[var(--panel-background)] border border-[var(--panel-border)] rounded-xl shadow-2xl overflow-hidden transition-colors duration-500">
                {/* Search Input */}
                <div className="p-4 border-b border-[var(--panel-border)]/50">
                    <div className="relative">
                        <svg
                            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--panel-foreground)]/40"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                            />
                        </svg>
                        <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search boards, users..."
                            className="w-full pl-10 pr-4 py-3 bg-[var(--background)] border border-[var(--panel-border)] rounded-lg text-[var(--foreground)] placeholder-[var(--panel-foreground)]/40 focus:outline-none focus:ring-2 focus:ring-[var(--sidebar-accent)]/50 focus:border-transparent transition-all"
                        />
                        {isLoading && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                <div className="w-5 h-5 border-2 border-[var(--sidebar-accent)] border-t-transparent rounded-full animate-spin" />
                            </div>
                        )}
                    </div>
                </div>

                {/* Results */}
                <div className="max-h-96 overflow-y-auto p-4 custom-scrollbar">
                    {!query && (
                        <div className="text-center py-12 text-[var(--panel-foreground)]/40">
                            <p className="font-medium tracking-wide">Start typing to search...</p>
                        </div>
                    )}

                    {query && query.length < 2 && (
                        <div className="text-center py-12 text-[var(--panel-foreground)]/40">
                            <p className="font-medium tracking-wide">Type at least 2 characters</p>
                        </div>
                    )}

                    {results && (
                        <div className="space-y-6">
                            {/* Boards */}
                            {results.boards.length > 0 && (
                                <div>
                                    <h3 className="text-[10px] font-bold text-[var(--panel-foreground)]/50 uppercase tracking-[0.2em] mb-3 ml-1">
                                        Case Files ({results.boards.length})
                                    </h3>
                                    <div className="space-y-2">
                                        {results.boards.map((board) => (
                                            <Link
                                                key={board.id}
                                                href={`/board/${board.id}`}
                                                onClick={onClose}
                                                className="group block p-3 rounded-lg bg-[var(--background)]/50 border border-[var(--panel-border)]/50 hover:bg-[var(--background)] hover:border-[var(--sidebar-accent)]/50 transition-all duration-300"
                                            >
                                                <div className="flex items-center gap-4">
                                                    {board.thumbnail ? (
                                                        <div className="relative w-14 h-14 rounded overflow-hidden bg-[var(--panel-background)] border border-[var(--panel-border)]">
                                                            <Image
                                                                src={board.thumbnail}
                                                                alt={board.title}
                                                                fill
                                                                className="object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                                                                unoptimized
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div className="w-14 h-14 rounded bg-[var(--panel-background)] border border-[var(--panel-border)] flex items-center justify-center">
                                                            <svg className="w-6 h-6 text-[var(--panel-foreground)]/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                            </svg>
                                                        </div>
                                                    )}
                                                    <div className="flex-1">
                                                        <p className="font-bold text-[var(--foreground)] font-serif group-hover:text-[var(--sidebar-accent)] transition-colors">{board.title}</p>
                                                        {board.userName && (
                                                            <div className="flex items-center gap-1.5 mt-1">
                                                                <span className="text-[10px] font-bold text-[var(--panel-foreground)]/40 uppercase tracking-tighter">Investigator:</span>
                                                                <span className="text-xs text-[var(--panel-foreground)]/60">{board.userName}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Users */}
                            {results.users.length > 0 && (
                                <div>
                                    <h3 className="text-[10px] font-bold text-[var(--panel-foreground)]/50 uppercase tracking-[0.2em] mb-3 ml-1">
                                        Bureau Agents ({results.users.length})
                                    </h3>
                                    <div className="space-y-2">
                                        {results.users.map((user) => (
                                            <Link
                                                key={user.id}
                                                href={`/profile/${user.id}`}
                                                onClick={onClose}
                                                className="group block p-3 rounded-lg bg-[var(--background)]/50 border border-[var(--panel-border)]/50 hover:bg-[var(--background)] hover:border-[var(--sidebar-accent)]/50 transition-all duration-300"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 rounded-full bg-[var(--sidebar-accent)] flex items-center justify-center text-[var(--sidebar-accent-foreground)] font-black text-lg shadow-lg">
                                                        {(user.name || user.email)[0].toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-[var(--foreground)] group-hover:text-[var(--sidebar-accent)] transition-colors">{user.name || 'Anonymous'}</p>
                                                        <p className="text-[10px] font-mono text-[var(--panel-foreground)]/40 uppercase tracking-tighter">{user.email}</p>
                                                    </div>
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* No results */}
                            {results.boards.length === 0 && results.users.length === 0 && (
                                <div className="text-center py-12 text-[var(--panel-foreground)]/40">
                                    <p className="font-medium">No intel found for &quot;{query}&quot;</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
