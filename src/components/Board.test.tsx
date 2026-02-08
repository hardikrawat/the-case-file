import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Board from '@/components/Board';
import useStore from '@/store/useStore';

// Mock ReactFlow
vi.mock('reactflow', async () => {
    return {
        default: ({ children }: any) => <div data-testid="react-flow">{children}</div>,
        Background: () => <div data-testid="background" />,
        Controls: () => <div data-testid="controls" />,
        MiniMap: () => <div data-testid="minimap" />,
        Panel: ({ children }: any) => <div data-testid="panel">{children}</div>,
        useNodesState: (initial: any) => [initial, vi.fn(), vi.fn()],
        useEdgesState: (initial: any) => [initial, vi.fn(), vi.fn()],
        addEdge: vi.fn(),
        useReactFlow: () => ({
            project: vi.fn(),
            getNodes: vi.fn().mockReturnValue([]),
        }),
        ReactFlowProvider: ({ children }: any) => <div>{children}</div>,
        MarkerType: { ArrowClosed: 'arrowclosed' },
        BackgroundVariant: { Dots: 'dots', Lines: 'lines', Cross: 'cross' },
    };
});

// Mock Toolbar
vi.mock('@/components/ui/Toolbar', () => ({
    default: () => <div data-testid="toolbar">Toolbar</div>,
}));

// Mock fetch
global.fetch = vi.fn(() =>
    Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
            id: 'test-board',
            title: 'Test Board',
            content: { nodes: [], edges: [] }
        }),
    })
) as unknown as typeof fetch;

// Mock next/navigation
vi.mock('next/navigation', () => ({
    useParams: () => ({ id: 'test-board' }),
    useRouter: () => ({
        push: vi.fn(),
        replace: vi.fn(),
        prefetch: vi.fn(),
    }),
}));

// Mock useStore
vi.mock('@/store/useStore', () => ({
    __esModule: true,
    default: vi.fn((selector) => {
        // Mock state
        const state = {
            nodes: [],
            edges: [],
            onNodesChange: vi.fn(),
            onEdgesChange: vi.fn(),
            onConnect: vi.fn(),
            theme: 'theme-cork',
            connectMode: false,
            sourceNodeId: null,
            setSourceNodeId: vi.fn(),
            setEdges: vi.fn(),
            setNodes: vi.fn(),
            setBoardMetadata: vi.fn(),
            boardTitle: 'Test Board',
            parentId: null,
        };
        return selector(state);
    }),
}));

describe('Board Component', () => {
    it('should render board with components', () => {
        render(<Board />);

        expect(screen.getByTestId('react-flow')).toBeInTheDocument();
        expect(screen.getByTestId('background')).toBeInTheDocument();
        expect(screen.getByTestId('controls')).toBeInTheDocument();
        expect(screen.getByTestId('toolbar')).toBeInTheDocument();
        expect(screen.getByText('Test Board')).toBeInTheDocument();
    });
});
