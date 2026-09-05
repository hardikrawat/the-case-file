'use client';

import React, { useMemo, useState, useEffect, useCallback, useRef, type MouseEvent } from 'react';
import ReactFlow, {
    Background,
    Controls,
    MiniMap,
    BackgroundVariant,
    addEdge,
    Node,
    type ReactFlowInstance,
} from 'reactflow';

import 'reactflow/dist/style.css';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    Save,
    Settings,
    Share2,
    Check,
    GitFork,
    GitPullRequest,
    RefreshCcw,
    Eye,
    MessageSquare,
    Users,
    History,
    Download,
    AlertTriangle,
    ArrowLeft,
    LayoutGrid,
    Map,
    Edit3,
    X,
} from 'lucide-react';
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
import LinkNode from '@/components/nodes/LinkNode';
import StringEdge from '@/components/edges/StringEdge';
import BoardSettingsModal from '@/components/dashboard/BoardSettingsModal';
import ContributionModal from '@/components/dashboard/ContributionModal';
import AppleSpinner from '@/components/ui/AppleSpinner';

import { CommentsPanel } from '@/components/CommentsPanel';
import { CollaboratorsPanel } from '@/components/CollaboratorsPanel';
import { VersionHistory } from '@/components/VersionHistory';
import { ExportModal } from '@/components/ExportModal';

// Bug 4: Context for isReadOnly to avoid perf-killing .map() in render
import { IsReadOnlyContext, useIsReadOnly } from '@/context/ReadOnlyContext';
export { IsReadOnlyContext, useIsReadOnly };

const nodeTypes = {
    sticky: StickyNoteNode,
    image: ImageNode,
    text: TextNode,
    article: ArticleNode,
    link: LinkNode,
};

// Bug 198: Memoize edge options outside component
const defaultEdgeOpts = { type: 'string', animated: false };

type SaveStatus = 'idle' | 'saved' | 'saving' | 'unsaved' | 'conflict' | 'error'; // Bug 140: Added 'idle'

// Bug 5: Helper to strip ephemeral ReactFlow props before saving
const EPHEMERAL_NODE_KEYS = new Set(['selected', 'dragging', 'resizing', 'width', 'height', 'positionAbsolute']);
function stripEphemeralProps(nodes: Node[]): Node[] {
    return nodes.map(n => {
        const cleaned = { ...n };
        for (const key of EPHEMERAL_NODE_KEYS) {
            delete (cleaned as Record<string, unknown>)[key];
        }
        return cleaned;
    });
}

// Helper to access store methods safely even if useStore is mocked in test environment
const safeGetState = () => {
    if (typeof useStore.getState === 'function') {
        return useStore.getState();
    }
    return {
        loadBoard: () => {},
        resetBoard: () => {},
        setBoardVersion: () => {},
        deleteNode: () => {},
        deleteEdge: () => {},
        autoSaveEnabled: true,
        autoSaveDelay: 2000,
        snapToGrid: false,
        gridSize: 20,
        canvasBackground: 'dots' as const,
        warnOnUnsavedChanges: true,
        zoomOnScroll: true,
        panOnDrag: true,
        showMiniMapDefault: true,
    };
};

