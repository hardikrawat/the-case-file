'use client';

import { useState } from 'react';
import { X, History, Clock } from 'lucide-react';

interface Version {
    id: string;
    content: string;
    createdAt: Date;
    createdBy: string;
}

interface VersionHistoryProps {
    boardId: string;
    onRestore?: (content: string) => void;
}

export function VersionHistory({ boardId, onRestore }: VersionHistoryProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [versions, setVersions] = useState<Version[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedVersion, setSelectedVersion] = useState<Version | null>(null);

    const loadVersions = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/boards/${boardId}/versions`);
            const data = await response.json();
            setVersions(data);
        } catch (error) {
            console.error('Failed to load versions:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRestore = (version: Version) => {
        if (confirm('Restore this version? Current changes will be lost.')) {
            onRestore?.(version.content);
            setIsOpen(false);
        }
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => {
                    setIsOpen(true);
                    loadVersions();
                }}
                className="fixed bottom-24 right-6 bg-stone-800 hover:bg-stone-700 text-stone-200 px-4 py-2 rounded-full shadow-lg font-medium transition-colors border border-stone-700 flex items-center gap-2"
                title="Version History"
            >
                <History className="w-4 h-4" />
                History
            </button>
        );
    }

    return (
        <div className="fixed inset-y-0 right-0 w-96 bg-stone-900 border-l border-stone-700 shadow-2xl overflow-hidden flex flex-col z-50">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-stone-800 bg-stone-900/50">
                <div className="flex items-center gap-2">
                    <History className="w-5 h-5 text-amber-500" />
                    <h3 className="font-semibold text-stone-200">Version History</h3>
                </div>
                <button
                    onClick={() => setIsOpen(false)}
                    className="text-stone-400 hover:text-stone-200 transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Versions List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-stone-950/50">
                {isLoading ? (
                    <p className="text-center text-stone-500 py-8">Loading versions...</p>
                ) : versions.length === 0 ? (
                    <div className="text-center py-12">
                        <Clock className="w-12 h-12 text-stone-700 mx-auto mb-3" />
                        <p className="text-stone-500 text-sm">No version history yet</p>
                        <p className="text-stone-600 text-xs mt-1">Versions are saved automatically</p>
                    </div>
                ) : (
                    versions.map((version, index) => (
                        <div
                            key={version.id}
                            className={`p-3 rounded-lg border transition-all cursor-pointer ${selectedVersion?.id === version.id
                                    ? 'bg-amber-500/10 border-amber-500/50'
                                    : 'bg-stone-800/50 border-stone-700 hover:border-stone-600'
                                }`}
                            onClick={() => setSelectedVersion(version)}
                        >
                            <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-mono text-stone-400">
                                        #{versions.length - index}
                                    </span>
                                    {index === 0 && (
                                        <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded">
                                            Latest
                                        </span>
                                    )}
                                </div>
                                <span className="text-xs text-stone-500">
                                    {new Date(version.createdAt).toLocaleString()}
                                </span>
                            </div>

                            {selectedVersion?.id === version.id && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleRestore(version);
                                    }}
                                    className="w-full mt-2 py-1.5 px-3 bg-amber-600 hover:bg-amber-500 text-stone-950 text-sm font-medium rounded transition-colors"
                                >
                                    Restore This Version
                                </button>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Info Footer */}
            <div className="p-3 border-t border-stone-800 bg-stone-900">
                <p className="text-xs text-stone-500">
                    💡 Versions are created automatically when you save changes
                </p>
            </div>
        </div>
    );
}
