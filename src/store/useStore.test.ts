import { describe, it, expect, beforeEach } from 'vitest';
import { act } from 'react';
import useStore from '@/store/useStore';

describe('useStore', () => {
    beforeEach(() => {
        useStore.setState({
            nodes: [],
            edges: [],
            theme: 'theme-cork',
            boardTitle: 'Untitled Case',
            isPublic: false,
            parentId: null,
        });
    });

    it('should initialize with default state', () => {
        const state = useStore.getState();
        expect(state.nodes).toEqual([]);
        expect(state.edges).toEqual([]);
        expect(state.theme).toBe('theme-cork');
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


    it('should set board metadata', () => {
        act(() => {
            useStore.getState().setBoardMetadata('New Title', true, 'parent-123');
        });

        const state = useStore.getState();
        expect(state.boardTitle).toBe('New Title');
        expect(state.isPublic).toBe(true);
        expect(state.parentId).toBe('parent-123');
    });

    it('should handle onNodesChange', () => {
        const node1 = { id: '1', position: { x: 0, y: 0 }, data: { label: 'test' }, selected: false };
        useStore.setState({ nodes: [node1] });

        const changes = [{ type: 'select', id: '1', selected: true }];

        // Mock applyNodeChanges implicitly by checking if state updates
        // Note: applyNodeChanges is from 'reactflow' which is not mocked here but works in node if no canvas involved?
        // Actually applyNodeChanges logic is pure JS usually.

        act(() => {
            useStore.getState().onNodesChange(changes as NodeChange[]);
        });

        expect(useStore.getState().nodes[0].selected).toBe(true);
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

    it('should handle onConnect', () => {
        useStore.setState({ edges: [] });
        const connection = { source: '1', target: '2' };

        act(() => {
            useStore.getState().onConnect(connection as Connection);
        });

        expect(useStore.getState().edges).toHaveLength(1);
        expect(useStore.getState().edges[0].source).toBe('1');
        expect(useStore.getState().edges[0].target).toBe('2');
    });
});