const Board = () => {
    const params = useParams();
    const router = useRouter();
    // Bug 151: Safe cast with fallback
    const boardId = typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params.id[0] : '';
    const { data: session } = useSession();
    const { user: userProfile, rank } = useUser();

    // Board container ref for canvas element export
    const boardContainerRef = useRef<HTMLDivElement>(null);

    // Save & Version Status
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle'); // Bug 140: Start with 'idle'
    const [saving, setSaving] = useState(false);
    const [isForking, setIsForking] = useState(false); // Bug 65: Separate fork state
    const [isSuggesting, setIsSuggesting] = useState(false); // Bug 65: Separate suggest state
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [isBoardLoading, setIsBoardLoading] = useState(true);
    const [conflictInfo, setConflictInfo] = useState<{ message: string; serverVersion?: number } | null>(null);

    const currentVersionRef = useRef<number>(1);
    const isLoadedRef = useRef<boolean>(false);
    const lastSavedSnapshotRef = useRef<string>('');
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const isSavingRef = useRef<boolean>(false);
    // Bug 2: Pending save queue
    const pendingSaveRef = useRef<boolean>(false);
    // Bug 12: Abort controllers
    const fetchAbortRef = useRef<AbortController | null>(null);
    const saveAbortRef = useRef<AbortController | null>(null);

    // Automated Checkpoints state tracking (bulk clue mutations or 30-second sustained edit bursts)
    const lastCheckpointNodesCountRef = useRef<number>(0);
    const burstStartTimeRef = useRef<number>(Date.now());
    const lastCheckpointTimeRef = useRef<number>(Date.now());

    // Modal & Panel visibility states
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isContributionsOpen, setIsContributionsOpen] = useState(false);
    const [isCommentsOpen, setIsCommentsOpen] = useState(false);
    const [isCollaboratorsOpen, setIsCollaboratorsOpen] = useState(false);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [isExportOpen, setIsExportOpen] = useState(false);
    const [showMiniMap, setShowMiniMap] = useState(() => safeGetState().showMiniMapDefault ?? false);
    const rfInstanceRef = useRef<ReactFlowInstance | null>(null);

    // Ownership & Permissions
    const [boardOwnerId, setBoardOwnerId] = useState<string | null>(null);
    const [parentTitle, setParentTitle] = useState<string | null>(null);
    const [canEditBoard, setCanEditBoard] = useState(false); // Track canEdit from API
    const [isOwnerBoard, setIsOwnerBoard] = useState(false); // Track isOwner from API
    const [isOffline, setIsOffline] = useState(false);
    const [pendingContributionCount, setPendingContributionCount] = useState(0);

    // Inline Case Title Editing
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [titleDraft, setTitleDraft] = useState('');

    // Suggestion Composer Modal
    const [isSuggestModalOpen, setIsSuggestModalOpen] = useState(false);
    const [suggestMessage, setSuggestMessage] = useState('');

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
    const isPublicStore = useStore((state) => state.isPublic);
    const parentId = useStore((state) => state.parentId);

    // Canvas & Auto-Save Preferences
    const autoSaveEnabled = useStore((state) => state.autoSaveEnabled);
    const autoSaveDelay = useStore((state) => state.autoSaveDelay);
    const snapToGrid = useStore((state) => state.snapToGrid);
    const gridSize = useStore((state) => state.gridSize);
    const canvasBackground = useStore((state) => state.canvasBackground);
    const warnOnUnsavedChanges = useStore((state) => state.warnOnUnsavedChanges);
    const zoomOnScroll = useStore((state) => state.zoomOnScroll);
    const panOnDrag = useStore((state) => state.panOnDrag);

    const handleAutoArrange = useCallback(() => {
        if (nodes.length === 0) return;
        const cols = Math.max(2, Math.ceil(Math.sqrt(nodes.length * 1.4)));
        const colSpacing = 340;
        const rowSpacing = 280;
        const startX = 120;
        const startY = 120;

        const newNodes = nodes.map((node, index) => {
            const col = index % cols;
            const row = Math.floor(index / cols);
            return {
                ...node,
                position: {
                    x: startX + col * colSpacing + (row % 2 === 1 ? 25 : 0),
                    y: startY + row * rowSpacing,
                },
            };
        });

        setNodes(newNodes);
        toast.success('Evidence board organized');
        // Bug 175: Use requestAnimationFrame instead of setTimeout
        requestAnimationFrame(() => {
            if (rfInstanceRef.current) {
                rfInstanceRef.current.fitView({ padding: 0.25, duration: 400 });
            }
        });
    }, [nodes, setNodes]);

    // Unauthenticated users or non-authorized viewers MUST be read-only
    const isReadOnly = useMemo(() => {
        if (!session?.user?.id) return true; // Unauthenticated = read-only
        if (!boardOwnerId) return true; // Board not loaded yet = read-only
        if (canEditBoard || isOwnerBoard) return false; // Authorized editor or owner
        return session.user.id !== boardOwnerId;
    }, [boardOwnerId, session?.user?.id, canEditBoard, isOwnerBoard]);

    const edgeTypes = useMemo(
        () => ({
            default: StringEdge,
            string: StringEdge,
        }),
        []
    );

    // Bug 27: Create snapshot that strips ephemeral props for comparison
    const createCleanSnapshot = useCallback((n: Node[], e: typeof edges) => {
        const cleanNodes = stripEphemeralProps(n);
        return JSON.stringify({ nodes: cleanNodes, edges: e });
    }, []);

    // Fetch Board from server
    const fetchBoard = useCallback(async () => {
        // Bug 12: Abort previous fetch
        if (fetchAbortRef.current) {
            fetchAbortRef.current.abort();
        }
        const controller = new AbortController();
        fetchAbortRef.current = controller;

        setIsBoardLoading(true);
        try {
            const res = await fetch(`/api/boards/${boardId}`, { signal: controller.signal });
            // Bug 8 (fetchBoard): Check if still mounted/relevant
            if (controller.signal.aborted) return;

            if (res.ok) {
                const data = await res.json();
                const content = data.content || {};
                const loadedNodes = Array.isArray(content.nodes) ? content.nodes : [];
                const loadedEdges = Array.isArray(content.edges) ? content.edges : [];
                const boardVer = typeof data.version === 'number' ? data.version : 1;

                const storeState = safeGetState();
                if (typeof storeState.loadBoard === 'function') {
                    storeState.loadBoard(boardId, loadedNodes, loadedEdges, {
                        title: data.title || 'Untitled Case',
                        isPublic: Boolean(data.isPublic),
                        parentId: data.parentId || null,
                        version: boardVer,
                    });
                } else {
                    setNodes(loadedNodes);
                    setEdges(loadedEdges);
                    setBoardMetadata(data.title || 'Untitled Case', Boolean(data.isPublic), data.parentId || null);
                }

                currentVersionRef.current = boardVer;
                lastSavedSnapshotRef.current = createCleanSnapshot(loadedNodes, loadedEdges);
                setBoardOwnerId(data.userId);
                setParentTitle(data.parentTitle || null);
                const isOwner = data.userId === session?.user?.id || Boolean(data.isOwner);
                setIsOwnerBoard(isOwner);
                setCanEditBoard(isOwner || Boolean(data.canEdit));
                setSaveStatus('saved');
                setConflictInfo(null);
                isLoadedRef.current = true;
                // Initialize lastSaved with board's updatedAt
                if (data.updatedAt) {
                    setLastSaved(new Date(data.updatedAt));
                }

                // Fetch pending contributions if user can edit (owner or editor)
                if (session?.user?.id && (isOwner || Boolean(data.canEdit))) {
                    try {
                        const contribRes = await fetch(`/api/contributions?boardId=${boardId}`, { signal: controller.signal });
                        if (contribRes.ok) {
                            const contribs = await contribRes.json();
                            setPendingContributionCount(
                                (contribs as Record<string, unknown>[]).filter((c) => c.status === 'open').length
                            );
                        }
                    } catch {
                        // Non-critical, ignore
                    }
                }
            } else {
                // Bug 8 (silent failure): Show error on non-ok response
                toast.error('Failed to load board');
            }
        } catch (error) {
            if ((error as Error).name === 'AbortError') return;
            console.error('Failed to load board:', error);
            toast.error('Failed to load board');
        } finally {
            setIsBoardLoading(false);
        }
    }, [boardId, session?.user?.id, setNodes, setEdges, setBoardMetadata, createCleanSnapshot]);

    // Route change and unmount lifecycle: guarantee zero evidence leak
    useEffect(() => {
        if (!boardId) return;

        safeGetState().resetBoard?.();
        isLoadedRef.current = false;
        setIsBoardLoading(true);
        setSaveStatus('idle');
        setConflictInfo(null);

        fetchBoard();

        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
            // Bug 12: Abort in-flight fetches
            if (fetchAbortRef.current) {
                fetchAbortRef.current.abort();
            }
            if (saveAbortRef.current) {
                saveAbortRef.current.abort();
            }
            safeGetState().resetBoard?.();
            isLoadedRef.current = false;
            // Bug 85: Null ref on unmount
            rfInstanceRef.current = null;
        };
    }, [boardId, fetchBoard]);

    // Bug 3: beforeunload handler for unsaved changes (respects warnOnUnsavedChanges)
    useEffect(() => {
        if (!warnOnUnsavedChanges) return;
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (saveStatus === 'unsaved' || isSavingRef.current) {
                e.preventDefault();
                e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [saveStatus, warnOnUnsavedChanges]);

    // Node click handler for connect mode
    const onNodeClick = (event: MouseEvent, node: Node) => {
        // Bug 10: Block connect mode in read-only
        if (isReadOnly) return;
        if (!connectMode) return;

        if (!sourceNodeId) {
            setSourceNodeId(node.id);
        } else {
            if (sourceNodeId === node.id) {
                setSourceNodeId(null);
            } else {
                // Bug 18: Fix stale closure - use store.getState() for current edges
                const currentEdges = useStore.getState().edges;
                const newEdge = {
                    id: `e-${sourceNodeId}-${node.id}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, // Bug 158: Unique ID
                    source: sourceNodeId,
                    target: node.id,
                    type: 'string',
                    sourceHandle: 'source',
                    targetHandle: 'target',
                };
                setEdges(addEdge(newEdge, currentEdges));
                setSourceNodeId(null);
            }
        }
    };

    // Core save executor supporting optimistic locking
    const performSave = useCallback(
        async (isManual = false) => {
            if (!boardId || isReadOnly || isOffline) return;

            // If already saving, mark pending instead of dropping
            if (isSavingRef.current) {
                if (isManual) {
                    pendingSaveRef.current = true;
                }
                return;
            }

            // Strip ephemeral props before comparing/saving
            const cleanNodes = stripEphemeralProps(nodes);
            const currentSnapshot = createCleanSnapshot(nodes, edges);
            if (!isManual && currentSnapshot === lastSavedSnapshotRef.current) {
                return;
            }

            isSavingRef.current = true;
            setSaving(true);
            setSaveStatus('saving');

            // Abort controller for save
            if (saveAbortRef.current) {
                saveAbortRef.current.abort();
            }
            const controller = new AbortController();
            saveAbortRef.current = controller;

            try {
                const versionToSend = currentVersionRef.current;
                const res = await fetch(`/api/boards/${boardId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        content: { nodes: cleanNodes, edges }, // Clean nodes
                        version: versionToSend,
                        title: boardTitle,
                        isPublic: isPublicStore,
                    }),
                    signal: controller.signal,
                });

                if (res.status === 200) {
                    const data = await res.json();
                    const newVersion = data.version ?? versionToSend + 1;
                    currentVersionRef.current = newVersion;
                    safeGetState().setBoardVersion?.(newVersion);
                    lastSavedSnapshotRef.current = currentSnapshot;
                    setLastSaved(new Date());
                    setSaveStatus('saved');
                    setConflictInfo(null);
                } else if (res.status === 409) {
                    const errData = await res.json().catch(() => ({}));
                    setSaveStatus('conflict');
                    setConflictInfo({
                        message: errData.error || 'Conflict detected: This case has been modified by another detective.',
                        serverVersion: errData.currentVersion,
                    });
                    toast.error('Conflict detected: This case has been modified by another detective.', {
                        duration: 8000,
                    });
                } else {
                    setSaveStatus('error');
                    toast.error('Failed to save case file');
                }
            } catch (error) {
                if ((error as Error).name === 'AbortError') return;
                console.error('Save error:', error);
                setSaveStatus('error');
                toast.error('Network error saving case file');
            } finally {
                isSavingRef.current = false;
                setSaving(false);

                // Process pending save
                if (pendingSaveRef.current) {
                    pendingSaveRef.current = false;
                    setTimeout(() => performSave(true), 100);
                }
            }
        },
        [boardId, isReadOnly, isOffline, nodes, edges, boardTitle, isPublicStore, createCleanSnapshot]
    );

    // Debounced Auto-Save (configurable delay after canvas change)
    useEffect(() => {
        if (!isLoadedRef.current || isReadOnly || !boardId || isOffline) return;

        // Use clean snapshot that ignores selection/dragging
        const currentSnapshot = createCleanSnapshot(nodes, edges);
        if (currentSnapshot === lastSavedSnapshotRef.current) return;

        setSaveStatus('unsaved');

        // If autoSave is disabled by user in Settings, clear timer and do not perform automatic save
        if (!autoSaveEnabled) {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
                debounceTimerRef.current = null;
            }
            return;
        }

        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(() => {
            performSave(false);
        }, autoSaveDelay || 2000);

        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, [nodes, edges, isReadOnly, isOffline, boardId, performSave, createCleanSnapshot, autoSaveEnabled, autoSaveDelay]);

    // Automated Checkpoints: Auto-creates snapshot checkpoints upon major structural mutations
    // (bulk clue additions/deletions >= 3 or 30-second sustained edit bursts)
    useEffect(() => {
        if (!isLoadedRef.current || isReadOnly || !boardId || isOffline) return;
        if (nodes.length === 0) return;

        // Initialize baseline on first load
        if (lastCheckpointNodesCountRef.current === 0) {
            lastCheckpointNodesCountRef.current = nodes.length;
            burstStartTimeRef.current = Date.now();
            lastCheckpointTimeRef.current = Date.now();
            return;
        }

        const now = Date.now();
        const nodeCountDiff = Math.abs(nodes.length - lastCheckpointNodesCountRef.current);
        const timeSinceLastCheckpoint = now - lastCheckpointTimeRef.current;
        const burstDuration = now - burstStartTimeRef.current;

        const isBulkMutation = nodeCountDiff >= 3;
        const isSustainedBurst = burstDuration >= 30000 && timeSinceLastCheckpoint >= 30000;

        if (isBulkMutation || isSustainedBurst) {
            lastCheckpointNodesCountRef.current = nodes.length;
            lastCheckpointTimeRef.current = now;
            burstStartTimeRef.current = now;

            const cleanNodes = stripEphemeralProps(nodes);
            const notes = isBulkMutation
                ? `Automated Checkpoint: Bulk clue update (${nodes.length} clues)`
                : `Automated Checkpoint: Sustained 30s investigation edit burst`;

            fetch(`/api/boards/${boardId}/versions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: { nodes: cleanNodes, edges },
                    notes,
                    isManual: false,
                }),
            }).catch((err) => {
                console.warn('Automated checkpoint snapshot skipped:', err);
            });
        }
    }, [nodes, edges, boardId, isReadOnly, isOffline, stripEphemeralProps]);

    // Synchronize title draft with boardTitle
    useEffect(() => {
        if (!isEditingTitle) {
            setTitleDraft(boardTitle);
        }
    }, [boardTitle, isEditingTitle]);

    const handleTitleSubmit = async () => {
        setIsEditingTitle(false);
        const trimmed = titleDraft.trim();
        if (!trimmed || trimmed === boardTitle) {
            setTitleDraft(boardTitle);
            return;
        }
        if (trimmed.length > 120) {
            toast.error('Case title cannot exceed 120 characters');
            setTitleDraft(boardTitle);
            return;
        }
        setBoardMetadata(trimmed, isPublicStore, parentId);
        performSave(true);
    };

    // Prevent losing unsaved changes when clicking internal links (respects warnOnUnsavedChanges)
    const handleNavCheck = (e: React.MouseEvent) => {
        if (warnOnUnsavedChanges && saveStatus === 'unsaved') {
            if (!confirm('You have unsaved changes on this case file. Leaving now will discard them. Are you sure you want to proceed?')) {
                e.preventDefault();
            }
        }
    };

    const handleSave = () => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = null;
        }
        performSave(true);
    };

    // Offline / Online network listeners
    useEffect(() => {
        const handleOnline = () => {
            setIsOffline(false);
            toast.success('Connection restored.');
        };
        const handleOffline = () => {
            setIsOffline(true);
            toast.warning('Offline: Auto-save is paused until reconnected.');
        };
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Global keyboard shortcuts: Undo (Cmd/Ctrl+Z), Redo (Cmd/Ctrl+Shift+Z, Cmd/Ctrl+Y), Save (Cmd/Ctrl+S), Escape
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const activeEl = document.activeElement;
            const isTyping = activeEl && (
                activeEl.tagName === 'INPUT' ||
                activeEl.tagName === 'TEXTAREA' ||
                (activeEl as HTMLElement).isContentEditable
            );

            // Undo: Cmd+Z or Ctrl+Z
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
                if (!isTyping && !isReadOnly) {
                    e.preventDefault();
                    useStore.getState().undo();
                    toast.info('Undo canvas action', { duration: 1200 });
                }
            }

            // Redo: Cmd+Shift+Z or Ctrl+Shift+Z / Ctrl+Y
            if (
                ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'z') ||
                ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y')
            ) {
                if (!isTyping && !isReadOnly) {
                    e.preventDefault();
                    useStore.getState().redo();
                    toast.info('Redo canvas action', { duration: 1200 });
                }
            }

            // Save: Cmd+S / Ctrl+S
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
                e.preventDefault();
                if (!isReadOnly) {
                    performSave(true);
                }
            }

            // Escape: Cancel connect mode
            if (e.key === 'Escape') {
                if (connectMode) {
                    useStore.getState().toggleConnectMode();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isReadOnly, connectMode, performSave]);

    const handleFork = async () => {
        // Bug 83: Save current changes before forking
        if (saveStatus === 'unsaved') {
            await performSave(true);
        }
        setIsForking(true); // Bug 65: Separate state
        try {
            const cleanNodes = stripEphemeralProps(nodes);
            const content = { nodes: cleanNodes, edges };
            // Bug 170: Truncate fork title
            const forkTitle = `Fork of ${boardTitle}`.slice(0, 100);
            const res = await fetch('/api/boards', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: forkTitle,
                    content,
                    parentId: boardId,
                    isPublic: false,
                }),
            });

            if (res.ok) {
                const data = await res.json();
                toast.success('Board forked successfully!');
                router.push(`/board/${data.id}`);
            } else {
                toast.error('Failed to fork board');
            }
        } catch (error) {
            console.error('Fork error:', error);
            toast.error('Failed to fork board');
        } finally {
            setIsForking(false);
        }
    };

    const handleOpenSuggestModal = () => {
        if (!parentId) return;
        setSuggestMessage(`Investigation suggestions from ${boardTitle}`);
        setIsSuggestModalOpen(true);
    };

    const handleConfirmSuggestChanges = async () => {
        if (!parentId) return;
        if (saveStatus === 'unsaved') {
            await performSave(true);
        }
        setIsSuggesting(true);
        try {
            const cleanNodes = stripEphemeralProps(nodes);
            const res = await fetch('/api/contributions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    targetBoardId: parentId,
                    message: suggestMessage.trim() || `Suggestions from ${boardTitle}`,
                    snapshot: { nodes: cleanNodes, edges },
                }),
            });

            if (res.ok) {
                toast.success('Suggestions transmitted to the parent case dossier!');
                setIsSuggestModalOpen(false);
            } else {
                const data = await res.json().catch(() => ({}));
                toast.error(data.error || 'Failed to submit suggestions');
            }
        } catch (error) {
            console.error('Suggest error:', error);
            toast.error('Failed to submit suggestions');
        } finally {
            setIsSuggesting(false);
        }
    };

    const handleShare = async () => {
        // Bug 88: Warn if board is private
        if (!isPublicStore) {
            toast.warning('This board is private. Recipients will need access to view it.');
        }
        // Bug 64/195: Proper clipboard API handling with fallback
        try {
            if (navigator.share) {
                await navigator.share({ title: boardTitle, url: window.location.href });
            } else {
                await navigator.clipboard.writeText(window.location.href);
                toast.success('Investigation link copied to clipboard!');
            }
        } catch {
            // Fallback for non-HTTPS or unsupported
            try {
                const input = document.createElement('input');
                input.value = window.location.href;
                document.body.appendChild(input);
                input.select();
                document.execCommand('copy');
                document.body.removeChild(input);
                toast.success('Investigation link copied to clipboard!');
            } catch {
                toast.error('Failed to copy link');
            }
        }
    };

    const handleRestoreVersion = async (content: Record<string, unknown> | string) => {
        if (isReadOnly || isSavingRef.current) return;

        // Clear debounced auto-save timer to prevent save collision
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = null;
        }

        isSavingRef.current = true;
        setSaving(true);
        setSaveStatus('saving');

        const previousNodes = [...nodes];
        const previousEdges = [...edges];

        try {
            let parsed = content;
            if (typeof content === 'string') {
                try {
                    parsed = JSON.parse(content);
                } catch {
                    toast.error('Failed to parse version snapshot content');
                    setSaveStatus('error');
                    return;
                }
            }
            if (parsed && typeof parsed === 'object') {
                const boardContent = parsed as { nodes?: Node[]; edges?: unknown[] };
                const targetNodes = Array.isArray(boardContent.nodes) ? stripEphemeralProps(boardContent.nodes) : [];
                const targetEdges = Array.isArray(boardContent.edges) ? (boardContent.edges as typeof edges) : [];

                // 1. Create a pre-restore safety snapshot so detective work is never permanently lost
                try {
                    await fetch(`/api/boards/${boardId}/versions`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            content: { 
                                nodes: stripEphemeralProps(previousNodes), 
                                edges: previousEdges,
                                _metadata: {
                                    notes: 'Automatic safety backup before rollback',
                                    isManual: false,
                                }
                            },
                        }),
                    });
                } catch (snapshotErr) {
                    console.warn('Pre-restore backup snapshot warning:', snapshotErr);
                }

                // 2. Persist restored state to database with optimistic version lock
                const versionToSend = currentVersionRef.current;
                const res = await fetch(`/api/boards/${boardId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        content: { nodes: targetNodes, edges: targetEdges },
                        version: versionToSend,
                        title: boardTitle,
                        isPublic: isPublicStore,
                    }),
                });

                if (res.status === 200) {
                    const data = await res.json();
                    const newVersion = data.version ?? versionToSend + 1;
                    currentVersionRef.current = newVersion;
                    safeGetState().setBoardVersion?.(newVersion);

                    // Update canvas state
                    setNodes(targetNodes);
                    setEdges(targetEdges);
                    lastSavedSnapshotRef.current = createCleanSnapshot(targetNodes, targetEdges);
                    setLastSaved(new Date());
                    setSaveStatus('saved');
                    setConflictInfo(null);

                    // Re-fit canvas view so detective immediately sees restored layout
                    requestAnimationFrame(() => {
                        rfInstanceRef.current?.fitView({ padding: 0.25, duration: 400 });
                    });

                    toast.success('Investigation rolled back to snapshot successfully', {
                        action: {
                            label: 'Undo Rollback',
                            onClick: () => handleRestoreVersion({ nodes: previousNodes, edges: previousEdges }),
                        },
                        duration: 7000,
                    });
                } else if (res.status === 409) {
                    const errData = await res.json().catch(() => ({}));
                    setSaveStatus('conflict');
                    setConflictInfo({
                        message: errData.error || 'Conflict detected: Another detective modified this case.',
                        serverVersion: errData.currentVersion,
                    });
                    toast.error('Cannot restore: Case file has concurrent edits. Reload latest version first.');
                } else {
                    setSaveStatus('error');
                    toast.error('Failed to save restored version to server');
                }
            }
        } catch (err) {
            console.error('Failed to restore version:', err);
            setSaveStatus('error');
            toast.error('Failed to restore snapshot');
        } finally {
            isSavingRef.current = false;
            setSaving(false);
        }
    };

    // Bug 82: Callback to refresh contribution count after merge
    const handleContributionMerge = useCallback(() => {
        setPendingContributionCount(prev => Math.max(0, prev - 1));
        fetchBoard(); // Reload board after merge
    }, [fetchBoard]);

    // Bug 144: Close all panels helper
    const closeAllPanels = useCallback(() => {
        setIsCommentsOpen(false);
        setIsCollaboratorsOpen(false);
        setIsHistoryOpen(false);
    }, []);

    // Bug 122: Refresh with unsaved changes warning
    const handleRefresh = useCallback(() => {
        if (saveStatus === 'unsaved') {
            if (!confirm('You have unsaved changes. Refresh will discard them. Continue?')) {
                return;
            }
        }
        fetchBoard();
    }, [fetchBoard, saveStatus]);

    // Bug 162: Validate theme
    const validThemes = ['theme-cork', 'theme-noir', 'theme-blueprint', 'theme-minimal', 'theme-profile'];
    const safeTheme = validThemes.includes(theme) ? theme : 'theme-cork';

    return (
        // Bug 4: Wrap in IsReadOnlyContext.Provider
        <IsReadOnlyContext.Provider value={isReadOnly}>
            <div ref={boardContainerRef} className={`w-full h-full relative ${safeTheme}`}>
                {/* SVG Defs for Red String Yarn Texture Filter */}
                <svg className="absolute w-0 h-0 pointer-events-none" aria-hidden="true">
                    <defs>
                        <filter id="yarn-texture" x="-20%" y="-20%" width="140%" height="140%">
                            <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" result="noise" />
                            <feDisplacementMap in="SourceGraphic" in2="noise" scale="3" xChannelSelector="R" yChannelSelector="G" />
                        </filter>
                    </defs>
                </svg>

                {/* Connect Mode Guidance Pill */}
                {connectMode && (
                    <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 bg-red-950/95 border border-red-700 text-red-200 px-4 py-2 rounded-full shadow-2xl backdrop-blur-md flex items-center gap-2 text-xs font-mono animate-in fade-in slide-in-from-top-2">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                        <span>
                            {sourceNodeId
                                ? 'Clue selected. Click a second clue to link with red yarn.'
                                : 'Connect Mode: Click any clue to begin stringing yarn.'}
                        </span>
                        <button
                            onClick={() => useStore.getState().toggleConnectMode()}
                            className="ml-2 text-red-400 hover:text-white text-[10px] underline"
                        >
                            Cancel (Esc)
                        </button>
                    </div>
                )}

                {isBoardLoading && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md transition-all duration-300">
                        <div className="flex flex-col items-center gap-2.5 text-center animate-in fade-in duration-200">
                            <AppleSpinner size="lg" className="text-[var(--sidebar-accent)]" />
                            <p className="text-xs font-mono font-medium text-foreground tracking-wide">
                                Reconstructing Case Evidence...
                            </p>
                        </div>
                    </div>
                )}

                {/* 409 Conflict Banner */}
                {saveStatus === 'conflict' && conflictInfo && (
                    <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-red-950/95 text-red-100 px-6 py-4 rounded-xl shadow-2xl border border-red-700 backdrop-blur-md flex flex-col sm:flex-row items-center gap-4 sm:gap-6 max-w-xl w-[calc(100%-2rem)] animate-in fade-in slide-in-from-top-4 duration-300">
                        <div className="flex items-center gap-3">
                            <AlertTriangle className="w-6 h-6 text-red-400 shrink-0" />
                            <div className="flex flex-col">
                                <span className="font-bold text-sm tracking-wide text-red-200">
                                    CASE EVIDENCE CONFLICT
                                </span>
                                <span className="text-xs text-red-300/80">
                                    {conflictInfo.message} Auto-save paused to prevent overwriting evidence.
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <button
                                onClick={() => {
                                    const currentSnapshot = JSON.stringify({ nodes: stripEphemeralProps(nodes), edges });
                                    if (lastSavedSnapshotRef.current && currentSnapshot !== lastSavedSnapshotRef.current) {
                                        if (!confirm('Reloading will discard your unsaved clues on this canvas. Are you sure?')) {
                                            return;
                                        }
                                    }
                                    setConflictInfo(null);
                                    fetchBoard();
                                }}
                                className="px-3 py-1.5 bg-red-800 hover:bg-red-700 text-white rounded font-mono text-xs uppercase tracking-wider transition-colors border border-red-600"
                            >
                                Reload Latest
                            </button>
                            <button
                                onClick={async () => {
                                    // Force save by advancing to server version
                                    currentVersionRef.current = conflictInfo.serverVersion || (currentVersionRef.current + 1);
                                    setConflictInfo(null);
                                    setSaveStatus('unsaved');
                                    await performSave(true);
                                }}
                                className="px-3 py-1.5 bg-amber-800 hover:bg-amber-700 text-white rounded font-mono text-xs uppercase tracking-wider transition-colors border border-amber-600"
                            >
                                Force Save
                            </button>
                        </div>
                    </div>
                )}

                {/* Modal Dialogs */}
                <BoardSettingsModal
                    isOpen={isSettingsOpen}
                    onClose={() => setIsSettingsOpen(false)}
                    boardId={boardId}
                />

                <ContributionModal
                    isOpen={isContributionsOpen}
                    onClose={() => setIsContributionsOpen(false)}
                    boardId={boardId}
                    onMergeSuccess={handleContributionMerge} // Bug 82
                />

                {/* Panels (Controlled Mounting) */}
                <CommentsPanel
                    boardId={boardId}
                    isOpen={isCommentsOpen}
                    onClose={() => setIsCommentsOpen(false)}
                />

                <CollaboratorsPanel
                    boardId={boardId}
                    isOwner={!isReadOnly && isOwnerBoard}
                    isOpen={isCollaboratorsOpen}
                    onClose={() => setIsCollaboratorsOpen(false)}
                />

                <VersionHistory
                    boardId={boardId}
                    isOpen={isHistoryOpen}
                    onClose={() => setIsHistoryOpen(false)}
                    onRestore={handleRestoreVersion}
                    isReadOnly={isReadOnly}
                />

                <ExportModal
                    isOpen={isExportOpen}
                    onClose={() => setIsExportOpen(false)}
                    boardId={boardId}
                    boardData={{
                        id: boardId,
                        title: boardTitle,
                        nodes: stripEphemeralProps(nodes), // Bug 5: Clean nodes for export
                        edges,
                    }}
                    boardElement={boardContainerRef.current || undefined}
                />

                {/* Top Left Floating Header: Unified Case Dossier & Navigation Bar */}
                <div className="absolute top-3 left-3 z-30 flex items-center bg-[var(--panel-background)]/95 backdrop-blur-md border border-[var(--panel-border)] rounded-xl shadow-lg p-1.5 gap-2 max-w-[calc(100vw-24px)] md:max-w-[calc(100vw-540px)] pointer-events-auto">
                    {/* Navigation: Back to Cases */}
                    <Link
                        href="/cases"
                        onClick={handleNavCheck}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[var(--panel-foreground)]/80 hover:text-[var(--foreground)] hover:bg-[var(--sidebar-accent)]/15 transition-all shrink-0"
                        title="Back to Cases"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Cases</span>
                    </Link>

                    <div className="w-px h-4 bg-[var(--panel-border)] shrink-0" />

                    {/* Case Title & Lineage Group */}
                    <div className="flex items-center gap-2 min-w-0">
                        {!isReadOnly && isEditingTitle ? (
                            <div className="flex items-center shrink-0">
                                <input
                                    type="text"
                                    value={titleDraft}
                                    onChange={(e) => setTitleDraft(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleTitleSubmit();
                                        if (e.key === 'Escape') {
                                            setTitleDraft(boardTitle);
                                            setIsEditingTitle(false);
                                        }
                                    }}
                                    onBlur={handleTitleSubmit}
                                    autoFocus
                                    maxLength={120}
                                    className="bg-[var(--background)] border border-amber-500 rounded-md px-2 py-1 text-xs md:text-sm font-bold text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-amber-500 shadow-inner min-w-[120px] max-w-[200px]"
                                />
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => {
                                    if (!isReadOnly) {
                                        setTitleDraft(boardTitle);
                                        setIsEditingTitle(true);
                                    }
                                }}
                                disabled={isReadOnly}
                                className={`group flex items-center gap-1.5 px-2 py-1 rounded-md text-xs md:text-sm font-bold truncate max-w-[130px] sm:max-w-[180px] md:max-w-[240px] transition-colors ${
                                    !isReadOnly
                                        ? 'cursor-pointer text-[var(--foreground)] hover:bg-[var(--background)]/60'
                                        : 'text-[var(--panel-foreground)] cursor-default'
                                }`}
                                title={!isReadOnly ? `${boardTitle} (Click to rename case)` : boardTitle}
                            >
                                <span className="truncate">{boardTitle}</span>
                                {!isReadOnly && (
                                    <Edit3 className="w-3 h-3 text-[var(--panel-foreground)]/40 group-hover:text-amber-400 shrink-0 transition-colors" />
                                )}
                            </button>
                        )}

                        {/* Integrated Branch / Lineage Pill */}
                        {parentId && (
                            <Link
                                href={`/board/${parentId}`}
                                onClick={handleNavCheck}
                                className="inline-flex items-center gap-1.5 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md bg-purple-950/60 hover:bg-purple-900/70 border border-purple-800/60 text-purple-200 text-xs font-mono transition-colors shrink-0 shadow-sm group"
                                title={`Branch of parent dossier: ${parentTitle || `#${parentId.slice(0, 8)}`}`}
                            >
                                <GitFork className="w-3.5 h-3.5 text-purple-400 group-hover:text-purple-300 shrink-0" />
                                <span className="hidden sm:inline text-[11px] text-purple-300/80">from</span>
                                <strong className="text-purple-300 font-sans font-semibold underline underline-offset-2 truncate max-w-[90px] sm:max-w-[140px] lg:max-w-[180px]">
                                    {parentTitle || `#${parentId.slice(0, 8)}`}
                                </strong>
                            </Link>
                        )}

                        {/* Read-Only Pill */}
                        {isReadOnly && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-950/60 border border-amber-800/60 text-amber-300 text-[11px] font-mono shrink-0">
                                <Eye className="w-3 h-3" /> Read-Only
                            </span>
                        )}
                    </div>

                    <div className="w-px h-4 bg-[var(--panel-border)] shrink-0" />

                    {/* Auto-Save Status */}
                    {!isReadOnly && (
                        <div className="flex items-center px-1 text-xs font-mono shrink-0 gap-1.5">
                            {saveStatus === 'saving' ? (
                                <div className="flex items-center gap-1.5 text-[var(--sidebar-accent)]">
                                    <AppleSpinner size="xs" />
                                    <span className="text-[11px] font-medium">Saving...</span>
                                </div>
                            ) : saveStatus === 'conflict' ? (
                                <span className="flex items-center gap-1 text-red-400 font-bold text-[11px]">
                                    <AlertTriangle className="w-3 h-3 text-red-400" /> Conflict
                                </span>
                            ) : saveStatus === 'error' ? (
                                <span className="text-red-400 font-medium text-[11px]">Save Error</span>
                            ) : saveStatus === 'saved' && lastSaved ? (
                                <span className="flex items-center gap-1 text-emerald-400 text-[11px]">
                                    <Check className="w-3 h-3 text-emerald-400" />
                                    <span className="hidden md:inline">Saved</span> {lastSaved.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                </span>
                            ) : saveStatus === 'unsaved' ? (
                                <span className="text-amber-400 text-[11px] flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                                    Unsaved
                                </span>
                            ) : (
                                <span className="text-[var(--panel-foreground)]/60 text-[11px]">Ready</span>
                            )}

                            {!autoSaveEnabled && (
                                <span
                                    className="hidden sm:inline-block text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 font-sans border border-amber-500/30"
                                    title="Auto-save is disabled in Settings. Press Cmd/Ctrl+S or click Save button."
                                >
                                    Manual
                                </span>
                            )}
                        </div>
                    )}

                    {/* Detective Identity Badge */}
                    {session?.user && rank && userProfile && (
                        <>
                            <div className="w-px h-4 bg-[var(--panel-border)] shrink-0 hidden lg:block" />
                            <div className="hidden lg:flex items-center gap-2 pl-0.5 shrink-0">
                                <UserBadge user={userProfile} rank={rank} size="sm" />
                            </div>
                        </>
                    )}
                </div>

                {/* Top Right Floating Actions: Save, Arrange, Panels, Tools */}
                <div className="absolute top-3 right-3 z-30 flex items-center gap-1.5 md:gap-2 pointer-events-auto">
                    {!isReadOnly && (
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-sidebar-accent hover:bg-sidebar-accent/80 text-sidebar-accent-foreground rounded-lg text-xs md:text-sm font-bold shadow-md transition-all disabled:opacity-50"
                            title="Save Board"
                        >
                            {saving ? <AppleSpinner size="xs" /> : <Save className="w-4 h-4" />}
                            <span>{saving ? 'Saving...' : 'Save'}</span>
                        </button>
                    )}

                    {/* Bug 21: Hide auto-arrange for read-only */}
                    {!isReadOnly && (
                        <button
                            onClick={handleAutoArrange}
                            className="p-2 bg-[var(--panel-background)]/90 hover:bg-[var(--sidebar-accent)]/15 text-[var(--panel-foreground)] rounded-lg border border-[var(--panel-border)] transition-colors shadow-sm"
                            title="Auto-Arrange Nodes"
                            aria-label="Auto-Arrange Nodes"
                        >
                            <LayoutGrid className="w-4 h-4" />
                        </button>
                    )}

                    {/* Bug 87: Hide minimap toggle on mobile */}
                    <button
                        onClick={() => setShowMiniMap(!showMiniMap)}
                        className={`p-2 rounded-lg border transition-colors shadow-sm hidden sm:flex ${
                            showMiniMap
                                ? 'bg-[var(--sidebar-accent)] text-[var(--sidebar-accent-foreground)] border-[var(--sidebar-accent)]'
                                : 'bg-[var(--panel-background)]/90 hover:bg-[var(--sidebar-accent)]/15 text-[var(--panel-foreground)] border-[var(--panel-border)]'
                        }`}
                        title={showMiniMap ? 'Hide MiniMap' : 'Show MiniMap'}
                        aria-label="Toggle MiniMap"
                    >
                        <Map className="w-4 h-4" />
                    </button>

                    <div className="w-px h-5 bg-[var(--panel-border)] mx-0.5 hidden sm:block"></div>

                    {/* Comments Toggle */}
                    <button
                        onClick={() => {
                            const opening = !isCommentsOpen;
                            if (opening) closeAllPanels(); // Bug 144
                            setIsCommentsOpen(opening);
                        }}
                        className={`p-2 rounded-lg border transition-colors flex items-center gap-1.5 shadow-sm ${
                            isCommentsOpen
                                ? 'bg-[var(--sidebar-accent)] text-[var(--sidebar-accent-foreground)] border-[var(--sidebar-accent)] font-bold'
                                : 'bg-[var(--panel-background)]/90 hover:bg-[var(--sidebar-accent)]/15 text-[var(--panel-foreground)] border-[var(--panel-border)]'
                        }`}
                        title="Comments"
                        aria-label="Toggle Comments"
                        data-testid="toggle-comments"
                    >
                        <MessageSquare className="w-4 h-4" />
                        <span className="hidden xl:inline text-xs font-bold">Comments</span>
                    </button>

                    {/* Collaborators Toggle */}
                    <button
                        onClick={() => {
                            const opening = !isCollaboratorsOpen;
                            if (opening) closeAllPanels(); // Bug 144
                            setIsCollaboratorsOpen(opening);
                        }}
                        className={`p-2 rounded-lg border transition-colors flex items-center gap-1.5 shadow-sm ${
                            isCollaboratorsOpen
                                ? 'bg-[var(--sidebar-accent)] text-[var(--sidebar-accent-foreground)] border-[var(--sidebar-accent)] font-bold'
                                : 'bg-[var(--panel-background)]/90 hover:bg-[var(--sidebar-accent)]/15 text-[var(--panel-foreground)] border-[var(--panel-border)]'
                        }`}
                        title="Collaborators"
                        aria-label="Collaborators"
                        data-testid="toggle-collaborators"
                    >
                        <Users className="w-4 h-4" />
                        <span className="hidden xl:inline text-xs font-bold">Team</span>
                    </button>

                    {/* Version History Toggle */}
                    <button
                        onClick={() => {
                            const opening = !isHistoryOpen;
                            if (opening) closeAllPanels(); // Bug 144
                            setIsHistoryOpen(opening);
                        }}
                        className={`p-2 rounded-lg border transition-colors flex items-center gap-1.5 shadow-sm ${
                            isHistoryOpen
                                ? 'bg-[var(--sidebar-accent)] text-[var(--sidebar-accent-foreground)] border-[var(--sidebar-accent)] font-bold'
                                : 'bg-[var(--panel-background)]/90 hover:bg-[var(--sidebar-accent)]/15 text-[var(--panel-foreground)] border-[var(--panel-border)]'
                        }`}
                        title="Version History"
                        aria-label="Version History"
                        data-testid="toggle-history"
                    >
                        <History className="w-4 h-4" />
                        <span className="hidden xl:inline text-xs font-bold">History</span>
                    </button>

                    {/* Export Modal Toggle */}
                    <button
                        onClick={() => setIsExportOpen(true)}
                        className="p-2 bg-[var(--panel-background)]/90 hover:bg-[var(--sidebar-accent)]/15 text-[var(--panel-foreground)] rounded-lg border border-[var(--panel-border)] transition-colors flex items-center gap-1.5 shadow-sm"
                        title="Export Board"
                        aria-label="Export Board"
                        data-testid="toggle-export"
                    >
                        <Download className="w-4 h-4" />
                        <span className="hidden xl:inline text-xs font-bold">Export</span>
                    </button>

                    <div className="w-px h-5 bg-[var(--panel-border)] mx-0.5 hidden sm:block"></div>

                    {/* Action Buttons */}
                    <button
                        onClick={handleFork}
                        disabled={isForking} // Bug 65/66: Separate state
                        className="p-2 bg-[var(--panel-background)]/90 hover:bg-[var(--sidebar-accent)]/15 text-[var(--panel-foreground)] rounded-lg border border-[var(--panel-border)] transition-colors shadow-sm flex items-center justify-center"
                        title="Fork Board"
                        aria-label="Fork Board"
                    >
                        {isForking ? <AppleSpinner size="xs" /> : <GitFork className="w-4 h-4" />}
                    </button>

                    {parentId && !isReadOnly && (
                        <button
                            onClick={handleOpenSuggestModal}
                            disabled={isSuggesting} // Bug 65: Separate state
                            className="p-2 bg-purple-900/50 hover:bg-purple-900/80 text-purple-200 rounded-lg border border-purple-700 transition-colors shadow-sm"
                            title="Suggest Changes"
                            aria-label="Suggest Changes"
                        >
                            {isSuggesting ? <AppleSpinner size="xs" /> : <GitPullRequest className="w-4 h-4" />}
                        </button>
                    )}

                    {!parentId && (
                        <button
                            onClick={() => setIsContributionsOpen(true)}
                            className="p-2 bg-[var(--panel-background)]/90 hover:bg-[var(--sidebar-accent)]/15 text-[var(--panel-foreground)] rounded-lg border border-[var(--panel-border)] transition-colors relative shadow-sm"
                            title="Review Suggestions"
                            aria-label="Review Suggestions"
                        >
                            <GitPullRequest className="w-4 h-4 rotate-180" />
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
                            className="p-2 bg-[var(--panel-background)]/90 hover:bg-[var(--sidebar-accent)]/15 text-[var(--panel-foreground)] rounded-lg border border-[var(--panel-border)] transition-colors shadow-sm"
                            title="Settings"
                            aria-label="Settings"
                        >
                            <Settings className="w-4 h-4" />
                        </button>
                    )}

                    <button
                        onClick={handleShare}
                        disabled={isBoardLoading} // Bug 152
                        className="p-2 bg-[var(--panel-background)]/90 hover:bg-[var(--sidebar-accent)]/15 text-[var(--panel-foreground)] rounded-lg border border-[var(--panel-border)] transition-colors shadow-sm disabled:opacity-50"
                        title="Share"
                        aria-label="Share"
                    >
                        <Share2 className="w-4 h-4" />
                    </button>

                    <button
                        onClick={handleRefresh} // Bug 122: Confirmation before refresh
                        className="p-2 bg-[var(--panel-background)]/90 hover:bg-[var(--sidebar-accent)]/15 text-[var(--panel-foreground)] rounded-lg border border-[var(--panel-border)] transition-colors shadow-sm"
                        title="Refresh Board"
                    >
                        <RefreshCcw className="w-4 h-4" />
                    </button>
                </div>

                <ReactFlow
                    nodes={nodes} // Bug 4: No more .map() - isReadOnly via context
                    edges={edges}
                    nodeTypes={nodeTypes}
                    edgeTypes={edgeTypes}
                    defaultEdgeOptions={defaultEdgeOpts} // Bug 198: Memoized outside
                    onNodesChange={!isReadOnly ? onNodesChange : undefined}
                    onEdgesChange={!isReadOnly ? onEdgesChange : undefined}
                    onConnect={!isReadOnly ? onConnect : undefined}
                    onNodeClick={onNodeClick}
                    // Bug 26: Removed onNodesDelete - already handled in onNodesChange
                    nodesDraggable={!isReadOnly}
                    nodesConnectable={!isReadOnly && !connectMode}
                    elementsSelectable={true}
                    panOnDrag={panOnDrag}
                    zoomOnScroll={zoomOnScroll}
                    snapToGrid={snapToGrid}
                    snapGrid={[gridSize || 20, gridSize || 20]}
                    fitView
                    fitViewOptions={{ padding: 0.25, minZoom: 0.35, maxZoom: 1.5 }} // Bug 205: Consistent zoom
                    minZoom={0.15}
                    maxZoom={2.0}
                    onInit={(instance) => {
                        rfInstanceRef.current = instance;
                    }}
                    className={connectMode ? 'cursor-crosshair' : ''}
                >
                    {canvasBackground !== 'none' && (
                        <Background
                            variant={
                                canvasBackground === 'lines'
                                    ? BackgroundVariant.Lines
                                    : canvasBackground === 'cross'
                                    ? BackgroundVariant.Cross
                                    : BackgroundVariant.Dots
                            }
                            gap={gridSize || 20}
                            size={canvasBackground === 'lines' ? 1 : 1.5}
                            color="var(--foreground)"
                            className={canvasBackground === 'lines' ? 'opacity-15' : 'opacity-20'}
                        />
                    )}
                    <Controls
                        position="bottom-left"
                        className="!bottom-6 !left-4 !bg-[var(--panel-background)]/90 !backdrop-blur-md !border !border-[var(--panel-border)] !rounded-xl !shadow-xl !overflow-hidden [&>button]:!border-[var(--panel-border)] [&>button]:!bg-transparent [&>button]:!text-[var(--panel-foreground)] [&>button:hover]:!bg-[var(--sidebar-accent)]/20"
                    />
                    {showMiniMap && (
                        <MiniMap
                            nodeColor={(n) => {
                                if (n.type === 'sticky') return '#fef08a';
                                if (n.type === 'image') return '#93c5fd';
                                if (n.type === 'link') return '#86efac';
                                return '#cbd5e1';
                            }}
                            maskColor="rgba(0, 0, 0, 0.4)"
                            className="!bottom-20 !right-4 !w-48 !h-36 rounded-xl border border-[var(--panel-border)] shadow-2xl bg-[var(--panel-background)]/90 backdrop-blur-md overflow-hidden z-30"
                        />
                    )}
                    <Toolbar isReadOnly={isReadOnly} />
                </ReactFlow>

                {/* Suggestion Composer Modal Dialog */}
                {isSuggestModalOpen && (
                    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
                        <div className="bg-[var(--panel-background)] border border-[var(--panel-border)] p-5 rounded-xl max-w-md w-full shadow-2xl space-y-4 text-[var(--panel-foreground)]">
                            <div className="flex justify-between items-center border-b border-[var(--panel-border)] pb-3">
                                <h3 className="font-bold text-sm text-[var(--foreground)] flex items-center gap-2">
                                    <GitPullRequest className="w-4 h-4 text-purple-400" />
                                    Submit Suggestions to Parent Case
                                </h3>
                                <button
                                    type="button"
                                    onClick={() => setIsSuggestModalOpen(false)}
                                    className="p-1 hover:bg-[var(--background)] text-[var(--panel-foreground)]/60 hover:text-[var(--foreground)] rounded transition"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <p className="text-xs text-[var(--panel-foreground)]/70">
                                Your branch clues and string connections will be transmitted to the detectives of{' '}
                                <strong className="text-purple-300 font-semibold">{parentTitle || 'Parent Case'}</strong> for review.
                            </p>
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-semibold text-[var(--foreground)] uppercase tracking-wider block">
                                    Investigative Notes & Rationale
                                </label>
                                <textarea
                                    value={suggestMessage}
                                    onChange={(e) => setSuggestMessage(e.target.value)}
                                    placeholder="Explain your case hypothesis, new clues added, or revised string connections..."
                                    rows={4}
                                    className="w-full text-xs p-2.5 bg-[var(--background)] border border-[var(--panel-border)] rounded-md text-[var(--foreground)] focus:outline-none focus:border-purple-500 resize-none"
                                    maxLength={500}
                                />
                                <div className="flex justify-between text-[10px] text-[var(--panel-foreground)]/50 font-mono">
                                    <span>Max 500 characters</span>
                                    <span>{suggestMessage.length}/500</span>
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--panel-border)]">
                                <button
                                    type="button"
                                    onClick={() => setIsSuggestModalOpen(false)}
                                    className="px-3.5 py-1.5 text-xs text-[var(--panel-foreground)]/70 hover:text-[var(--foreground)] rounded"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    disabled={isSuggesting}
                                    onClick={handleConfirmSuggestChanges}
                                    className="px-4 py-1.5 text-xs bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium flex items-center gap-1.5 disabled:opacity-50 shadow-sm"
                                >
                                    {isSuggesting ? <AppleSpinner size="sm" /> : <GitPullRequest className="w-3.5 h-3.5" />}
                                    Transmit Suggestions
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </IsReadOnlyContext.Provider>
    );
};

export default Board;
