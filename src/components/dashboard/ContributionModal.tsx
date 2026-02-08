'use client';

import React, { useEffect, useState, useMemo } from 'react';
import ReactFlow, { Background, BackgroundVariant } from 'reactflow';
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
    snapshot: any;
}

interface ContributionModalProps {
    isOpen: boolean;
    onClose: () => void;
    boardId: string;
    onMergeSuccess?: () => void;
}

export default function ContributionModal({ isOpen, onClose, boardId, onMergeSuccess }: ContributionModalProps) {
    const [contributions, setContributions] = useState<Contribution[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && boardId) {
            setLoading(true);
            fetch(`/api/contributions?boardId=${boardId}`)
                .then(res => res.json())
                .then(data => {
                    if (Array.isArray(data)) {
                        setContributions(data);
                    }
                })
                .catch(err => console.error(err))
                .finally(() => setLoading(false));
        }
    }, [isOpen, boardId]);


    const [previewContribution, setPreviewContribution] = useState<Contribution | null>(null);

    const handleAccept = async (id: string) => {
        try {
            const res = await fetch(`/api/contributions/${id}/merge`, {
                method: 'POST',
            });

            if (res.ok) {
                toast.success("Changes merged successfully!");
                // Refresh list
                setContributions(prev => prev.filter(c => c.id !== id));
                // Refresh the parent board
                if (onMergeSuccess) {
                    onMergeSuccess();
                } else if (window.location.reload) {
                    window.location.reload();
                }
            } else {
                const err = await res.text();
                toast.error(`Merge failed: ${err}`);
            }
        } catch (error) {
            console.error('Merge error:', error);
            toast.error("Failed to merge changes");
        }
    };

    if (!isOpen) return null;

    if (previewContribution) {
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
                                <p className="text-xs text-stone-500">Previewing proposed snapshot</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    handleAccept(previewContribution.id);
                                    setPreviewContribution(null);
                                }}
                                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold transition-colors"
                            >
                                <GitMerge className="w-4 h-4" />
                                Merge Changes
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 relative bg-stone-950">
                        <ReactFlow
                            nodes={previewContribution.snapshot?.nodes || []}
                            edges={previewContribution.snapshot?.edges || []}
                            nodeTypes={{
                                sticky: StickyNoteNode,
                                image: ImageNode,
                                text: TextNode,
                                article: ArticleNode,
                            }}
                            fitView
                            proOptions={{ hideAttribution: true }}
                        >
                            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#444" />
                        </ReactFlow>
                        <div className="absolute bottom-4 left-4 bg-black/50 p-4 rounded text-stone-300 text-sm max-w-md pointer-events-none">
                            <p className="font-bold mb-1">Message:</p>
                            <p>"{previewContribution.message}"</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-[500px] bg-stone-900 border border-stone-800 rounded-xl shadow-2xl overflow-hidden">
                <div className="p-4 border-b border-stone-800 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-stone-100">Incoming Suggestions</h2>
                    <button onClick={onClose} className="p-1 hover:bg-stone-800 rounded transition">
                        <X className="w-5 h-5 text-stone-400" />
                    </button>
                </div>

                <div className="p-4 max-h-[60vh] overflow-y-auto">
                    {loading ? (
                        <div className="text-center text-stone-500 py-8">Loading...</div>
                    ) : contributions.length === 0 ? (
                        <div className="text-center text-stone-500 py-8">No open suggestions.</div>
                    ) : (
                        <div className="space-y-3">
                            {contributions.map((c) => (
                                <div key={c.id} className="p-3 bg-stone-800/50 rounded-lg border border-stone-700/50">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <p className="font-semibold text-stone-200 text-sm">User {c.userId.slice(0, 5)}...</p>
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
                                            <button
                                                onClick={() => handleAccept(c.id)}
                                                className="p-1.5 bg-green-900/40 hover:bg-green-900/60 text-green-400 border border-green-900 rounded transition"
                                                title="Accept Changes"
                                            >
                                                <Check className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                    <p className="text-stone-400 text-sm italic">"{c.message}"</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
