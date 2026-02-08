'use client';

import React, { useEffect, useState } from 'react';
import ReactFlow, { Background, BackgroundVariant, Node as FlowNode, Edge as FlowEdge } from 'reactflow';
import 'reactflow/dist/style.css';
import { X, Check, Eye, ArrowLeft, GitMerge } from 'lucide-react';
import StickyNoteNode from '@/components/nodes/StickyNoteNode';
import ImageNode from '@/components/nodes/ImageNode';
import TextNode from '@/components/nodes/TextNode';
import ArticleNode from '@/components/nodes/ArticleNode';
import { toast } from 'sonner';

interface Contribution {
    id: string;
    userId: string;
    message: string;
    createdAt: string;
    status: 'open' | 'merged' | 'rejected';
    snapshot: Record<string, unknown>;
}

interface ContributionModalProps {
    isOpen: boolean;
    onClose: () => void;
    boardId: string;
    onMergeSuccess?: () => void;
    isReadOnly?: boolean;
}

export default function ContributionModal({ isOpen, onClose, boardId, onMergeSuccess, isReadOnly }: ContributionModalProps) {
    const [activeTab, setActiveTab] = useState<string>('incoming');
    const [incomingContributions, setIncomingContributions] = useState<Contribution[]>([]);
    const [outgoingContributions, setOutgoingContributions] = useState<Contribution[]>([]);
    const [loading, setLoading] = useState(false);
    const [previewContribution, setPreviewContribution] = useState<Contribution | null>(null);

    // Initial Tab Selection based on Role
    useEffect(() => {
        if (isOpen) {
            setActiveTab(isReadOnly ? 'public_suggestions' : 'active_requests');
        }
    }, [isOpen, isReadOnly]);

    // Fetch Incoming (All) - We filter client-side for now as API returns all
    useEffect(() => {
        if (isOpen && boardId && (activeTab === 'active_requests' || activeTab === 'history' || activeTab === 'public_suggestions')) {
            setLoading(true);
            fetch(`/api/contributions?boardId=${boardId}`)
                .then(res => res.json())
                .then(data => {
                    if (Array.isArray(data)) {
                        setIncomingContributions(data);
                    }
                })
                .catch(err => console.error(err))
                .finally(() => setLoading(false));
        }
    }, [isOpen, boardId, activeTab]);

    // Fetch Outgoing
    useEffect(() => {
        if (isOpen && activeTab === 'my_contributions') {
            setLoading(true);
            fetch(`/api/contributions?type=sent&boardId=${boardId}`)
                .then(res => res.json())
                .then(data => {
                    if (Array.isArray(data)) {
                        setOutgoingContributions(data);
                    }
                })
                .catch(err => console.error(err))
                .finally(() => setLoading(false));
        }
    }, [isOpen, activeTab, boardId]);

    const handleAccept = async (id: string) => {
        try {
            const res = await fetch(`/api/contributions/${id}/merge`, { method: 'POST' });
            if (res.ok) {
                toast.success("Changes merged successfully!");
                // Update local state to reflect change immediately without refetch
                setIncomingContributions(prev => prev.map(c => c.id === id ? { ...c, status: 'merged' } : c));
                if (onMergeSuccess) onMergeSuccess();
            } else {
                toast.error(`Merge failed: ${await res.text()}`);
            }
        } catch (error) {
            console.error('Merge error:', error);
            toast.error("Failed to merge changes");
        }
    };

    const handleReject = async (id: string) => {
        try {
            const res = await fetch(`/api/contributions/${id}/reject`, { method: 'POST' });
            if (res.ok) {
                toast.success("Contribution rejected.");
                setIncomingContributions(prev => prev.map(c => c.id === id ? { ...c, status: 'rejected' } : c));
                if (onMergeSuccess) onMergeSuccess();
            } else {
                toast.error("Failed to reject contribution");
            }
        } catch (error) {
            console.error('Reject error:', error);
            toast.error("Failed to reject");
        }
    };

    // Filter Logic
    const displayedIncoming = incomingContributions.filter(c => {
        if (activeTab === 'active_requests' || activeTab === 'public_suggestions') return c.status === 'open';
        if (activeTab === 'history') return c.status !== 'open';
        return false;
    });

    if (!isOpen) return null;

    if (previewContribution) {
        const isIncoming = incomingContributions.find(c => c.id === previewContribution.id);
        // Only show actions if: It's incoming, NOT read-only, AND it's Open status
        const showActions = isIncoming && !isReadOnly && previewContribution.status === 'open';

        return (
            <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm">
                <div className="w-[90vw] h-[90vh] bg-stone-900 border border-stone-800 rounded-xl shadow-2xl overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-stone-800 flex justify-between items-center bg-stone-900 z-10">
                        <div className="flex items-center gap-4">
                            <button onClick={() => setPreviewContribution(null)} className="p-2 hover:bg-stone-800 rounded-full transition">
                                <ArrowLeft className="w-5 h-5 text-stone-400" />
                            </button>
                            <div>
                                <h2 className="text-lg font-bold text-stone-100">Review Changes</h2>
                                <div className="flex items-center gap-2">
                                    <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${previewContribution.status === 'merged' ? 'bg-green-900/30 text-green-400 border-green-800' :
                                        previewContribution.status === 'rejected' ? 'bg-red-900/30 text-red-400 border-red-800' :
                                            'bg-amber-900/30 text-amber-400 border-amber-800'
                                        }`}>
                                        {previewContribution.status}
                                    </span>
                                    <p className="text-xs text-stone-500">Snapshot Preview</p>
                                </div>
                            </div>
                        </div>
                        {showActions && (
                            <div className="flex gap-2">
                                <button
                                    onClick={() => { handleReject(previewContribution.id); setPreviewContribution(null); }}
                                    className="px-4 py-2 bg-red-900/40 hover:bg-red-900/60 text-red-200 border border-red-900 rounded-lg font-bold transition-colors text-sm"
                                >
                                    Reject
                                </button>
                                <button
                                    onClick={() => { handleAccept(previewContribution.id); setPreviewContribution(null); }}
                                    className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold transition-colors text-sm"
                                >
                                    <GitMerge className="w-4 h-4" />
                                    Merge Changes
                                </button>
                            </div>
                        )}
                    </div>
                    <div className="flex-1 relative bg-stone-950">
                        <ReactFlow
                            nodes={(previewContribution.snapshot as unknown as { nodes: FlowNode[] })?.nodes || []}
                            edges={(previewContribution.snapshot as unknown as { edges: FlowEdge[] })?.edges || []}
                            nodeTypes={{ sticky: StickyNoteNode, image: ImageNode, text: TextNode, article: ArticleNode }}
                            fitView
                            proOptions={{ hideAttribution: true }}
                        >
                            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#444" />
                        </ReactFlow>
                        <div className="absolute bottom-4 left-4 bg-black/50 p-4 rounded text-stone-300 text-sm max-w-md pointer-events-none">
                            <p className="font-bold mb-1">Message:</p>
                            <p>&quot;{previewContribution.message}&quot;</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-[500px] bg-stone-900 border border-stone-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                <div className="p-4 border-b border-stone-800 flex justify-between items-center shrink-0">
                    <h2 className="text-lg font-bold text-stone-100">
                        {isReadOnly ? 'Public Suggestions' : 'Manage Contributions'}
                    </h2>
                    <button onClick={onClose} className="p-1 hover:bg-stone-800 rounded transition">
                        <X className="w-5 h-5 text-stone-400" />
                    </button>
                </div>

                {/* Tabs Logic */}
                <div className="flex border-b border-stone-800 shrink-0 overflow-x-auto">
                    {!isReadOnly ? (
                        <>
                            <button
                                onClick={() => setActiveTab('active_requests')}
                                className={`flex-1 py-3 text-xs font-bold whitespace-nowrap px-4 transition-colors ${activeTab === 'active_requests' ? 'bg-stone-800 text-amber-500 border-b-2 border-amber-500' : 'text-stone-400 hover:text-stone-200'}`}
                            >
                                Active Requests
                            </button>
                            <button
                                onClick={() => setActiveTab('history')}
                                className={`flex-1 py-3 text-xs font-bold whitespace-nowrap px-4 transition-colors ${activeTab === 'history' ? 'bg-stone-800 text-amber-500 border-b-2 border-amber-500' : 'text-stone-400 hover:text-stone-200'}`}
                            >
                                History
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={() => setActiveTab('public_suggestions')}
                                className={`flex-1 py-3 text-xs font-bold whitespace-nowrap px-4 transition-colors ${activeTab === 'public_suggestions' ? 'bg-stone-800 text-amber-500 border-b-2 border-amber-500' : 'text-stone-400 hover:text-stone-200'}`}
                            >
                                Public Suggestions
                            </button>
                            <button
                                onClick={() => setActiveTab('my_contributions')}
                                className={`flex-1 py-3 text-xs font-bold whitespace-nowrap px-4 transition-colors ${activeTab === 'my_contributions' ? 'bg-stone-800 text-amber-500 border-b-2 border-amber-500' : 'text-stone-400 hover:text-stone-200'}`}
                            >
                                My Contributions
                            </button>
                        </>
                    )}
                </div>

                <div className="p-4 overflow-y-auto flex-1">
                    {loading ? (
                        <div className="text-center text-stone-500 py-8">Loading...</div>
                    ) : activeTab === 'my_contributions' ? (
                        outgoingContributions.length === 0 ? (
                            <div className="text-center text-stone-500 py-8">You haven&apos;t made any contributions yet.</div>
                        ) : (
                            <div className="space-y-3">
                                {outgoingContributions.map((c) => (
                                    <div key={c.id} className="p-3 bg-stone-800/50 rounded-lg border border-stone-700/50 flex justify-between items-center">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${c.status === 'merged' ? 'bg-green-900/30 text-green-400 border-green-800' :
                                                    c.status === 'rejected' ? 'bg-red-900/30 text-red-400 border-red-800' :
                                                        'bg-amber-900/30 text-amber-400 border-amber-800'
                                                    }`}>
                                                    {c.status}
                                                </span>
                                                <span className="text-[10px] text-stone-500">{new Date(c.createdAt).toLocaleDateString()}</span>
                                            </div>
                                            <p className="text-stone-300 text-sm">&quot;{c.message}&quot;</p>
                                        </div>
                                        <button onClick={() => setPreviewContribution(c)} className="p-1.5 bg-stone-700 hover:bg-stone-600 rounded text-stone-300 transition" title="View">
                                            <Eye className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )
                    ) : (
                        // Render Incoming (Active, History, or Public Suggestions)
                        displayedIncoming.length === 0 ? (
                            <div className="text-center text-stone-500 py-8">
                                {activeTab === 'active_requests' ? "No pending suggestions." :
                                    activeTab === 'history' ? "No history yet." :
                                        "No open suggestions."}
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {displayedIncoming.map((c) => (
                                    <div key={c.id} className="p-3 bg-stone-800/50 rounded-lg border border-stone-700/50 hover:bg-stone-800 transition-colors">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="font-semibold text-stone-200 text-sm">User {c.userId.slice(0, 5)}...</p>
                                                    {/* Always show badge in History, or if ReadOnly */}
                                                    {(activeTab === 'history' || isReadOnly) && (
                                                        <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${c.status === 'merged' ? 'bg-green-900/30 text-green-400 border-green-800' :
                                                            c.status === 'rejected' ? 'bg-red-900/30 text-red-400 border-red-800' :
                                                                'bg-amber-900/30 text-amber-400 border-amber-800'
                                                            }`}>
                                                            {c.status}
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-[10px] text-stone-500 uppercase tracking-wider">{new Date(c.createdAt).toLocaleDateString()}</span>
                                            </div>
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={() => setPreviewContribution(c)}
                                                    className="p-1.5 bg-stone-700 hover:bg-stone-600 rounded text-stone-300 transition"
                                                    title="View Diff"
                                                >
                                                    <Eye className="w-3.5 h-3.5" />
                                                </button>
                                                {/* Only show actions in Active Requests tab for Owners */}
                                                {!isReadOnly && activeTab === 'active_requests' && (
                                                    <>
                                                        <button onClick={() => handleAccept(c.id)} className="p-1.5 bg-green-900/40 hover:bg-green-900/60 text-green-400 border border-green-900 rounded transition" title="Accept">
                                                            <Check className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button onClick={() => handleReject(c.id)} className="p-1.5 bg-red-900/40 hover:bg-red-900/60 text-red-400 border border-red-900 rounded transition" title="Reject">
                                                            <X className="w-3.5 h-3.5" />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        <p className="text-stone-400 text-sm italic">&quot;{c.message}&quot;</p>
                                    </div>
                                ))}
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>
    );
}
