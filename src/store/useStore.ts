import { create } from 'zustand';
import {
    Connection,
    Edge,
    EdgeChange,
    Node,
    NodeChange,
    addEdge,
    OnNodesChange,
    OnEdgesChange,
    OnConnect,
    applyNodeChanges,
    applyEdgeChanges,
} from 'reactflow';
import { persist } from 'zustand/middleware';

export type HistoryEntry = {
    nodes: Node[];
    edges: Edge[];
};

export type RFState = {
    // Ephemeral Board State (NOT persisted)
    boardId: string | null;
    boardVersion: number;
    nodes: Node[];
    edges: Edge[];
    boardTitle: string;
    parentId: string | null; // ID of the parent board if this is a fork
    isPublic: boolean;
    sourceNodeId: string | null;

    // History (Undo / Redo)
    past: HistoryEntry[];
    future: HistoryEntry[];
    canUndo: boolean;
    canRedo: boolean;
    takeSnapshot: () => void;
    undo: () => void;
    redo: () => void;

    // Ephemeral Board Lifecycle Actions
    loadBoard: (
        boardId: string,
        initialNodes?: Node[],
        initialEdges?: Edge[],
        metadata?: {
            title?: string;
            isPublic?: boolean;
            parentId?: string | null;
            version?: number;
        }
    ) => void;
    resetBoard: () => void;
    setBoardVersion: (version: number) => void;
    setBoardMetadata: (title: string, isPublic: boolean, parentId: string | null) => void;
    setNodes: (nodes: Node[]) => void;
    setEdges: (edges: Edge[]) => void;
    addNode: (node: Node) => void;
    updateNode: (id: string, data: unknown) => void;
    updateNodeData: (id: string, data: unknown) => void;
    deleteNode: (id: string) => void;
    deleteEdge: (id: string) => void;
    onNodesChange: OnNodesChange;
    onEdgesChange: OnEdgesChange;
    onConnect: OnConnect;
    setSourceNodeId: (id: string | null) => void;

    // Persisted User Preferences (Stored in localStorage)
    theme: string;
    setTheme: (theme: string) => void;
    activeColor: string;
    setActiveColor: (color: string) => void;
    connectMode: boolean;
    toggleConnectMode: () => void;

    // Canvas & Editor Preferences
    autoSaveEnabled: boolean;
    setAutoSaveEnabled: (enabled: boolean) => void;
    autoSaveDelay: number;
    setAutoSaveDelay: (delay: number) => void;
    snapToGrid: boolean;
    setSnapToGrid: (snap: boolean) => void;
    gridSize: number;
    setGridSize: (size: number) => void;
    canvasBackground: 'dots' | 'lines' | 'cross' | 'none';
    setCanvasBackground: (bg: 'dots' | 'lines' | 'cross' | 'none') => void;
    warnOnUnsavedChanges: boolean;
    setWarnOnUnsavedChanges: (warn: boolean) => void;
    zoomOnScroll: boolean;
    setZoomOnScroll: (zoom: boolean) => void;
    panOnDrag: boolean;
    setPanOnDrag: (pan: boolean) => void;
    showMiniMapDefault: boolean;
    setShowMiniMapDefault: (show: boolean) => void;
    resetPreferences: () => void;
};

const safeStorage = {
    getItem: (name: string) => {
        if (typeof window === 'undefined' || typeof localStorage === 'undefined') return null;
        try {
            const data = localStorage.getItem(name);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error('SafeStorage: Failed to get item', e);
            return null;
        }
    },
    setItem: (name: string, value: unknown) => {
        if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
        try {
            localStorage.setItem(name, JSON.stringify(value));
        } catch (e) {
            if (
                e instanceof DOMException &&
                (e.code === 22 ||
                    e.code === 1014 ||
                    e.name === 'QuotaExceededError' ||
                    e.name === 'NS_ERROR_DOM_QUOTA_REACHED')
            ) {
                console.warn('SafeStorage: Quota exceeded, saving failed but application continues.');
            } else {
                console.error('SafeStorage: Unexpected error during save', e);
            }
        }
    },
    removeItem: (name: string) => {
        if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
        try {
            localStorage.removeItem(name);
        } catch (e) {
            console.warn('SafeStorage: Remove failed', e);
        }
    },
};

const MAX_HISTORY = 50;
let lastSnapshotTime = 0;

