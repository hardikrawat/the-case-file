'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Image from 'next/image';
import ReactFlow, { 
    Background, 
    BackgroundVariant, 
    Node as FlowNode, 
    Edge as FlowEdge, 
    ReactFlowProvider,
    useReactFlow 
} from 'reactflow';
import 'reactflow/dist/style.css';
import { 
    X, 
    Check, 
    Eye, 
    ArrowLeft, 
    GitMerge, 
    ZoomIn, 
    ZoomOut, 
    Maximize2, 
    User, 
    Trash2, 
    PlusCircle, 
    Edit3, 
    GitBranch 
} from 'lucide-react';
import StickyNoteNode from '@/components/nodes/StickyNoteNode';
import ImageNode from '@/components/nodes/ImageNode';
import TextNode from '@/components/nodes/TextNode';
import ArticleNode from '@/components/nodes/ArticleNode';
import LinkNode from '@/components/nodes/LinkNode';
import AppleSpinner from '@/components/ui/AppleSpinner';
import StringEdge from '@/components/edges/StringEdge';
import { IsReadOnlyContext } from '@/context/ReadOnlyContext';
import useStore, { RFState } from '@/store/useStore';
import { toast } from 'sonner';

interface Contribution {
    id: string;
    userId: string;
    boardId?: string;
    message: string;
    createdAt: string;
    status: 'open' | 'merged' | 'rejected';
    snapshot: {
        nodes?: FlowNode[];
        edges?: FlowEdge[];
        [key: string]: unknown;
    };
    boardTitle?: string | null;
    contributorName?: string | null;
    contributorImage?: string | null;
}

interface ContributionModalProps {
    isOpen: boolean;
    onClose: () => void;
    boardId: string;
    onMergeSuccess?: () => void;
    isReadOnly?: boolean;
}

const nodeTypes = {
    sticky: StickyNoteNode,
    image: ImageNode,
    text: TextNode,
    article: ArticleNode,
    link: LinkNode,
};

const edgeTypes = {
    string: StringEdge,
    default: StringEdge,
};

function PreviewCanvasControls() {
    const { zoomIn, zoomOut, fitView } = useReactFlow();
    return (
        <div className="absolute bottom-4 right-4 z-20 flex items-center gap-1 bg-[var(--panel-background)]/90 border border-[var(--panel-border)] p-1.5 rounded-lg shadow-lg backdrop-blur-sm">
            <button
                type="button"
                onClick={() => zoomIn()}
                className="p-1.5 hover:bg-[var(--background)] rounded text-[var(--panel-foreground)]/80 hover:text-[var(--foreground)] transition-colors"
                title="Zoom In"
            >
                <ZoomIn className="w-4 h-4" />
            </button>
            <button
                type="button"
                onClick={() => zoomOut()}
                className="p-1.5 hover:bg-[var(--background)] rounded text-[var(--panel-foreground)]/80 hover:text-[var(--foreground)] transition-colors"
                title="Zoom Out"
            >
                <ZoomOut className="w-4 h-4" />
            </button>
            <button
                type="button"
                onClick={() => fitView({ padding: 0.2, duration: 400 })}
                className="p-1.5 hover:bg-[var(--background)] rounded text-[var(--panel-foreground)]/80 hover:text-[var(--foreground)] transition-colors"
                title="Fit View"
            >
                <Maximize2 className="w-4 h-4" />
            </button>
        </div>
    );
}

