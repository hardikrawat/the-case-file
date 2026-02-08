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

type RFState = {
    nodes: Node[];
    edges: Edge[];
    onNodesChange: OnNodesChange;
    onEdgesChange: OnEdgesChange;
    onConnect: OnConnect;
    addNode: (node: Node) => void;
    theme: string;
    setTheme: (theme: string) => void;
    activeColor: string;
    setActiveColor: (color: string) => void;
    updateNodeData: (id: string, data: unknown) => void;
    setNodes: (nodes: Node[]) => void;
    setEdges: (edges: Edge[]) => void;
    boardTitle: string;
    parentId: string | null; // ID of the parent board if this is a fork
    isPublic: boolean;
    setBoardMetadata: (title: string, isPublic: boolean, parentId: string | null) => void;
    deleteNode: (id: string) => void;
    updateNode: (id: string, data: unknown) => void;
};

const safeStorage = {
    getItem: (name: string) => {
        if (typeof window === 'undefined') return null;
        try {
            const data = localStorage.getItem(name);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error('SafeStorage: Failed to get item', e);
            return null;
        }
    },
    setItem: (name: string, value: unknown) => {
        if (typeof window === 'undefined') return;
        try {
            localStorage.setItem(name, JSON.stringify(value));
        } catch (e) {
            if (e instanceof DOMException && (
                e.code === 22 ||
                e.code === 1014 ||
                e.name === 'QuotaExceededError' ||
                e.name === 'NS_ERROR_DOM_QUOTA_REACHED'
            )) {
                console.warn('SafeStorage: Quota exceeded, saving failed but application continues.');
            } else {
                console.error('SafeStorage: Unexpected error during save', e);
            }
        }
    },
    removeItem: (name: string) => {
        if (typeof window === 'undefined') return;
        localStorage.removeItem(name);
    },
};

const useStore = create<RFState>()(
    persist(
        (set, get) => ({
            // ... (rest of the store logic remains same)
            nodes: [],
            edges: [],
            boardTitle: 'Untitled Case',
            isPublic: false,
            theme: 'theme-cork',
            setTheme: (theme) => set({ theme }),
            activeColor: '#fef3c7',
            setActiveColor: (activeColor) => set({ activeColor }),
            setNodes: (nodes) => set({ nodes }),
            setEdges: (edges) => set({ edges }),
            updateNodeData: (id, data) => {
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
                set({
                    nodes: get().nodes.map((node) =>
                        node.id === id ? { ...node, data: Object.assign({}, node.data, data) } : node
                    ),
                });
            },
            onNodesChange: (changes: NodeChange[]) => {
                set({
                    nodes: applyNodeChanges(changes, get().nodes),
                });
            },
            onEdgesChange: (changes: EdgeChange[]) => {
                set({
                    edges: applyEdgeChanges(changes, get().edges),
                });
            },
            onConnect: (connection: Connection) => {
                set({
                    edges: addEdge({ ...connection, type: 'string', animated: false }, get().edges),
                });
            },
            addNode: (node: Node) => {
                set({
                    nodes: [...get().nodes, node],
                });
            },
            deleteNode: (id) =>
                set({
                    nodes: get().nodes.filter((node) => node.id !== id),
                    edges: get().edges.filter(
                        (edge) => edge.source !== id && edge.target !== id
                    ),
                }),
            parentId: null,
            setBoardMetadata: (title, isPublic, parentId) => set({ boardTitle: title, isPublic, parentId }),
        }),
        {
            name: 'case-file-storage',
            storage: safeStorage as never,
            partialize: (state) => ({
                nodes: state.nodes,
                edges: state.edges,
                theme: state.theme,
                activeColor: state.activeColor,
                boardTitle: state.boardTitle,
                isPublic: state.isPublic,
                parentId: state.parentId,
            }),
        }
    )
);

export default useStore;
