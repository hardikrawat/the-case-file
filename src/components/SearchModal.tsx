'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

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
    const router = useRouter();
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
            <div className="relative w-full max-w-2xl bg-stone-900 border border-stone-700 rounded-xl shadow-2xl overflow-hidden">
                {/* Search Input */}
                <div className="p-4 border-b border-stone-800">
                    <div className="relative">
                        <svg
                            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-500"
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
                            className="w-full pl-10 pr-4 py-3 bg-stone-800 border border-stone-700 rounded-lg text-stone-200 placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-transparent"
                        />
                        {isLoading && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                            </div>
                        )}
                    </div>
                </div>

                {/* Results */}
                <div className="max-h-96 overflow-y-auto p-4">
                    {!query && (
                        <div className="text-center py-12 text-stone-500">
                            <p>Start typing to search...</p>
                        </div>
                    )}

                    {query && query.length < 2 && (
                        <div className="text-center py-12 text-stone-500">
                            <p>Type at least 2 characters</p>
                        </div>
                    )}

                    {results && (
                        <div className="space-y-6">
                            {/* Boards */}
                            {results.boards.length > 0 && (
                                <div>
                                    <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">
                                        Boards ({results.boards.length})
                                    </h3>
                                    <div className="space-y-2">
                                        {results.boards.map((board) => (
                                            <Link
                                                key={board.id}
                                                href={`/board/${board.id}`}
                                                onClick={onClose}
                                                className="block p-3 rounded-lg bg-stone-800/50 hover:bg-stone-800 border border-stone-700/50 hover:border-amber-900/50 transition-all duration-200"
                                            >
                                                <div className="flex items-center gap-3">
                                                    {board.thumbnail ? (
                                                        <img
                                                            src={board.thumbnail}
                                                            alt={board.title}
                                                            className="w-12 h-12 rounded object-cover bg-stone-700"
                                                        />
                                                    ) : (
                                                        <div className="w-12 h-12 rounded bg-stone-700 flex items-center justify-center">
                                                            <svg className="w-6 h-6 text-stone-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                            </svg>
                                                        </div>
                                                    )}
                                                    <div className="flex-1">
                                                        <p className="font-medium text-stone-200">{board.title}</p>
                                                        {board.userName && (
                                                            <p className="text-xs text-stone-500">by {board.userName}</p>
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
                                    <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">
                                        Users ({results.users.length})
                                    </h3>
                                    <div className="space-y-2">
                                        {results.users.map((user) => (
                                            <Link
                                                key={user.id}
                                                href={`/profile/${user.id}`}
                                                onClick={onClose}
                                                className="block p-3 rounded-lg bg-stone-800/50 hover:bg-stone-800 border border-stone-700/50 hover:border-amber-900/50 transition-all duration-200"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-600 to-amber-500 flex items-center justify-center text-stone-950 font-bold">
                                                        {(user.name || user.email)[0].toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-stone-200">{user.name || 'Anonymous'}</p>
                                                        <p className="text-xs text-stone-500">{user.email}</p>
                                                    </div>
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* No results */}
                            {results.boards.length === 0 && results.users.length === 0 && (
                                <div className="text-center py-12 text-stone-500">
                                    <p>No results found for "{query}"</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