export default function ContributionModal({ isOpen, onClose, boardId, onMergeSuccess, isReadOnly }: ContributionModalProps) {
    const [activeTab, setActiveTab] = useState<string>('active_requests');
    const [incomingContributions, setIncomingContributions] = useState<Contribution[]>([]);
    const [outgoingContributions, setOutgoingContributions] = useState<Contribution[]>([]);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [previewContribution, setPreviewContribution] = useState<Contribution | null>(null);
    
    // Rejection reason prompt dialog state
    const [rejectionModalId, setRejectionModalId] = useState<string | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');

    const liveNodes = useStore((state: RFState) => state.nodes);
    const liveEdges = useStore((state: RFState) => state.edges);

    // Initial Tab Selection based on Role
    useEffect(() => {
        if (isOpen) {
            setActiveTab(isReadOnly ? 'public_suggestions' : 'active_requests');
            setPreviewContribution(null);
            setRejectionModalId(null);
            setRejectionReason('');
        }
    }, [isOpen, isReadOnly]);

    // Fetch Incoming
    useEffect(() => {
        if (isOpen && boardId && (activeTab === 'active_requests' || activeTab === 'history' || activeTab === 'public_suggestions')) {
            const controller = new AbortController();
            setLoading(true);
            fetch(`/api/contributions?boardId=${boardId}`, { signal: controller.signal })
                .then((res) => res.json())
                .then((data) => {
                    if (Array.isArray(data)) {
                        setIncomingContributions(data);
                    }
                })
                .catch((err) => {
                    if (err.name !== 'AbortError') {
                        console.error('Error fetching contributions:', err);
                    }
                })
                .finally(() => setLoading(false));
            return () => controller.abort();
        }
    }, [isOpen, boardId, activeTab]);

    // Fetch Outgoing
    useEffect(() => {
        if (isOpen && activeTab === 'my_contributions') {
            const controller = new AbortController();
            setLoading(true);
            fetch(`/api/contributions?type=sent&boardId=${boardId}`, { signal: controller.signal })
                .then((res) => res.json())
                .then((data) => {
                    if (Array.isArray(data)) {
                        setOutgoingContributions(data);
                    }
                })
                .catch((err) => {
                    if (err.name !== 'AbortError') {
                        console.error('Error fetching outgoing contributions:', err);
                    }
                })
                .finally(() => setLoading(false));
            return () => controller.abort();
        }
    }, [isOpen, activeTab, boardId]);

    const handleAccept = async (id: string) => {
        setActionLoading(true);
        try {
            const res = await fetch(`/api/contributions/${id}/merge`, {
                method: 'POST',
            });
            const data = await res.json();
            if (res.ok) {
                toast.success(`Investigation suggestions merged! (${data.mergedNodesCount || 0} clues updated)`);
                setPreviewContribution(null);
                onMergeSuccess?.();
                // Refresh list
                const refreshed = await fetch(`/api/contributions?boardId=${boardId}`).then((r) => r.json());
                if (Array.isArray(refreshed)) setIncomingContributions(refreshed);
            } else {
                toast.error(data.error || 'Failed to merge suggestion');
            }
        } catch (err) {
            console.error('Merge error:', err);
            toast.error('Network error while merging');
        } finally {
            setActionLoading(false);
        }
    };

    const handleReject = async (id: string, reason?: string) => {
        setActionLoading(true);
        try {
            const res = await fetch(`/api/contributions/${id}/reject`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason }),
            });
            const data = await res.json();
            if (res.ok) {
                const message = data.withdrawn ? 'Proposal withdrawn successfully' : 'Suggestion rejected';
                toast.success(message);
                setRejectionModalId(null);
                setRejectionReason('');
                setPreviewContribution(null);

                // Refresh appropriate list
                if (activeTab === 'my_contributions') {
                    const refreshed = await fetch(`/api/contributions?type=sent&boardId=${boardId}`).then((r) => r.json());
                    if (Array.isArray(refreshed)) setOutgoingContributions(refreshed);
                } else {
                    const refreshed = await fetch(`/api/contributions?boardId=${boardId}`).then((r) => r.json());
                    if (Array.isArray(refreshed)) setIncomingContributions(refreshed);
                }
            } else {
                toast.error(data.error || 'Failed to update suggestion status');
            }
        } catch (err) {
            console.error('Reject error:', err);
            toast.error('Network error updating suggestion status');
        } finally {
            setActionLoading(false);
        }
    };

    // Filter Logic
    const displayedIncoming = incomingContributions.filter((c) => {
        if (activeTab === 'active_requests' || activeTab === 'public_suggestions') return c.status === 'open';
        if (activeTab === 'history') return c.status !== 'open';
        return false;
    });

    // Compute Visual Diff when previewing
    const { diffedNodes, diffedEdges, diffSummary } = useMemo(() => {
        if (!previewContribution?.snapshot) {
            return { diffedNodes: [], diffedEdges: [], diffSummary: { added: 0, modified: 0, newEdges: 0, removed: 0 } };
        }

        const rawNodes: FlowNode[] = Array.isArray(previewContribution.snapshot.nodes) ? previewContribution.snapshot.nodes : [];
        const rawEdges: FlowEdge[] = Array.isArray(previewContribution.snapshot.edges) ? previewContribution.snapshot.edges : [];

        const liveNodeMap = new Map<string, FlowNode>(liveNodes.map((n: FlowNode) => [n.id, n]));
        const livePairSet = new Set<string>(liveEdges.map((e: FlowEdge) => [e.source, e.target].sort().join(':::')));

        let added = 0;
        let modified = 0;

        const dNodes = rawNodes.map((sNode: FlowNode) => {
            const lNode = liveNodeMap.get(sNode.id);
            if (!lNode) {
                added++;
                return {
                    ...sNode,
                    data: {
                        ...sNode.data,
                        isReadOnly: true,
                        _diffStatus: 'added',
                    },
                    // Emerald / Green Glow on newly proposed clues
                    className: `${sNode.className || ''} ring-2 ring-emerald-500 ring-offset-2 ring-offset-black/50 shadow-[0_0_25px_rgba(16,185,129,0.55)] border-emerald-500 transition-all`,
                };
            }

            // Check if modified (coordinates or payload)
            const posDiff = Math.abs((sNode.position?.x || 0) - (lNode.position?.x || 0)) > 2 ||
                            Math.abs((sNode.position?.y || 0) - (lNode.position?.y || 0)) > 2;
            const dataDiff = JSON.stringify(sNode.data) !== JSON.stringify(lNode.data);

            if (posDiff || dataDiff) {
                modified++;
                return {
                    ...sNode,
                    data: {
                        ...sNode.data,
                        isReadOnly: true,
                        _diffStatus: 'modified',
                    },
                    // Amber / Yellow Glow on modified clues
                    className: `${sNode.className || ''} ring-2 ring-amber-500 ring-offset-2 ring-offset-black/50 shadow-[0_0_25px_rgba(245,158,11,0.55)] border-amber-500 transition-all`,
                };
            }

            // Dimmed Context: Unaltered clues preserved for visual reference
            return {
                ...sNode,
                data: {
                    ...sNode.data,
                    isReadOnly: true,
                    _diffStatus: 'unchanged',
                },
                className: `${sNode.className || ''} opacity-60 grayscale-[25%] transition-opacity`,
            };
        });

        // Count removed clues (present on master board, missing in proposed snapshot)
        const snapshotNodeIds = new Set(rawNodes.map((n) => n.id));
        let removed = 0;
        liveNodes.forEach((ln: FlowNode) => {
            if (!snapshotNodeIds.has(ln.id)) {
                removed++;
            }
        });

        let newEdges = 0;
        const dEdges = rawEdges.map((sEdge) => {
            const pairKey = [sEdge.source, sEdge.target].sort().join(':::');
            const isNew = !livePairSet.has(pairKey);
            if (isNew) newEdges++;
            return {
                ...sEdge,
                data: {
                    ...sEdge.data,
                    isReadOnly: true,
                    _isNew: isNew,
                },
                // Green Stroke on newly proposed red yarn connections
                style: isNew ? { ...sEdge.style, stroke: '#10b981', strokeWidth: 3.5 } : sEdge.style,
            };
        });

        return {
            diffedNodes: dNodes,
            diffedEdges: dEdges,
            diffSummary: { added, modified, newEdges, removed },
        };
    }, [previewContribution, liveNodes, liveEdges]);

    if (!isOpen) return null;

    if (previewContribution) {
        const isIncoming = incomingContributions.some((c) => c.id === previewContribution.id);
        const showActions = isIncoming && !isReadOnly && previewContribution.status === 'open';

        return (
            <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                <div className="w-full max-w-6xl h-[90vh] bg-[var(--panel-background)] border border-[var(--panel-border)] rounded-xl shadow-2xl overflow-hidden flex flex-col text-[var(--panel-foreground)] transition-colors duration-300">
                    {/* Header */}
                    <div className="p-4 border-b border-[var(--panel-border)] flex flex-wrap justify-between items-center gap-3 bg-[var(--background)]/80 z-10">
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => setPreviewContribution(null)}
                                className="p-2 hover:bg-[var(--background)] rounded-full transition text-[var(--panel-foreground)]/70 hover:text-[var(--foreground)]"
                                title="Back to list"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-base font-bold text-[var(--foreground)]">Inspection Review</h2>
                                    <span
                                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                                            previewContribution.status === 'merged'
                                                ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800'
                                                : previewContribution.status === 'rejected'
                                                ? 'bg-red-950/60 text-red-400 border-red-800'
                                                : 'bg-amber-950/60 text-amber-400 border-amber-800'
                                        }`}
                                    >
                                        {previewContribution.status}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                    {previewContribution.contributorImage ? (
                                        <Image
                                            src={previewContribution.contributorImage}
                                            alt=""
                                            width={16}
                                            height={16}
                                            className="w-4 h-4 rounded-full object-cover border border-stone-600"
                                            unoptimized
                                        />
                                    ) : (
                                        <User className="w-3.5 h-3.5 text-stone-400" />
                                    )}
                                    <p className="text-xs text-[var(--panel-foreground)]/70 font-mono">
                                        Detective {previewContribution.contributorName || previewContribution.userId.slice(0, 8)}
                                    </p>
                                    <span className="text-xs text-[var(--panel-foreground)]/40">•</span>
                                    <p className="text-xs text-[var(--panel-foreground)]/60">
                                        {new Date(previewContribution.createdAt).toLocaleString()}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Diff pill indicators */}
                        <div className="flex items-center gap-2 bg-[var(--background)]/60 px-3 py-1.5 rounded-lg border border-[var(--panel-border)] text-xs font-mono">
                            <span className="flex items-center gap-1 text-emerald-400">
                                <PlusCircle className="w-3.5 h-3.5" /> +{diffSummary.added} Added
                            </span>
                            <span className="text-[var(--panel-border)]">|</span>
                            <span className="flex items-center gap-1 text-amber-400">
                                <Edit3 className="w-3.5 h-3.5" /> ~{diffSummary.modified} Modified
                            </span>
                            <span className="text-[var(--panel-border)]">|</span>
                            <span className="flex items-center gap-1 text-sky-400">
                                <GitBranch className="w-3.5 h-3.5" /> +{diffSummary.newEdges} Strings
                            </span>
                        </div>

                        {/* Action buttons */}
                        {showActions && (
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    disabled={actionLoading}
                                    onClick={() => setRejectionModalId(previewContribution.id)}
                                    className="px-3.5 py-1.5 bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-900 rounded-lg font-medium transition-colors text-xs flex items-center gap-1.5 disabled:opacity-50"
                                >
                                    <X className="w-3.5 h-3.5" />
                                    Reject
                                </button>
                                <button
                                    type="button"
                                    disabled={actionLoading}
                                    onClick={() => handleAccept(previewContribution.id)}
                                    className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-colors text-xs shadow-sm disabled:opacity-50"
                                >
                                    {actionLoading ? (
                                        <AppleSpinner size="sm" />
                                    ) : (
                                        <GitMerge className="w-3.5 h-3.5" />
                                    )}
                                    Merge Changes
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Canvas Preview */}
                    <div className="flex-1 relative bg-[var(--background)] overflow-hidden">
                        <IsReadOnlyContext.Provider value={true}>
                            <ReactFlowProvider>
                                <ReactFlow
                                    nodes={diffedNodes}
                                    edges={diffedEdges}
                                    nodeTypes={nodeTypes}
                                    edgeTypes={edgeTypes}
                                    fitView
                                    proOptions={{ hideAttribution: true }}
                                    nodesDraggable={false}
                                    nodesConnectable={false}
                                    elementsSelectable={false}
                                    panOnDrag={true}
                                    zoomOnScroll={true}
                                    minZoom={0.2}
                                    maxZoom={2.5}
                                >
                                    <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--panel-border)" />
                                    <PreviewCanvasControls />
                                </ReactFlow>
                            </ReactFlowProvider>
                        </IsReadOnlyContext.Provider>

                        {/* Contributor Message Card */}
                        {previewContribution.message && (
                            <div className="absolute bottom-4 left-4 bg-[var(--panel-background)]/95 border border-[var(--panel-border)] p-3.5 rounded-lg text-[var(--panel-foreground)] text-xs max-w-md shadow-xl backdrop-blur-md">
                                <p className="font-bold mb-1 text-[var(--foreground)] uppercase tracking-wider text-[10px] text-amber-500">
                                    Contributor Hypothesis & Notes
                                </p>
                                <p className="italic text-stone-300">&quot;{previewContribution.message}&quot;</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Rejection reason modal prompt */}
                {rejectionModalId && (
                    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                        <div className="bg-[var(--panel-background)] border border-[var(--panel-border)] p-5 rounded-xl max-w-md w-full shadow-2xl space-y-4">
                            <h3 className="font-bold text-sm text-[var(--foreground)]">Reject Suggestion</h3>
                            <p className="text-xs text-[var(--panel-foreground)]/70">
                                Provide an optional note explaining why this suggestion cannot be merged to help the investigator refine their case theory:
                            </p>
                            <textarea
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                placeholder="e.g. Inconclusive suspect link, duplicate evidence, contradicts coroner report..."
                                rows={3}
                                className="w-full text-xs p-2.5 bg-[var(--background)] border border-[var(--panel-border)] rounded-md text-[var(--foreground)] focus:outline-none focus:border-red-500 resize-none"
                                maxLength={500}
                            />
                            <div className="flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setRejectionModalId(null);
                                        setRejectionReason('');
                                    }}
                                    className="px-3 py-1.5 text-xs text-[var(--panel-foreground)]/70 hover:text-[var(--foreground)] rounded"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    disabled={actionLoading}
                                    onClick={() => handleReject(rejectionModalId, rejectionReason)}
                                    className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-500 text-white rounded font-medium flex items-center gap-1.5"
                                >
                                    {actionLoading ? <AppleSpinner size="sm" /> : <X className="w-3.5 h-3.5" />}
                                    Confirm Rejection
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
            <div className="w-[520px] max-w-full bg-[var(--panel-background)] border border-[var(--panel-border)] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-[var(--panel-foreground)] transition-colors duration-300">
                <div className="p-4 border-b border-[var(--panel-border)] flex justify-between items-center shrink-0 bg-[var(--background)]/60">
                    <div className="flex items-center gap-2">
                        <GitBranch className="w-4 h-4 text-amber-500" />
                        <h2 className="text-base font-bold text-[var(--foreground)]">
                            {isReadOnly ? 'Public Suggestions' : 'Collaborative Transmissions'}
                        </h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 hover:bg-[var(--background)] text-[var(--panel-foreground)]/60 hover:text-[var(--foreground)] rounded transition"
                        title="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div role="tablist" className="flex border-b border-[var(--panel-border)] shrink-0 overflow-x-auto bg-[var(--background)]/30 text-xs font-medium">
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === 'active_requests'}
                        onClick={() => setActiveTab('active_requests')}
                        className={`flex-1 py-3 px-4 transition-colors text-center font-semibold border-b-2 ${
                            activeTab === 'active_requests'
                                ? 'bg-[var(--panel-background)] text-amber-400 border-amber-500'
                                : 'text-[var(--panel-foreground)]/60 hover:text-[var(--foreground)] border-transparent'
                        }`}
                    >
                        Active Suggestions
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === 'history'}
                        onClick={() => setActiveTab('history')}
                        className={`flex-1 py-3 px-4 transition-colors text-center font-semibold border-b-2 ${
                            activeTab === 'history'
                                ? 'bg-[var(--panel-background)] text-amber-400 border-amber-500'
                                : 'text-[var(--panel-foreground)]/60 hover:text-[var(--foreground)] border-transparent'
                        }`}
                    >
                        Archive / Resolved
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === 'my_contributions'}
                        onClick={() => setActiveTab('my_contributions')}
                        className={`flex-1 py-3 px-4 transition-colors text-center font-semibold border-b-2 ${
                            activeTab === 'my_contributions'
                                ? 'bg-[var(--panel-background)] text-amber-400 border-amber-500'
                                : 'text-[var(--panel-foreground)]/60 hover:text-[var(--foreground)] border-transparent'
                        }`}
                    >
                        My Proposals
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === 'public_suggestions'}
                        onClick={() => setActiveTab('public_suggestions')}
                        className={`flex-1 py-3 px-4 transition-colors text-center font-semibold border-b-2 ${
                            activeTab === 'public_suggestions'
                                ? 'bg-[var(--panel-background)] text-amber-400 border-amber-500'
                                : 'text-[var(--panel-foreground)]/60 hover:text-[var(--foreground)] border-transparent'
                        }`}
                    >
                        Public Suggestions
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 overflow-y-auto flex-1 bg-[var(--background)]/10 space-y-3">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-3">
                            <AppleSpinner size="md" className="text-amber-500" />
                            <p className="text-xs font-mono text-[var(--panel-foreground)]/60">Scanning transmissions...</p>
                        </div>
                    ) : activeTab === 'my_contributions' ? (
                        outgoingContributions.length === 0 ? (
                            <div className="text-center text-[var(--panel-foreground)]/60 py-12 text-xs font-mono">
                                No proposals submitted from your desk yet.
                            </div>
                        ) : (
                            outgoingContributions.map((c) => (
                                <div
                                    key={c.id}
                                    className="p-3 bg-[var(--background)]/50 rounded-lg border border-[var(--panel-border)] flex justify-between items-center shadow-sm gap-3 hover:border-amber-500/40 transition-colors"
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span
                                                className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                                                    c.status === 'merged'
                                                        ? 'bg-emerald-950/50 text-emerald-400 border-emerald-800'
                                                        : c.status === 'rejected'
                                                        ? 'bg-red-950/50 text-red-400 border-red-800'
                                                        : 'bg-amber-950/50 text-amber-400 border-amber-800'
                                                }`}
                                            >
                                                {c.status}
                                            </span>
                                            <span className="text-[10px] text-[var(--panel-foreground)]/50 font-mono">
                                                {new Date(c.createdAt).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <p className="text-[var(--foreground)] text-xs truncate">
                                            &quot;{c.message || 'No description provided'}&quot;
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => setPreviewContribution(c)}
                                            className="p-1.5 bg-[var(--panel-background)] hover:bg-stone-700/50 border border-[var(--panel-border)] rounded text-[var(--panel-foreground)] transition"
                                            title="Inspect Snapshot"
                                        >
                                            <Eye className="w-3.5 h-3.5" />
                                        </button>
                                        {c.status === 'open' && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (confirm('Withdraw this proposal? Upstream lead detectives will no longer review or merge it.')) {
                                                        handleReject(c.id);
                                                    }
                                                }}
                                                className="p-1.5 bg-red-950/40 hover:bg-red-900/60 border border-red-900 rounded text-red-300 transition"
                                                title="Withdraw Suggestion"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )
                    ) : displayedIncoming.length === 0 ? (
                        <div className="text-center text-[var(--panel-foreground)]/60 py-12 text-xs font-mono">
                            {activeTab === 'active_requests'
                                ? 'No pending suggestions for this case.'
                                : activeTab === 'history'
                                ? 'No historical transmissions recorded.'
                                : 'No open suggestions found.'}
                        </div>
                    ) : (
                        displayedIncoming.map((c) => (
                            <div
                                key={c.id}
                                className="p-3 bg-[var(--background)]/50 rounded-lg border border-[var(--panel-border)] hover:border-amber-500/40 transition-colors shadow-sm"
                            >
                                <div className="flex justify-between items-start gap-2 mb-2">
                                    <div className="flex items-center gap-2">
                                        {c.contributorImage ? (
                                            <Image
                                                src={c.contributorImage}
                                                alt=""
                                                width={20}
                                                height={20}
                                                className="w-5 h-5 rounded-full object-cover border border-stone-600"
                                                unoptimized
                                            />
                                        ) : (
                                            <div className="w-5 h-5 rounded-full bg-stone-800 flex items-center justify-center border border-stone-700">
                                                <User className="w-3 h-3 text-stone-400" />
                                            </div>
                                        )}
                                        <div>
                                            <p className="font-semibold text-[var(--foreground)] text-xs">
                                                {c.contributorName || `Investigator ${c.userId.slice(0, 6)}`}
                                            </p>
                                            <span className="text-[10px] text-[var(--panel-foreground)]/50 font-mono">
                                                {new Date(c.createdAt).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        {(activeTab === 'history' || isReadOnly) && (
                                            <span
                                                className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                                                    c.status === 'merged'
                                                        ? 'bg-emerald-950/50 text-emerald-400 border-emerald-800'
                                                        : c.status === 'rejected'
                                                        ? 'bg-red-950/50 text-red-400 border-red-800'
                                                        : 'bg-amber-950/50 text-amber-400 border-amber-800'
                                                }`}
                                            >
                                                {c.status}
                                            </span>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => setPreviewContribution(c)}
                                            className="p-1.5 bg-[var(--panel-background)] hover:bg-stone-700/50 border border-[var(--panel-border)] rounded text-[var(--panel-foreground)] transition"
                                            title="Inspect Visual Diff"
                                        >
                                            <Eye className="w-3.5 h-3.5" />
                                        </button>
                                        {!isReadOnly && activeTab === 'active_requests' && (
                                            <>
                                                <button
                                                    type="button"
                                                    disabled={actionLoading}
                                                    onClick={() => handleAccept(c.id)}
                                                    className="p-1.5 bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-400 border border-emerald-900 rounded transition disabled:opacity-50"
                                                    title="Accept & Merge"
                                                >
                                                    <Check className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={actionLoading}
                                                    onClick={() => setRejectionModalId(c.id)}
                                                    className="p-1.5 bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-900 rounded transition disabled:opacity-50"
                                                    title="Reject Suggestion"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <p className="text-[var(--panel-foreground)]/80 text-xs italic bg-[var(--background)]/40 p-2 rounded border border-[var(--panel-border)]/50">
                                    &quot;{c.message || 'No description provided'}&quot;
                                </p>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Rejection Modal for List View */}
            {rejectionModalId && !previewContribution && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="bg-[var(--panel-background)] border border-[var(--panel-border)] p-5 rounded-xl max-w-md w-full shadow-2xl space-y-4">
                        <h3 className="font-bold text-sm text-[var(--foreground)]">Reject Suggestion</h3>
                        <p className="text-xs text-[var(--panel-foreground)]/70">
                            Provide an optional note explaining why this suggestion cannot be merged:
                        </p>
                        <textarea
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            placeholder="e.g. Inconclusive suspect link, duplicate evidence, contradicts coroner report..."
                            rows={3}
                            className="w-full text-xs p-2.5 bg-[var(--background)] border border-[var(--panel-border)] rounded-md text-[var(--foreground)] focus:outline-none focus:border-red-500 resize-none"
                            maxLength={500}
                        />
                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setRejectionModalId(null);
                                    setRejectionReason('');
                                }}
                                className="px-3 py-1.5 text-xs text-[var(--panel-foreground)]/70 hover:text-[var(--foreground)] rounded"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={actionLoading}
                                onClick={() => handleReject(rejectionModalId, rejectionReason)}
                                className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-500 text-white rounded font-medium flex items-center gap-1.5"
                            >
                                {actionLoading ? <AppleSpinner size="sm" /> : <X className="w-3.5 h-3.5" />}
                                Confirm Rejection
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