const useStore = create<RFState>()(
    persist(
        (set, get) => ({
            // Default Ephemeral Board State
            boardId: null,
            boardVersion: 1,
            nodes: [],
            edges: [],
            boardTitle: 'Untitled Case',
            isPublic: false,
            parentId: null,
            sourceNodeId: null,

            // History Stack
            past: [],
            future: [],
            canUndo: false,
            canRedo: false,

            takeSnapshot: () => {
                const currentNodes = get().nodes;
                const currentEdges = get().edges;
                const past = get().past;
                const newPast = [...past, { nodes: currentNodes, edges: currentEdges }].slice(-MAX_HISTORY);
                set({
                    past: newPast,
                    future: [],
                    canUndo: true,
                    canRedo: false,
                });
            },

            undo: () => {
                const past = get().past;
                if (past.length === 0) return;
                const previous = past[past.length - 1];
                const newPast = past.slice(0, past.length - 1);
                const currentNodes = get().nodes;
                const currentEdges = get().edges;

                set({
                    nodes: previous.nodes,
                    edges: previous.edges,
                    past: newPast,
                    future: [{ nodes: currentNodes, edges: currentEdges }, ...get().future].slice(0, MAX_HISTORY),
                    canUndo: newPast.length > 0,
                    canRedo: true,
                });
            },

            redo: () => {
                const future = get().future;
                if (future.length === 0) return;
                const next = future[0];
                const newFuture = future.slice(1);
                const currentNodes = get().nodes;
                const currentEdges = get().edges;

                set({
                    nodes: next.nodes,
                    edges: next.edges,
                    past: [...get().past, { nodes: currentNodes, edges: currentEdges }].slice(-MAX_HISTORY),
                    future: newFuture,
                    canUndo: true,
                    canRedo: newFuture.length > 0,
                });
            },

            // Board Lifecycle Methods
            loadBoard: (boardId, initialNodes = [], initialEdges = [], metadata) => {
                set({
                    boardId,
                    nodes: initialNodes,
                    edges: initialEdges,
                    boardTitle: metadata?.title ?? 'Untitled Case',
                    isPublic: metadata?.isPublic ?? false,
                    parentId: metadata?.parentId ?? null,
                    boardVersion: metadata?.version ?? 1,
                    sourceNodeId: null,
                    past: [],
                    future: [],
                    canUndo: false,
                    canRedo: false,
                });
            },

            resetBoard: () => {
                set({
                    boardId: null,
                    nodes: [],
                    edges: [],
                    boardTitle: 'Untitled Case',
                    isPublic: false,
                    parentId: null,
                    boardVersion: 1,
                    sourceNodeId: null,
                    past: [],
                    future: [],
                    canUndo: false,
                    canRedo: false,
                });
            },

            setBoardVersion: (boardVersion) => set({ boardVersion }),

            setBoardMetadata: (title, isPublic, parentId) =>
                set({ boardTitle: title, isPublic, parentId }),

            setNodes: (nodes) => set({ nodes }),
            setEdges: (edges) => set({ edges }),

            addNode: (node: Node) => {
                if (get().nodes.some((n) => n.id === node.id)) return;
                get().takeSnapshot();
                set({
                    nodes: [...get().nodes, node],
                });
            },

            updateNodeData: (id, data) => {
                const now = Date.now();
                // Capture typing milestone snapshot if more than 1s elapsed
                if (now - lastSnapshotTime > 1200) {
                    get().takeSnapshot();
                    lastSnapshotTime = now;
                }
                set({
                    nodes: get().nodes.map((node) => {
                        if (node.id === id) {
                            return { ...node, data: Object.assign({}, node.data, data) };
                        }
                        return node;
                    }),
                });
            },

            updateNode: (id, data) => {
                const patch = (data || {}) as Record<string, unknown>;
                const now = Date.now();
                if (now - lastSnapshotTime > 1200) {
                    get().takeSnapshot();
                    lastSnapshotTime = now;
                }
                set({
                    nodes: get().nodes.map((node) => {
                        if (node.id === id) {
                            const hasNestedData = Boolean(patch.data && typeof patch.data === 'object');
                            const dataToMerge = hasNestedData
                                ? (patch.data as Record<string, unknown>)
                                : patch;
                            const rest = { ...patch };
                            delete rest.data;
                            return {
                                ...node,
                                ...(hasNestedData ? rest : {}),
                                data: Object.assign({}, node.data, dataToMerge),
                            };
                        }
                        return node;
                    }),
                });
            },

            deleteNode: (id) => {
                get().takeSnapshot();
                set({
                    nodes: get().nodes.filter((node) => node.id !== id),
                    edges: get().edges.filter(
                        (edge) => edge.source !== id && edge.target !== id
                    ),
                });
            },

            deleteEdge: (id) => {
                get().takeSnapshot();
                set({
                    edges: get().edges.filter((edge) => edge.id !== id),
                });
            },

            onNodesChange: (changes: NodeChange[]) => {
                const removedIds = new Set(
                    changes
                        .filter((c) => c.type === 'remove')
                        .map((c) => (c as { id: string }).id)
                );
                if (removedIds.size > 0) {
                    get().takeSnapshot();
                    set({
                        nodes: applyNodeChanges(changes, get().nodes),
                        edges: get().edges.filter(
                            (edge) => !removedIds.has(edge.source) && !removedIds.has(edge.target)
                        ),
                    });
                } else {
                    set({
                        nodes: applyNodeChanges(changes, get().nodes),
                    });
                }
            },

            onEdgesChange: (changes: EdgeChange[]) => {
                const removedIds = new Set(
                    changes
                        .filter((c) => c.type === 'remove')
                        .map((c) => (c as { id: string }).id)
                );
                if (removedIds.size > 0) {
                    get().takeSnapshot();
                }
                set({
                    edges: applyEdgeChanges(changes, get().edges),
                });
            },

            onConnect: (connection: Connection) => {
                if (!connection.source || !connection.target || connection.source === connection.target) return;
                // Check if edge between these two nodes already exists in either direction
                const existing = get().edges.some(
                    (e) => (e.source === connection.source && e.target === connection.target) ||
                           (e.source === connection.target && e.target === connection.source)
                );
                if (existing) return;

                get().takeSnapshot();
                set({
                    edges: addEdge({ ...connection, type: 'string', animated: false }, get().edges),
                });
            },

            // User Preferences (Persisted)
            theme: 'theme-cork',
            setTheme: (theme) => set({ theme }),

            activeColor: '#fef3c7',
            setActiveColor: (activeColor) => set({ activeColor }),

            connectMode: false,
            toggleConnectMode: () => set({ connectMode: !get().connectMode, sourceNodeId: null }),
            setSourceNodeId: (sourceNodeId) => set({ sourceNodeId }),

            // Canvas & Editor Preferences (Persisted)
            autoSaveEnabled: true,
            setAutoSaveEnabled: (autoSaveEnabled) => set({ autoSaveEnabled }),

            autoSaveDelay: 2000,
            setAutoSaveDelay: (autoSaveDelay) => set({ autoSaveDelay }),

            snapToGrid: false,
            setSnapToGrid: (snapToGrid) => set({ snapToGrid }),

            gridSize: 20,
            setGridSize: (gridSize) => set({ gridSize }),

            canvasBackground: 'dots',
            setCanvasBackground: (canvasBackground) => set({ canvasBackground }),

            warnOnUnsavedChanges: true,
            setWarnOnUnsavedChanges: (warnOnUnsavedChanges) => set({ warnOnUnsavedChanges }),

            zoomOnScroll: true,
            setZoomOnScroll: (zoomOnScroll) => set({ zoomOnScroll }),

            panOnDrag: true,
            setPanOnDrag: (panOnDrag) => set({ panOnDrag }),

            showMiniMapDefault: true,
            setShowMiniMapDefault: (showMiniMapDefault) => set({ showMiniMapDefault }),

            resetPreferences: () =>
                set({
                    autoSaveEnabled: true,
                    autoSaveDelay: 2000,
                    snapToGrid: false,
                    gridSize: 20,
                    canvasBackground: 'dots',
                    warnOnUnsavedChanges: true,
                    zoomOnScroll: true,
                    panOnDrag: true,
                    showMiniMapDefault: true,
                }),
        }),
        {
            name: 'case-file-storage',
            storage: safeStorage as never,
            partialize: (state) => ({
                // STRICTLY PREFERENCES ONLY - Never persist canvas state
                theme: state.theme,
                activeColor: state.activeColor,
                connectMode: state.connectMode,
                autoSaveEnabled: state.autoSaveEnabled,
                autoSaveDelay: state.autoSaveDelay,
                snapToGrid: state.snapToGrid,
                gridSize: state.gridSize,
                canvasBackground: state.canvasBackground,
                warnOnUnsavedChanges: state.warnOnUnsavedChanges,
                zoomOnScroll: state.zoomOnScroll,
                panOnDrag: state.panOnDrag,
                showMiniMapDefault: state.showMiniMapDefault,
            }),
        }
    )
);

export default useStore;
