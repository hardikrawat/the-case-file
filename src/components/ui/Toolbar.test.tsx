import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Toolbar from '@/components/ui/Toolbar';
import useStore from '@/store/useStore';

// Mock dependencies
vi.mock('reactflow', async () => {
    const actual = await vi.importActual('reactflow');
    return {
        ...actual,
        useReactFlow: () => ({
            project: vi.fn((pos) => pos),
            getViewport: vi.fn(() => ({ x: 0, y: 0, zoom: 1 })),
        }),
    };
});

describe('Toolbar Component', () => {
    it('should render all tool buttons', () => {
        render(<Toolbar />);

        expect(screen.getByText('Sticky')).toBeInTheDocument();
        expect(screen.getByText('Text')).toBeInTheDocument();
        expect(screen.getByText('Image')).toBeInTheDocument();
        expect(screen.getByText('Article')).toBeInTheDocument();
    });

    it('should call addNode when Sticky is clicked', () => {
        const addNodeSpy = vi.fn();
        useStore.setState({ addNode: addNodeSpy });

        render(<Toolbar />);

        fireEvent.click(screen.getByText('Sticky'));

        expect(addNodeSpy).toHaveBeenCalledWith(expect.objectContaining({
            type: 'sticky',
            data: expect.objectContaining({ label: '' })
        }));
    });

    it('should call addNode when Text is clicked', () => {
        const addNodeSpy = vi.fn();
        useStore.setState({ addNode: addNodeSpy });
        render(<Toolbar />);
        fireEvent.click(screen.getByText('Text'));
        expect(addNodeSpy).toHaveBeenCalledWith(expect.objectContaining({
            type: 'text',
            data: expect.objectContaining({ label: 'New Text' })
        }));
    });

    it('should call addNode when Image is clicked', () => {
        const addNodeSpy = vi.fn();
        useStore.setState({ addNode: addNodeSpy });
        render(<Toolbar />);
        fireEvent.click(screen.getByText('Image'));
        expect(addNodeSpy).toHaveBeenCalledWith(expect.objectContaining({
            type: 'image',
            data: expect.objectContaining({ caption: '', src: '' })
        }));
    });

    it('should call addNode when Article is clicked', () => {
        const addNodeSpy = vi.fn();
        useStore.setState({ addNode: addNodeSpy });
        render(<Toolbar />);
        fireEvent.click(screen.getByText('Article'));
        expect(addNodeSpy).toHaveBeenCalledWith(expect.objectContaining({
            type: 'article',
            data: expect.objectContaining({ title: '', url: '' })
        }));
    });

    it('should toggle connect mode', () => {
        const toggleSpy = vi.fn();
        useStore.setState({ toggleConnectMode: toggleSpy, connectMode: false });

        render(<Toolbar />);

        const linkBtn = screen.getByTitle('Connect Items');
        fireEvent.click(linkBtn);

        expect(toggleSpy).toHaveBeenCalled();
    });

    it('should change theme', () => {
        const setThemeSpy = vi.fn();
        useStore.setState({ setTheme: setThemeSpy });

        render(<Toolbar />);

        const noirBtn = screen.getByTitle('Noir');
        fireEvent.click(noirBtn);

        expect(setThemeSpy).toHaveBeenCalledWith('theme-noir');
    });

    it('should change active color', () => {
        const colorSpy = vi.fn();
        useStore.setState({ setActiveColor: colorSpy });

        render(<Toolbar />);

        // Assuming colors are rendered as buttons with color code title or style
        // The code uses `title={c}`
        const colorBtn = screen.getByTitle('#fca5a5'); // 2nd color
        fireEvent.click(colorBtn);

        expect(colorSpy).toHaveBeenCalledWith('#fca5a5');
    });

    describe('Actions', () => {
        beforeEach(() => {
            vi.clearAllMocks();
            global.URL.createObjectURL = vi.fn(() => 'blob:url');
            global.URL.revokeObjectURL = vi.fn();
            vi.spyOn(window, 'alert').mockImplementation(() => { });
        });

        afterEach(() => {
            vi.restoreAllMocks();
        });

        it('should handle export', () => {
            const nodes = [{ id: '1', position: { x: 0, y: 0 }, data: {} }];
            useStore.setState({ nodes, edges: [] });

            render(<Toolbar />);

            const exportBtn = screen.getByTitle('Export JSON');

            const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click');

            fireEvent.click(exportBtn);

            expect(global.URL.createObjectURL).toHaveBeenCalled();
            expect(clickSpy).toHaveBeenCalled();
        });

        it('should handle import', async () => {
            const setNodesSpy = vi.fn();
            const setEdgesSpy = vi.fn();
            useStore.setState({ setNodes: setNodesSpy, setEdges: setEdgesSpy });

            const { container } = render(<Toolbar />);

            // Helper to get input
            const input = container.querySelector('input[type="file"]');

            // Mock FileReader
            const mockFileReader = {
                readAsText: vi.fn(),
                onload: null as ((this: FileReader, ev: ProgressEvent<FileReader>) => void) | null,
                result: '{"nodes":[{"id":"1"}], "edges":[]}'
            };

            // Spy on window.FileReader
            vi.spyOn(window, 'FileReader').mockImplementation(() => mockFileReader as unknown as FileReader);

            const file = new File(['{"nodes":[{"id":"1"}], "edges":[]}'], 'test.json', { type: 'application/json' });
            fireEvent.change(input!, { target: { files: [file] } });

            // Trigger onload manually since mock doesn't do it
            if (mockFileReader.onload) {
                mockFileReader.onload({ target: { result: mockFileReader.result } } as unknown as ProgressEvent<FileReader>);
            }

            expect(mockFileReader.readAsText).toHaveBeenCalledWith(file);
            expect(setNodesSpy).toHaveBeenCalledWith([{ id: '1' }]);
            expect(setEdgesSpy).toHaveBeenCalledWith([]);
        });


        it('should handle clear board with confirmation', () => {
            const setNodesSpy = vi.fn();
            const setEdgesSpy = vi.fn();
            useStore.setState({ setNodes: setNodesSpy, setEdges: setEdgesSpy });

            // Mock confirm
            vi.spyOn(window, 'confirm').mockReturnValue(true);

            render(<Toolbar />);
            const clearBtn = screen.getByTitle('Clear Board');
            fireEvent.click(clearBtn);

            expect(window.confirm).toHaveBeenCalled();
            expect(setNodesSpy).toHaveBeenCalledWith([]);
            expect(setEdgesSpy).toHaveBeenCalledWith([]);
        });

        it('should not clear board if cancelled', () => {
            const setNodesSpy = vi.fn();
            useStore.setState({ setNodes: setNodesSpy });
            vi.spyOn(window, 'confirm').mockReturnValue(false);

            render(<Toolbar />);
            const clearBtn = screen.getByTitle('Clear Board');
            fireEvent.click(clearBtn);

            expect(setNodesSpy).not.toHaveBeenCalled();
        });
    });
});
