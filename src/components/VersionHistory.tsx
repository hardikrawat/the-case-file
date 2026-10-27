'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Image from 'next/image';
import { 
    X, 
    History, 
    Clock, 
    RotateCcw, 
    Camera, 
    Check, 
    AlertTriangle, 
    User, 
    Search, 
    ChevronDown, 
    ChevronUp, 
    Undo2,
    StickyNote,
    Image as ImageIcon,
    ExternalLink,
    Newspaper,
    Type
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import AppleSpinner from '@/components/ui/AppleSpinner';
import { toast } from 'sonner';
import useStore, { RFState } from '@/store/useStore';

interface Version {
    id: string;
    boardId: string;
    content: Record<string, unknown> | string;
    createdAt: Date | string | number;
    createdBy: string;
    creatorName?: string | null;
    creatorImage?: string | null;
    notes?: string | null;
    isManual?: boolean;
}

interface VersionHistoryProps {
    boardId: string;
    isOpen?: boolean;
    onClose?: () => void;
    onRestore?: (content: Record<string, unknown> | string) => Promise<void> | void;
    isReadOnly?: boolean;
}

export function VersionHistory({ boardId, isOpen = false, onClose, onRestore, isReadOnly = false }: VersionHistoryProps) {
    const [versions, setVersions] = useState<Version[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedVersion, setSelectedVersion] = useState<Version | null>(null);
    const [expandedBreakdownId, setExpandedBreakdownId] = useState<string | null>(null);
    const [isRestoring, setIsRestoring] = useState(false);
    const [confirmingVersion, setConfirmingVersion] = useState<Version | null>(null);
    const [isCreatingSnapshot, setIsCreatingSnapshot] = useState(false);
    const [snapshotName, setSnapshotName] = useState('');
    const [showCreateInput, setShowCreateInput] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    
    // Track previous state before last rollback to offer in-panel Undo Rollback
    const [lastRollbackBackup, setLastRollbackBackup] = useState<{ nodes: unknown[]; edges: unknown[] } | null>(null);

    // Reactive store selectors for live canvas comparison
    const liveNodes = useStore((state: RFState) => state.nodes);
    const liveEdges = useStore((state: RFState) => state.edges);

    const panelRef = useRef<HTMLDivElement>(null);

    const loadVersions = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/boards/${boardId}/versions?limit=50`);
            if (response.ok) {
                const data = await response.json();
                setVersions(Array.isArray(data) ? data : []);
            } else {
                toast.error('Failed to load version history');
            }
        } catch (error) {
            console.error('Failed to load versions:', error);
            toast.error('Failed to load version history');
        } finally {
            setIsLoading(false);
        }
    }, [boardId]);

    useEffect(() => {
        if (isOpen) {
            loadVersions();
        } else {
            setConfirmingVersion(null);
            setShowCreateInput(false);
            setSnapshotName('');
            setSearchQuery('');
        }
    }, [isOpen, loadVersions]);

    // Keyboard navigation (Escape to close or cancel confirmation)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;
            if (e.key === 'Escape') {
                if (confirmingVersion) {
                    setConfirmingVersion(null);
                } else {
                    onClose?.();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, confirmingVersion, onClose]);

    const handleCreateSnapshot = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isReadOnly || isCreatingSnapshot) return;

        setIsCreatingSnapshot(true);
        try {
            const state = useStore.getState();
            const content = {
                nodes: state.nodes,
                edges: state.edges,
            };

            const res = await fetch(`/api/boards/${boardId}/versions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content,
                    notes: snapshotName.trim() || undefined,
                    isManual: true,
                }),
            });

            if (res.ok) {
                toast.success('Milestone snapshot captured!');
                setSnapshotName('');
                setShowCreateInput(false);
                await loadVersions();
            } else {
                const err = await res.json().catch(() => ({}));
                toast.error(err.error || 'Failed to create snapshot');
            }
        } catch (err) {
            console.error('Snapshot error:', err);
            toast.error('Error creating snapshot');
        } finally {
            setIsCreatingSnapshot(false);
        }
    };

    const executeRestore = async (version: Version) => {
        if (isRestoring || isReadOnly) return;
        setIsRestoring(true);
        try {
            // Save current live state as in-panel undo backup
            setLastRollbackBackup({
                nodes: [...liveNodes],
                edges: [...liveEdges],
            });

            if (onRestore) {
                await onRestore(version.content);
            }
            setConfirmingVersion(null);
            await loadVersions();
        } catch (err) {
            console.error('Restore error:', err);
            toast.error('Failed to restore snapshot');
        } finally {
            setIsRestoring(false);
        }
    };

    const handleUndoRollback = async () => {
        if (!lastRollbackBackup || isRestoring || isReadOnly) return;
        setIsRestoring(true);
        try {
            if (onRestore) {
                await onRestore(lastRollbackBackup as unknown as Record<string, unknown>);
            }
            setLastRollbackBackup(null);
            toast.success('Rollback undone — previous investigation state restored');
            await loadVersions();
        } catch (err) {
            console.error('Undo rollback error:', err);
            toast.error('Failed to undo rollback');
        } finally {
            setIsRestoring(false);
        }
    };

    // Helper to safely parse and summarize version content
    const parseContent = useCallback((content: Record<string, unknown> | string) => {
        try {
            const obj = typeof content === 'string' ? JSON.parse(content) : content;
            const nodes = Array.isArray(obj?.nodes) ? obj.nodes : [];
            const edges = Array.isArray(obj?.edges) ? obj.edges : [];
            return { nodes, edges };
        } catch {
            return { nodes: [], edges: [] };
        }
    }, []);

    const formatRelativeTime = (dateInput: Date | string | number) => {
        try {
            const d = new Date(dateInput);
            if (isNaN(d.getTime())) return 'Recently';
            return formatDistanceToNow(d, { addSuffix: true });
        } catch {
            return 'Recently';
        }
    };

    // Filtered versions based on search query
    const filteredVersions = useMemo(() => {
        if (!searchQuery.trim()) return versions;
        const q = searchQuery.toLowerCase();
        return versions.filter((v) => {
            const matchesNotes = v.notes?.toLowerCase().includes(q);
            const matchesCreator = v.creatorName?.toLowerCase().includes(q);
            return matchesNotes || matchesCreator;
        });
    }, [versions, searchQuery]);

    const selectedDetails = useMemo(() => {
        if (!selectedVersion) return null;
        return parseContent(selectedVersion.content);
    }, [selectedVersion, parseContent]);

    if (!isOpen) return null;

    return (
        <div
            ref={panelRef}
            data-testid="version-history-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Investigation Vault & Revision History"
            className="fixed inset-y-0 right-0 w-96 max-w-[calc(100vw-1rem)] bg-[var(--panel-background)] border-l border-[var(--panel-border)] shadow-2xl overflow-hidden flex flex-col z-50 text-[var(--panel-foreground)] transition-colors duration-300"
        >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[var(--panel-border)] bg-[var(--background)]/60">
                <div className="flex items-center gap-2">
                    <History className="w-5 h-5 text-[var(--sidebar-accent)]" />
                    <div>
                        <h3 className="font-semibold text-sm text-[var(--foreground)]">Investigation Vault</h3>
                        <p className="text-[10px] font-mono text-[var(--panel-foreground)]/50">Revision & Milestone History</p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="text-[var(--panel-foreground)]/60 hover:text-[var(--foreground)] transition-colors p-1.5 rounded-lg hover:bg-[var(--background)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--sidebar-accent)]"
                    title="Close Version History"
                    aria-label="Close Version History"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* In-Panel Undo Rollback Bar (if a rollback just occurred) */}
            {lastRollbackBackup && !isReadOnly && (
                <div className="p-2.5 px-3 bg-amber-950/50 border-b border-amber-600/40 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs text-amber-300">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="truncate">Rollback active. Safety backup kept.</span>
                    </div>
                    <button
                        onClick={handleUndoRollback}
                        disabled={isRestoring}
                        className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-stone-950 text-xs font-bold rounded flex items-center gap-1 transition-colors shrink-0 shadow-sm"
                    >
                        <Undo2 className="w-3 h-3" />
                        <span>Undo</span>
                    </button>
                </div>
            )}

            {/* Manual Snapshot Trigger */}
            {!isReadOnly && (
                <div className="p-3 border-b border-[var(--panel-border)] bg-[var(--background)]/30">
                    {!showCreateInput ? (
                        <button
                            onClick={() => setShowCreateInput(true)}
                            className="w-full py-1.5 px-3 bg-[var(--sidebar-accent)]/15 hover:bg-[var(--sidebar-accent)]/25 text-[var(--sidebar-accent)] border border-[var(--sidebar-accent)]/30 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--sidebar-accent)]"
                        >
                            <Camera className="w-3.5 h-3.5" />
                            <span>Capture Evidence Milestone</span>
                        </button>
                    ) : (
                        <form onSubmit={handleCreateSnapshot} className="space-y-2 animate-in fade-in duration-200">
                            <label htmlFor="milestone-notes-input" className="sr-only">
                                Milestone notes
                            </label>
                            <input
                                id="milestone-notes-input"
                                type="text"
                                placeholder="Milestone notes (e.g. Lead suspect verified)..."
                                value={snapshotName}
                                onChange={(e) => setSnapshotName(e.target.value)}
                                className="w-full text-xs px-2.5 py-1.5 rounded bg-[var(--background)] border border-[var(--panel-border)] text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--sidebar-accent)]"
                                autoFocus
                                maxLength={500}
                            />
                            <div className="flex gap-1.5">
                                <button
                                    type="submit"
                                    disabled={isCreatingSnapshot}
                                    className="flex-1 py-1 px-2.5 bg-[var(--sidebar-accent)] text-[var(--sidebar-accent-foreground)] rounded text-xs font-medium flex items-center justify-center gap-1 disabled:opacity-50"
                                >
                                    {isCreatingSnapshot ? <AppleSpinner size="xs" /> : <Check className="w-3 h-3" />}
                                    <span>Save Snapshot</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowCreateInput(false)}
                                    className="py-1 px-2 text-xs text-[var(--panel-foreground)]/60 hover:text-[var(--foreground)] rounded"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            )}

            {/* Search / Filter bar */}
            {versions.length > 2 && (
                <div className="px-3 py-2 border-b border-[var(--panel-border)] bg-[var(--background)]/20">
                    <div className="relative">
                        <Search className="w-3.5 h-3.5 text-[var(--panel-foreground)]/40 absolute left-2.5 top-2" />
                        <input
                            type="text"
                            placeholder="Filter snapshots by notes or detective..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-8 pr-2.5 py-1 text-xs rounded bg-[var(--background)] border border-[var(--panel-border)] text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--sidebar-accent)]"
                        />
                    </div>
                </div>
            )}

            {/* In-Panel Restore Confirmation Dialog */}
            {confirmingVersion && (
                <div
                    role="alertdialog"
                    aria-label="Confirm Investigation Rollback"
                    className="p-4 m-3 rounded-xl border border-amber-500/40 bg-amber-950/40 text-amber-200 shadow-xl space-y-3 animate-in fade-in zoom-in-95 duration-200"
                >
                    <div className="flex items-start gap-2.5">
                        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                            <h4 className="font-bold text-xs uppercase tracking-wide text-amber-300">
                                Confirm Investigation Rollback
                            </h4>
                            <p className="text-[11px] text-amber-200/80 mt-1 leading-relaxed">
                                Canvas will revert to this milestone. A safety backup of your current canvas will be preserved automatically with Undo Rollback available.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                        <button
                            onClick={() => executeRestore(confirmingVersion)}
                            disabled={isRestoring}
                            className="flex-1 py-1.5 px-3 bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs rounded transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                            {isRestoring ? (
                                <>
                                    <AppleSpinner size="xs" />
                                    <span>Rolling Back...</span>
                                </>
                            ) : (
                                <>
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    <span>Confirm Restore</span>
                                </>
                            )}
                        </button>
                        <button
                            onClick={() => setConfirmingVersion(null)}
                            disabled={isRestoring}
                            className="py-1.5 px-3 border border-amber-700/50 hover:bg-amber-900/30 text-amber-200 text-xs rounded transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Versions List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-[var(--background)]/20">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3">
                        <AppleSpinner size="md" className="text-[var(--sidebar-accent)]" />
                        <p className="text-xs font-mono text-[var(--panel-foreground)]/60">Retrieving investigation snapshots...</p>
                    </div>
                ) : filteredVersions.length === 0 ? (
                    <div className="text-center py-16 px-4">
                        <Clock className="w-12 h-12 text-[var(--panel-foreground)]/20 mx-auto mb-3" />
                        <p className="text-[var(--panel-foreground)]/70 text-sm font-medium">
                            {searchQuery ? 'No matching snapshots' : 'No version snapshots yet'}
                        </p>
                        <p className="text-[var(--panel-foreground)]/40 text-xs mt-1 leading-relaxed">
                            {searchQuery
                                ? 'Try refining your search filter.'
                                : 'Snapshots are recorded when major clues are pinned, or you can capture a milestone manually above.'}
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="flex items-center justify-between text-[11px] font-mono text-[var(--panel-foreground)]/50 px-1 pb-1">
                            <span>
                                {filteredVersions.length} {filteredVersions.length === 1 ? 'Snapshot' : 'Snapshots'}{' '}
                                {searchQuery ? 'Found' : 'Recorded'}
                            </span>
                            <span>Latest on Top</span>
                        </div>
                        {filteredVersions.map((version, index) => {
                            const details = parseContent(version.content);
                            const isSelected = selectedVersion?.id === version.id;
                            const isExpanded = expandedBreakdownId === version.id;
                            const isLatest = index === 0 && !searchQuery;

                            const nodeDelta = details.nodes.length - liveNodes.length;
                            const edgeDelta = details.edges.length - liveEdges.length;

                            // Evidence breakdown categories
                            const noteCount = details.nodes.filter((n: Record<string, unknown>) => n.type === 'sticky').length;
                            const photoCount = details.nodes.filter((n: Record<string, unknown>) => n.type === 'image').length;
                            const linkCount = details.nodes.filter((n: Record<string, unknown>) => n.type === 'link').length;
                            const clipCount = details.nodes.filter((n: Record<string, unknown>) => n.type === 'article').length;
                            const labelCount = details.nodes.filter((n: Record<string, unknown>) => n.type === 'text').length;

                            return (
                                <div
                                    key={version.id}
                                    tabIndex={0}
                                    role="button"
                                    aria-pressed={isSelected}
                                    className={`p-3 rounded-lg border transition-all cursor-pointer shadow-sm text-left ${
                                        isSelected
                                            ? 'bg-[var(--sidebar-accent)]/15 border-[var(--sidebar-accent)] shadow-md'
                                            : 'bg-[var(--panel-background)] border-[var(--panel-border)] hover:border-[var(--sidebar-accent)]/50'
                                    }`}
                                    onClick={() => setSelectedVersion(version)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            setSelectedVersion(version);
                                        }
                                    }}
                                >
                                    <div className="flex items-start justify-between mb-1.5">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-mono font-bold text-[var(--foreground)]">
                                                #{versions.length - index}
                                            </span>
                                            {isLatest && (
                                                <span className="text-[10px] bg-[var(--sidebar-accent)]/20 text-[var(--sidebar-accent)] px-1.5 py-0.2 rounded font-mono font-bold border border-[var(--sidebar-accent)]/30">
                                                    Current
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-[11px] font-mono text-[var(--panel-foreground)]/60">
                                            {formatRelativeTime(version.createdAt)}
                                        </span>
                                    </div>

                                    {/* Milestone Notes if present */}
                                    {version.notes && (
                                        <div className="mt-1.5 px-2 py-1 bg-[var(--sidebar-accent)]/10 border border-[var(--sidebar-accent)]/20 rounded text-[11px] font-serif italic text-[var(--sidebar-accent)]">
                                            &ldquo;{version.notes}&rdquo;
                                        </div>
                                    )}

                                    {/* Author and Evidence Counts */}
                                    <div className="flex items-center justify-between text-[11px] text-[var(--panel-foreground)]/70 mt-2 font-mono">
                                        <div className="flex items-center gap-1.5 truncate">
                                            {version.creatorImage ? (
                                                <Image
                                                    src={version.creatorImage}
                                                    alt=""
                                                    width={16}
                                                    height={16}
                                                    className="w-4 h-4 rounded-full object-cover shrink-0 border border-stone-600"
                                                    unoptimized
                                                />
                                            ) : (
                                                <User className="w-3.5 h-3.5 text-[var(--sidebar-accent)] shrink-0" />
                                            )}
                                            <span className="truncate">{version.creatorName || 'Detective'}</span>
                                        </div>
                                        <span className="bg-[var(--background)]/60 px-1.5 py-0.5 rounded border border-[var(--panel-border)] text-[10px]">
                                            {details.nodes.length} {details.nodes.length === 1 ? 'clue' : 'clues'} • {details.edges.length} {details.edges.length === 1 ? 'string' : 'strings'}
                                        </span>
                                    </div>

                                    {/* Delta vs Live when selected */}
                                    {isSelected && (
                                        <div className="mt-2 pt-1.5 border-t border-[var(--panel-border)]/40 flex items-center justify-between text-[10px] font-mono text-[var(--panel-foreground)]/60">
                                            <span>Delta vs Live:</span>
                                            <span className="font-bold text-[var(--sidebar-accent)]">
                                                {nodeDelta >= 0 ? `+${nodeDelta}` : nodeDelta} clues • {edgeDelta >= 0 ? `+${edgeDelta}` : edgeDelta} strings
                                            </span>
                                        </div>
                                    )}

                                    {/* Expandable Evidence Breakdown Drawer trigger */}
                                    <div className="mt-2 pt-1 flex items-center justify-between">
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setExpandedBreakdownId(isExpanded ? null : version.id);
                                            }}
                                            className="text-[10px] font-mono text-[var(--panel-foreground)]/60 hover:text-[var(--foreground)] flex items-center gap-1"
                                            aria-expanded={isExpanded}
                                        >
                                            <span>Evidence Breakdown</span>
                                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                        </button>

                                        {isSelected && !isReadOnly && (
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setConfirmingVersion(version);
                                                }}
                                                disabled={isRestoring}
                                                className="py-1 px-2.5 bg-[var(--sidebar-accent)] hover:bg-[var(--sidebar-accent)]/90 text-[var(--sidebar-accent-foreground)] text-[11px] font-bold rounded shadow-sm transition-colors flex items-center gap-1"
                                            >
                                                <RotateCcw className="w-3 h-3" />
                                                <span>Roll Back</span>
                                            </button>
                                        )}
                                    </div>

                                    {/* Expanded Evidence Breakdown Inventory */}
                                    {isExpanded && (
                                        <div className="mt-2 pt-2 border-t border-[var(--panel-border)]/40 flex flex-wrap gap-1.5 font-mono text-[10px] animate-in fade-in duration-150">
                                            <span className="px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 flex items-center gap-1">
                                                <StickyNote className="w-2.5 h-2.5" /> {noteCount} Notes
                                            </span>
                                            <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20 flex items-center gap-1">
                                                <ImageIcon className="w-2.5 h-2.5" /> {photoCount} Polaroids
                                            </span>
                                            <span className="px-1.5 py-0.5 rounded bg-green-500/10 text-green-500 border border-green-500/20 flex items-center gap-1">
                                                <ExternalLink className="w-2.5 h-2.5" /> {linkCount} Links
                                            </span>
                                            <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center gap-1">
                                                <Newspaper className="w-2.5 h-2.5" /> {clipCount} Clippings
                                            </span>
                                            <span className="px-1.5 py-0.5 rounded bg-stone-500/10 text-stone-400 border border-stone-500/20 flex items-center gap-1">
                                                <Type className="w-2.5 h-2.5" /> {labelCount} Labels
                                            </span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </>
                )}
            </div>

            {/* Bottom Clue Inspector Drawer when version selected */}
            {selectedDetails && selectedVersion && (
                <div className="p-3 border-t border-[var(--panel-border)] bg-[var(--background)]/40 text-xs">
                    <div className="flex items-center justify-between font-mono text-[11px] text-[var(--panel-foreground)]/70 mb-1">
                        <span className="font-semibold text-[var(--foreground)]">Selected Snapshot Intel:</span>
                        <span>{selectedDetails.nodes.length} Items Total</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-1 font-mono text-[10px]">
                        <span className="px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
                            {selectedDetails.nodes.filter((n: Record<string, unknown>) => n.type === 'sticky').length} Notes
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20">
                            {selectedDetails.nodes.filter((n: Record<string, unknown>) => n.type === 'image').length} Polaroids
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-green-500/10 text-green-500 border border-green-500/20">
                            {selectedDetails.nodes.filter((n: Record<string, unknown>) => n.type === 'link').length} Links
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">
                            {selectedDetails.nodes.filter((n: Record<string, unknown>) => n.type === 'article').length} Clippings
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-stone-500/10 text-stone-400 border border-stone-500/20">
                            {selectedDetails.nodes.filter((n: Record<string, unknown>) => n.type === 'text').length} Labels
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}

