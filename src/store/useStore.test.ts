import { describe, it, expect, beforeEach } from 'vitest';
import { act } from 'react';
import { Connection, EdgeChange, NodeChange } from 'reactflow';
import useStore from '@/store/useStore';

describe('useStore', () => {
    beforeEach(() => {
        useStore.getState().resetBoard();
        useStore.setState({
            theme: 'theme-cork',
            activeColor: '#fef3c7',
            connectMode: false,
        });
    });

    it('should initialize with default state', () => {
        const state = useStore.getState();
        expect(state.nodes).toEqual([]);
        expect(state.edges).toEqual([]);
        expect(state.theme).toBe('theme-cork');
        expect(state.connectMode).toBe(false);
        expect(state.boardId).toBeNull();
        expect(state.boardVersion).toBe(1);
    });

    it('should add a node', () => {
        const newNode = { id: '1', position: { x: 0, y: 0 }, data: { label: 'test' } };

        act(() => {
            useStore.getState().addNode(newNode);
        });

        expect(useStore.getState().nodes).toHaveLength(1);
        expect(useStore.getState().nodes[0]).toEqual(newNode);
    });

    it('should update a node', () => {
        const newNode = { id: '1', position: { x: 0, y: 0 }, data: { label: 'test' } };
        useStore.getState().addNode(newNode);

        act(() => {
            useStore.getState().updateNodeData('1', { label: 'updated' });
        });

        expect(useStore.getState().nodes[0].data.label).toBe('updated');
    });

    it('should use updateNode function', () => {
        const newNode = { id: '1', position: { x: 0, y: 0 }, data: { label: 'test' } };
        useStore.getState().addNode(newNode);

        act(() => {
            useStore.getState().updateNode('1', { label: 'updated-alt' });
        });

        expect(useStore.getState().nodes[0].data.label).toBe('updated-alt');
    });

    it('should delete a node and connected edges', () => {
        const node1 = { id: '1', position: { x: 0, y: 0 }, data: {} };
        const node2 = { id: '2', position: { x: 100, y: 0 }, data: {} };
        const edge = { id: 'e1-2', source: '1', target: '2' };

        useStore.setState({ nodes: [node1, node2], edges: [edge] });

        act(() => {
            useStore.getState().deleteNode('1');
        });

        expect(useStore.getState().nodes).toHaveLength(1);
        expect(useStore.getState().nodes[0].id).toBe('2');
        expect(useStore.getState().edges).toHaveLength(0);
    });

    it('should delete an edge with deleteEdge', () => {
        const edge1 = { id: 'e1', source: '1', target: '2' };
        const edge2 = { id: 'e2', source: '2', target: '3' };
        useStore.setState({ edges: [edge1, edge2] });

        act(() => {
            useStore.getState().deleteEdge('e1');
        });

        expect(useStore.getState().edges).toHaveLength(1);
        expect(useStore.getState().edges[0].id).toBe('e2');
    });

    it('should toggle connect mode and reset sourceNodeId', () => {
        expect(useStore.getState().connectMode).toBe(false);

        act(() => {
            useStore.getState().setSourceNodeId('node-123');
            useStore.getState().toggleConnectMode();
        });

        expect(useStore.getState().connectMode).toBe(true);
        expect(useStore.getState().sourceNodeId).toBeNull();

        act(() => {
            useStore.getState().toggleConnectMode();
        });

        expect(useStore.getState().connectMode).toBe(false);
    });

    it('should load board with initial state and metadata', () => {
        const initialNodes = [{ id: 'n1', position: { x: 50, y: 50 }, data: { label: 'Loaded' } }];
        const initialEdges = [{ id: 'e1', source: 'n1', target: 'n2' }];

        act(() => {
            useStore.getState().loadBoard('board-xyz', initialNodes, initialEdges, {
                title: 'Cold Case File',
                isPublic: true,
                parentId: 'parent-abc',
                version: 4,
            });
        });

        const state = useStore.getState();
        expect(state.boardId).toBe('board-xyz');
        expect(state.nodes).toEqual(initialNodes);
        expect(state.edges).toEqual(initialEdges);
        expect(state.boardTitle).toBe('Cold Case File');
        expect(state.isPublic).toBe(true);
        expect(state.parentId).toBe('parent-abc');
        expect(state.boardVersion).toBe(4);
    });

    it('should reset board to empty default state', () => {
        useStore.setState({
            boardId: 'b1',
            nodes: [{ id: '1', position: { x: 0, y: 0 }, data: {} }],
            edges: [{ id: 'e1', source: '1', target: '2' }],
            boardTitle: 'Active Mystery',
            boardVersion: 5,
        });

        act(() => {
            useStore.getState().resetBoard();
        });

        const state = useStore.getState();
        expect(state.boardId).toBeNull();
        expect(state.nodes).toEqual([]);
        expect(state.edges).toEqual([]);
        expect(state.boardTitle).toBe('Untitled Case');
        expect(state.boardVersion).toBe(1);
    });

    it('should set board metadata', () => {
        act(() => {
            useStore.getState().setBoardMetadata('New Title', true, 'parent-123');
        });

        const state = useStore.getState();
        expect(state.boardTitle).toBe('New Title');
        expect(state.isPublic).toBe(true);
        expect(state.parentId).toBe('parent-123');
    });

    it('should handle onNodesChange and clean up connected edges on node remove', () => {
        const node1 = { id: '1', position: { x: 0, y: 0 }, data: { label: 'test' }, selected: false };
        const node2 = { id: '2', position: { x: 100, y: 0 }, data: { label: 'test2' }, selected: false };
        const edge1 = { id: 'e1', source: '1', target: '2' };
        useStore.setState({ nodes: [node1, node2], edges: [edge1] });

        const changes: NodeChange[] = [{ type: 'remove', id: '1' }];

        act(() => {
            useStore.getState().onNodesChange(changes);
        });

        expect(useStore.getState().nodes).toHaveLength(1);
        expect(useStore.getState().nodes[0].id).toBe('2');
        expect(useStore.getState().edges).toHaveLength(0);
    });

    it('should handle onEdgesChange', () => {
        const edge1 = { id: 'e1', source: '1', target: '2', selected: false };
        useStore.setState({ edges: [edge1] });

        const changes = [{ type: 'select', id: 'e1', selected: true }];

        act(() => {
            useStore.getState().onEdgesChange(changes as EdgeChange[]);
        });

        expect(useStore.getState().edges[0].selected).toBe(true);
    });

    it('should handle onConnect and prevent duplicate multi-directional edges', () => {
        useStore.setState({ edges: [] });
        const connection = { source: '1', target: '2' };

        act(() => {
            useStore.getState().onConnect(connection as Connection);
        });

        expect(useStore.getState().edges).toHaveLength(1);

        // Attempt reverse connection (2 -> 1)
        act(() => {
            useStore.getState().onConnect({ source: '2', target: '1' } as Connection);
        });
        // Still only 1 edge should exist
        expect(useStore.getState().edges).toHaveLength(1);

        // Attempt self loop (1 -> 1)
        act(() => {
            useStore.getState().onConnect({ source: '1', target: '1' } as Connection);
        });
        expect(useStore.getState().edges).toHaveLength(1);
    });

    it('should support undo and redo across canvas modifications', () => {
        useStore.setState({ nodes: [], edges: [], past: [], future: [], canUndo: false, canRedo: false });

        const nodeA = { id: 'nodeA', position: { x: 0, y: 0 }, data: { label: 'A' } };
        act(() => {
            useStore.getState().addNode(nodeA);
        });

        expect(useStore.getState().nodes).toHaveLength(1);
        expect(useStore.getState().canUndo).toBe(true);
        expect(useStore.getState().canRedo).toBe(false);

        // Undo addition
        act(() => {
            useStore.getState().undo();
        });

        expect(useStore.getState().nodes).toHaveLength(0);
        expect(useStore.getState().canUndo).toBe(false);
        expect(useStore.getState().canRedo).toBe(true);

        // Redo addition
        act(() => {
            useStore.getState().redo();
        });

        expect(useStore.getState().nodes).toHaveLength(1);
        expect(useStore.getState().nodes[0].id).toBe('nodeA');
        expect(useStore.getState().canUndo).toBe(true);
        expect(useStore.getState().canRedo).toBe(false);
    });

    it('should correctly set and update boardVersion', () => {
        useStore.getState().setBoardVersion(5);
        expect(useStore.getState().boardVersion).toBe(5);
    });

    it('should initialize and update canvas and autosave preferences', () => {
        useStore.getState().resetPreferences();
        const initial = useStore.getState();

        expect(initial.autoSaveEnabled).toBe(true);
        expect(initial.autoSaveDelay).toBe(2000);
        expect(initial.snapToGrid).toBe(false);
        expect(initial.gridSize).toBe(20);
        expect(initial.canvasBackground).toBe('dots');
        expect(initial.warnOnUnsavedChanges).toBe(true);
        expect(initial.zoomOnScroll).toBe(true);
        expect(initial.panOnDrag).toBe(true);
        expect(initial.showMiniMapDefault).toBe(true);

        act(() => {
            useStore.getState().setAutoSaveEnabled(false);
            useStore.getState().setAutoSaveDelay(5000);
            useStore.getState().setSnapToGrid(true);
            useStore.getState().setGridSize(15);
            useStore.getState().setCanvasBackground('lines');
            useStore.getState().setWarnOnUnsavedChanges(false);
            useStore.getState().setZoomOnScroll(false);
            useStore.getState().setPanOnDrag(false);
            useStore.getState().setShowMiniMapDefault(false);
        });

        const updated = useStore.getState();
        expect(updated.autoSaveEnabled).toBe(false);
        expect(updated.autoSaveDelay).toBe(5000);
        expect(updated.snapToGrid).toBe(true);
        expect(updated.gridSize).toBe(15);
        expect(updated.canvasBackground).toBe('lines');
        expect(updated.warnOnUnsavedChanges).toBe(false);
        expect(updated.zoomOnScroll).toBe(false);
        expect(updated.panOnDrag).toBe(false);
        expect(updated.showMiniMapDefault).toBe(false);

        // Test resetPreferences
        act(() => {
            useStore.getState().resetPreferences();
        });

        const reset = useStore.getState();
        expect(reset.autoSaveEnabled).toBe(true);
        expect(reset.autoSaveDelay).toBe(2000);
        expect(reset.snapToGrid).toBe(false);
        expect(reset.gridSize).toBe(20);
        expect(reset.canvasBackground).toBe('dots');
        expect(reset.warnOnUnsavedChanges).toBe(true);
        expect(reset.zoomOnScroll).toBe(true);
        expect(reset.panOnDrag).toBe(true);
        expect(reset.showMiniMapDefault).toBe(true);
    });
});

