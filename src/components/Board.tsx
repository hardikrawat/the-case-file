'use client';

import React, { useMemo, useState, useEffect, type MouseEvent } from 'react';
import ReactFlow, {
    Background,
    Controls,
    MiniMap,
    BackgroundVariant,
    addEdge,
    Node,
    Connection,
} from 'reactflow';
import { useShallow } from 'zustand/react/shallow';
import 'reactflow/dist/style.css';
import { useParams, useRouter } from 'next/navigation';
import { Save, Settings, Share2, Check, GitFork, GitPullRequest, RefreshCcw, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { useSession } from 'next-auth/react';
import { useUser } from '@/hooks/useUser';
import { UserBadge } from '@/components/dashboard/UserBadge';

import useStore from '@/store/useStore';
import Toolbar from '@/components/ui/Toolbar';
import StickyNoteNode from '@/components/nodes/StickyNoteNode';
import ImageNode from '@/components/nodes/ImageNode';
import TextNode from '@/components/nodes/TextNode';
import ArticleNode from '@/components/nodes/ArticleNode';
import StringEdge from '@/components/edges/StringEdge';
import BoardSettingsModal from '@/components/dashboard/BoardSettingsModal';
import ContributionModal from '@/components/dashboard/ContributionModal';
import ProgressBar from '@/components/ui/ProgressBar';



const nodeTypes = {
    sticky: StickyNoteNode,
    image: ImageNode,
    text: TextNode,
    article: ArticleNode,
};

const Board = () => {
    const params = useParams();
    const router = useRouter();
    const boardId = params?.id as string;
    const { data: session } = useSession();
    const { user: userProfile, rank } = useUser();

    const [saving, setSaving] = useState(false);
    const [isBoardLoading, setIsBoardLoading] = useState(true);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isContributionsOpen, setIsContributionsOpen] = useState(false);

    // Ownership & Permissions
    const [boardOwnerId, setBoardOwnerId] = useState<string | null>(null);
    const [pendingContributionCount, setPendingContributionCount] = useState(0);

    const nodes = useStore((state) => state.nodes);
    const edges = useStore((state) => state.edges);
    const onNodesChange = useStore((state) => state.onNodesChange);
    const onEdgesChange = useStore((state) => state.onEdgesChange);
    const onConnect = useStore((state) => state.onConnect);
    const theme = useStore((state) => state.theme);
    const connectMode = useStore((state) => state.connectMode);
    const sourceNodeId = useStore((state) => state.sourceNodeId);
    const setSourceNodeId = useStore((state) => state.setSourceNodeId);
    const setEdges = useStore((state) => state.setEdges);
    const setNodes = useStore((state) => state.setNodes);
    const setBoardMetadata = useStore((state) => state.setBoardMetadata);
    const boardTitle = useStore((state) => state.boardTitle);
    const parentId = useStore((state) => state.parentId);

    // Determine read-only status based on session and board ownership
    // If board is loading, default to false to avoid flash. If board loaded and user doesn't match owner, read-only.
    // NOTE: In a real app, we'd also check collaborator list. Board owner ID is sufficient for "User B vs A".
    const isReadOnly = useMemo(() => {
        if (!boardOwnerId || !session?.user?.id) return false; // Optimistic or waiting
        // Actually, if no session, it SHOULD be read-only if public.
        // But let's assume if (!session) -> readOnly = true (for public viewers).
        if (!session.user) return true;
        return session.user.id !== boardOwnerId;
    }, [boardOwnerId, session]);

    const edgeTypes = useMemo(
        () => ({
            default: StringEdge,
            string: StringEdge,
        }),
        []
    );

    const fetchBoard = async () => {
        setIsBoardLoading(true);
        try {
            const res = await fetch(`/api/boards/${boardId}`);
            if (res.ok) {
                const data = await res.json();
                if (data.content) {
                    setNodes(data.content.nodes || []);
                    setEdges(data.content.edges || []);
                }
                setBoardMetadata(data.title, data.isPublic, data.parentId);
                setBoardOwnerId(data.userId);

                // Fetch pending notifications if owner
                if (session?.user?.id === data.userId) {
                    const contribRes = await fetch(`/api/contributions?boardId=${boardId}`);
                    if (contribRes.ok) {
                        const contribs = await contribRes.json();
                        setPendingContributionCount(contribs.filter((c: any) => c.status === 'open').length);
                    }
                }
            }
        } catch (error) {
            console.error('Failed to load board:', error);
        } finally {
            // Slight delay for aesthetic effect / smooth transition
            setTimeout(() => setIsBoardLoading(false), 800);
        }
    };

    useEffect(() => {
        if (boardId) {
            fetchBoard();
        }
    }, [boardId]);

    const onNodeClick = (event: MouseEvent, node: Node) => {
        if (!connectMode) return;

        if (!sourceNodeId) {
            setSourceNodeId(node.id);
        } else {
            if (sourceNodeId === node.id) {
                setSourceNodeId(null);
            } else {
                const newEdge = {
                    id: `e-${sourceNodeId}-${node.id}-${Date.now()}`,
                    source: sourceNodeId,
                    target: node.id,
                    type: 'string',
                    sourceHandle: 'source',
                    targetHandle: 'target',
                };
                setEdges(addEdge(newEdge, edges));
                setSourceNodeId(null);
            }
        }
    };

    const handleSave = async () => {
        if (!boardId) return;
        setSaving(true);
        try {
            const content = { nodes, edges };
            const res = await fetch(`/api/boards/${boardId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content }),
            });

            if (res.ok) {
                setLastSaved(new Date());
            } else {
                console.error('Failed to save');
            }
        } catch (error) {
            console.error('Save error:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleFork = async () => {
        setSaving(true);
        try {
            const content = { nodes, edges };
            const res = await fetch('/api/boards', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: `Copy of ${boardTitle}`,
                    isPublic: false,
                    parentId: boardId,
                    content
                }),
            });

            if (res.ok) {
                const data = await res.json();
                router.push(`/board/${data.id}`);
            }
        } catch (error) {
            console.error('Fork error:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleShare = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            // Quick visual feedback
            const prevTitle = document.title;
            document.title = "Link Copied!";
            setTimeout(() => document.title = prevTitle, 2000);

            // Should ideally use a toast here
            toast.success("Board link copied to clipboard!");
        } catch (err) {
            console.error('Failed to copy keys/url', err);
            toast.error("Failed to copy link");
        }
    };

    const handleSuggestChanges = async () => {
        if (!parentId) return;
        setSaving(true);
        try {
            const snapshot = { nodes, edges };
            const res = await fetch('/api/contributions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    targetBoardId: parentId,
                    message: `Suggestion from ${boardTitle}`,
                    snapshot
                }),
            });

            if (res.ok) {
                toast.success("Suggestion sent!");
            } else {
                console.error("Failed to send suggestion");
                toast.error("Failed to send suggestion");
            }
        } catch (error) {
            console.error('Suggestion error:', error);
            toast.error("An error occurred");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className={`w-screen h-screen ${theme} ${connectMode ? 'cursor-crosshair' : ''} relative`}>
            {/* Initial Case Loading Overlay */}
            {isBoardLoading && (
                <div className="fixed inset-0 z-[100] bg-stone-950 flex flex-col items-center justify-center gap-6 p-8">
                    <div className="max-w-md w-full flex flex-col items-center gap-4 text-center">
                        <div className="w-16 h-16 bg-stone-900 rounded-full flex items-center justify-center border border-stone-800 animate-pulse mb-2">
                            <RefreshCcw className="w-8 h-8 text-amber-500 animate-[spin_3s_linear_infinite]" />
                        </div>
                        <h2 className="text-2xl font-serif font-bold text-amber-500 tracking-tight uppercase">
                            Reconstructing Case Evidence
                        </h2>
                        <p className="text-stone-500 text-sm font-mono uppercase tracking-widest max-w-[250px]">
                            Retrieving files from central archive...
                        </p>
                        <ProgressBar isIndeterminate label="Syncing Board..." className="max-w-[200px] mt-4" />
                    </div>
                </div>
            )}

            {/* Read-Only Banner */}
            {isReadOnly && !isBoardLoading && (
                <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-amber-900/90 text-amber-100 px-6 py-3 rounded-lg shadow-2xl border border-amber-700/50 backdrop-blur-md flex items-center gap-4">
                    <div className="flex flex-col">
                        <span className="font-bold text-sm uppercase tracking-wider flex items-center gap-2">
                            <Eye className="w-4 h-4" /> Archived Evidence (Read Only)
                        </span>
                        <span className="text-xs opacity-80">You are viewing a secure file. Fork it to add your own evidence.</span>
                    </div>
                    <button
                        onClick={handleFork}
                        className="px-4 py-2 bg-stone-900 hover:bg-black text-white rounded font-bold text-xs uppercase tracking-widest border border-stone-700 transition-colors"
                    >
                        Fork Case
                    </button>
                </div>
            )}

            <BoardSettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                boardId={boardId}
            />
            <ContributionModal
                isOpen={isContributionsOpen}
                onClose={() => setIsContributionsOpen(false)}
                boardId={boardId}
                onMergeSuccess={fetchBoard}
                isReadOnly={isReadOnly}
            />

            {/* Top Bar Actions */}
            <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
                {!isReadOnly && (
                    <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-lg p-1 flex items-center gap-1 text-xs font-mono text-stone-400 mr-2">
                        {saving ? (
                            <div className="flex items-center gap-2 px-2">
                                <ProgressBar isIndeterminate label="Saving Evidence..." className="max-w-[150px]" />
                            </div>
                        ) : lastSaved ? (
                            <span className="flex items-center gap-1 px-2 text-green-400"><Check className="w-3 h-3" /> Saved {lastSaved.toLocaleTimeString()}</span>
                        ) : (
                            <span className="px-2">Unsaved changes</span>
                        )}
                    </div>
                )}

                {/* User Badge - Only show when not read-only to avoid clutter for public viewers, or maybe always show? 
                    Let's show it always if authenticated, as it's the user's identity. 
                */}
                {userProfile && !isBoardLoading && (
                    <div className="mr-4 hidden sm:block">
                        <UserBadge user={userProfile} rank={rank} size="sm" showName={false} showRank={false} />
                    </div>
                )}

                <div className="bg-stone-900/80 backdrop-blur text-stone-300 px-3 py-2 rounded-lg border border-stone-800 mr-2 text-sm font-bold">
                    {boardTitle}
                </div>

                <button
                    onClick={fetchBoard}
                    className="p-2 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-lg border border-stone-700 transition-colors mr-2"
                    title="Refresh Board"
                >
                    <RefreshCcw className="w-4 h-4" />
                </button>

                {!isReadOnly && (
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold shadow-lg transition-colors disabled:opacity-50"
                        title="Save Board"
                    >
                        <Save className="w-4 h-4" />
                        Save
                    </button>
                )}

                <button
                    onClick={handleFork}
                    disabled={saving}
                    className="p-2 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-lg border border-stone-700 transition-colors"
                    title="Fork Board"
                    aria-label="Fork Board"
                >
                    <GitFork className="w-5 h-5" />
                </button>

                {parentId && !isReadOnly && (
                    <button
                        onClick={handleSuggestChanges}
                        disabled={saving}
                        className="p-2 bg-purple-900/50 hover:bg-purple-900/80 text-purple-200 rounded-lg border border-purple-700 transition-colors"
                        title="Suggest Changes"
                        aria-label="Suggest Changes"
                    >
                        <GitPullRequest className="w-5 h-5" />
                    </button>
                )}

                {!parentId && (
                    <button
                        onClick={() => setIsContributionsOpen(true)}
                        className="p-2 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-lg border border-stone-700 transition-colors relative"
                        title="Review Suggestions"
                        aria-label="Review Suggestions"
                    >
                        <GitPullRequest className="w-5 h-5 rotate-180" />
                        {pendingContributionCount > 0 && (
                            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white font-bold animate-pulse">
                                {pendingContributionCount}
                            </span>
                        )}
                    </button>
                )}

                {!isReadOnly && (
                    <button
                        onClick={() => setIsSettingsOpen(true)}
                        className="p-2 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-lg border border-stone-700 transition-colors"
                        title="Settings"
                        aria-label="Settings"
                    >
                        <Settings className="w-5 h-5" />
                    </button>
                )}

                <button
                    onClick={handleShare}
                    className="p-2 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-lg border border-stone-700 transition-colors"
                    title="Share"
                    aria-label="Share"
                >
                    <Share2 className="w-5 h-5" />
                </button>
            </div>

            <ReactFlow
                nodes={nodes.map(n => ({ ...n, data: { ...n.data, isReadOnly } }))}
                edges={edges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                defaultEdgeOptions={{ type: 'string', animated: false }}
                onNodesChange={!isReadOnly ? onNodesChange : undefined}
                onEdgesChange={!isReadOnly ? onEdgesChange : undefined}
                onConnect={!isReadOnly ? onConnect : undefined}
                onNodeClick={onNodeClick}
                nodesDraggable={!isReadOnly}
                nodesConnectable={!isReadOnly && !connectMode}
                elementsSelectable={true}
                panOnDrag={true}
                zoomOnScroll={true}
                fitView
            >
                <Background
                    variant={BackgroundVariant.Dots}
                    gap={20}
                    size={1}
                    color="var(--foreground)"
                    className="opacity-20"
                />
                <Controls />
                <MiniMap />
                <Toolbar isReadOnly={isReadOnly} />
            </ReactFlow>
        </div >
    );
};

export default Board;
