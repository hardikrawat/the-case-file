import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ReactFlow, { ReactFlowProvider } from 'reactflow';
import StickyNoteNode from '@/components/nodes/StickyNoteNode';
import TextNode from '@/components/nodes/TextNode';
import ImageNode from '@/components/nodes/ImageNode';
import LinkNode from '@/components/nodes/LinkNode';
import ArticleNode from '@/components/nodes/ArticleNode';
import StringEdge from '@/components/edges/StringEdge';
import { IsReadOnlyContext } from '@/context/ReadOnlyContext';

// Mock EdgeLabelRenderer for JSDOM
vi.mock('reactflow', async () => {
    const actual = await vi.importActual<any>('reactflow');
    return {
        ...actual,
        EdgeLabelRenderer: ({ children }: any) => <div data-testid="edge-label-renderer">{children}</div>,
    };
});

// Mock Next.js Image
vi.mock('next/image', () => ({
    default: (props: any) => <img {...props} />
}));

// Mock fetch for previews
global.fetch = vi.fn().mockImplementation(() =>
    Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ title: 'Mocked Title' }),
    })
);

describe('Evidence Nodes and Edges Read-Only Behavior', () => {
    describe('StickyNoteNode', () => {
        it('renders delete button and editable textarea when editable', () => {
            render(
                <ReactFlowProvider>
                    <IsReadOnlyContext.Provider value={false}>
                        <StickyNoteNode id="sticky-1" data={{ label: 'Clue' }} selected={true} type="sticky" xPos={0} yPos={0} isConnectable={true} zIndex={1} dragging={false} />
                    </IsReadOnlyContext.Provider>
                </ReactFlowProvider>
            );

            expect(screen.getByTestId('delete-node')).toBeInTheDocument();
            const textarea = screen.getByRole('textbox');
            expect(textarea).not.toHaveAttribute('readonly');
        });

        it('hides delete button and makes textarea read-only when read-only context is true', () => {
            render(
                <ReactFlowProvider>
                    <IsReadOnlyContext.Provider value={true}>
                        <StickyNoteNode id="sticky-1" data={{ label: 'Clue' }} selected={true} type="sticky" xPos={0} yPos={0} isConnectable={false} zIndex={1} dragging={false} />
                    </IsReadOnlyContext.Provider>
                </ReactFlowProvider>
            );

            expect(screen.queryByTestId('delete-node')).toBeNull();
            const textarea = screen.getByRole('textbox');
            expect(textarea).toHaveAttribute('readonly');
        });
    });

    describe('TextNode', () => {
        it('renders delete button and editable textarea when editable', () => {
            render(
                <ReactFlowProvider>
                    <IsReadOnlyContext.Provider value={false}>
                        <TextNode id="text-1" data={{ label: 'Title' }} selected={true} type="text" xPos={0} yPos={0} isConnectable={true} zIndex={1} dragging={false} />
                    </IsReadOnlyContext.Provider>
                </ReactFlowProvider>
            );

            expect(screen.getByTestId('delete-node')).toBeInTheDocument();
            const textarea = screen.getByRole('textbox');
            expect(textarea).not.toHaveAttribute('readonly');
        });

        it('hides delete button and makes textarea read-only when read-only context is true', () => {
            render(
                <ReactFlowProvider>
                    <IsReadOnlyContext.Provider value={true}>
                        <TextNode id="text-1" data={{ label: 'Title' }} selected={true} type="text" xPos={0} yPos={0} isConnectable={false} zIndex={1} dragging={false} />
                    </IsReadOnlyContext.Provider>
                </ReactFlowProvider>
            );

            expect(screen.queryByTestId('delete-node')).toBeNull();
            const textarea = screen.getByRole('textbox');
            expect(textarea).toHaveAttribute('readonly');
        });
    });

    describe('ImageNode', () => {
        it('renders delete button and upload controls when editable', () => {
            render(
                <ReactFlowProvider>
                    <IsReadOnlyContext.Provider value={false}>
                        <ImageNode id="image-1" data={{ caption: 'Photo' }} selected={true} type="image" xPos={0} yPos={0} isConnectable={true} zIndex={1} dragging={false} />
                    </IsReadOnlyContext.Provider>
                </ReactFlowProvider>
            );

            expect(screen.getByTestId('delete-node')).toBeInTheDocument();
            const captionInput = screen.getByPlaceholderText('Label this clue...');
            expect(captionInput).not.toHaveAttribute('readonly');
        });

        it('hides delete button and makes caption read-only when read-only context is true', () => {
            render(
                <ReactFlowProvider>
                    <IsReadOnlyContext.Provider value={true}>
                        <ImageNode id="image-1" data={{ caption: 'Photo' }} selected={true} type="image" xPos={0} yPos={0} isConnectable={false} zIndex={1} dragging={false} />
                    </IsReadOnlyContext.Provider>
                </ReactFlowProvider>
            );

            expect(screen.queryByTestId('delete-node')).toBeNull();
            const captionInput = screen.getByDisplayValue('Photo');
            expect(captionInput).toHaveAttribute('readonly');
        });
    });

    describe('LinkNode and ArticleNode', () => {
        it('hides delete button and locks inputs in read-only mode', () => {
            render(
                <ReactFlowProvider>
                    <IsReadOnlyContext.Provider value={true}>
                        <LinkNode id="link-1" data={{ title: 'Report', url: 'https://example.com' }} selected={true} type="link" xPos={0} yPos={0} isConnectable={false} zIndex={1} dragging={false} />
                        <ArticleNode id="article-1" data={{ title: 'Dispatch' }} selected={true} type="article" xPos={0} yPos={0} isConnectable={false} zIndex={1} dragging={false} />
                    </IsReadOnlyContext.Provider>
                </ReactFlowProvider>
            );

            expect(screen.queryByTestId('delete-node')).toBeNull();
            const titleInput = screen.getByDisplayValue('Report');
            expect(titleInput).toHaveAttribute('readonly');
            const headlineInput = screen.getByDisplayValue('Dispatch');
            expect(headlineInput).toHaveAttribute('readonly');
        });
    });

    describe('StringEdge', () => {
        it('renders cut string scissors when selected and editable', () => {
            const container = document.createElement('div');
            container.className = 'react-flow__edgelabel-renderer';
            document.body.appendChild(container);

            render(
                <ReactFlowProvider>
                    <svg>
                        <IsReadOnlyContext.Provider value={false}>
                            <StringEdge id="e1" sourceX={0} sourceY={0} targetX={100} targetY={100} source="a" target="b" selected={true} sourcePosition={'bottom' as any} targetPosition={'top' as any} />
                        </IsReadOnlyContext.Provider>
                    </svg>
                </ReactFlowProvider>
            );

            expect(screen.getByTestId('cut-string-e1')).toBeInTheDocument();
            container.remove();
        });

        it('never renders cut string scissors when in read-only mode', () => {
            const container = document.createElement('div');
            container.className = 'react-flow__edgelabel-renderer';
            document.body.appendChild(container);

            render(
                <ReactFlowProvider>
                    <svg>
                        <IsReadOnlyContext.Provider value={true}>
                            <StringEdge id="e2" sourceX={0} sourceY={0} targetX={100} targetY={100} source="a" target="b" selected={true} sourcePosition={'bottom' as any} targetPosition={'top' as any} />
                        </IsReadOnlyContext.Provider>
                    </svg>
                </ReactFlowProvider>
            );

            expect(screen.queryByTestId('cut-string-e2')).toBeNull();
            container.remove();
        });
    });
});
