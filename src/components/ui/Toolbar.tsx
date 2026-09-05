'use client';

import React from 'react';
import { useReactFlow } from 'reactflow';
import useStore from '@/store/useStore';
import { Download, Trash2, Upload, Link2, GitCommit, Undo2, Redo2 } from 'lucide-react';
import { toast } from 'sonner';

const Toolbar = ({ isReadOnly }: { isReadOnly?: boolean }) => {
    const addNode = useStore((state) => state.addNode);

    const activeColor = useStore((state) => state.activeColor);
    const setActiveColor = useStore((state) => state.setActiveColor);
    const nodes = useStore((state) => state.nodes);
    const edges = useStore((state) => state.edges);
    const setNodes = useStore((state) => state.setNodes);
    const setEdges = useStore((state) => state.setEdges);
    const connectMode = useStore((state) => state.connectMode);
    const toggleConnectMode = useStore((state) => state.toggleConnectMode);

    const undo = useStore((state) => state.undo);
    const redo = useStore((state) => state.redo);
    const canUndo = useStore((state) => state.past.length > 0);
    const canRedo = useStore((state) => state.future.length > 0);

    const setTheme = useStore((state) => state.setTheme);
    const theme = useStore((state) => state.theme);
    const reactFlow = useReactFlow();

    if (isReadOnly) return null;

    const getSpawnPosition = () => {
        const offset = ((nodes.length % 6) - 2.5) * 50;
        const verticalOffset = ((nodes.length % 4) - 1.5) * 40;
        const centerX = (typeof window !== 'undefined' ? window.innerWidth / 2 : 500) + offset;
        const centerY = (typeof window !== 'undefined' ? window.innerHeight / 2 : 400) + verticalOffset;
        const posFn = reactFlow?.screenToFlowPosition || reactFlow?.project || ((p: { x: number; y: number }) => p);
        return posFn({ x: centerX, y: centerY }) || { x: centerX, y: centerY };
    };

    const addSticky = () => {
        const color = activeColor || '#fef3c7';
        const newNode = {
            id: `sticky-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            type: 'sticky',
            position: getSpawnPosition(),
            data: { label: '', color },
        };
        addNode(newNode);
    };

    const addImage = () => {
        const newNode = {
            id: `image-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            type: 'image',
            position: getSpawnPosition(),
            data: { caption: '', src: '' },
        };
        addNode(newNode);
    };

    const addText = () => {
        const newNode = {
            id: `text-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            type: 'text',
            position: getSpawnPosition(),
            data: { label: 'New Text' },
        };
        addNode(newNode);
    };

    const addArticle = () => {
        const newNode = {
            id: `article-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            type: 'article',
            position: getSpawnPosition(),
            data: { title: '', url: '' },
        };
        addNode(newNode);
    };

    const addLink = () => {
        const newNode = {
            id: `link-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            type: 'link',
            position: getSpawnPosition(),
            data: { title: 'Web Record', url: '' },
        };
        addNode(newNode);
    };

    const handleColorClick = (c: string) => {
        setActiveColor(c);
        const selectedSticky = nodes.find((n) => n.selected && n.type === 'sticky');
        if (selectedSticky) {
            useStore.getState().takeSnapshot();
            useStore.getState().updateNodeData(selectedSticky.id, { color: c });
        }
    };

    const handleClear = () => {
        if (typeof window !== 'undefined' && window.confirm('Are you sure you want to clear all clues and strings from the board?')) {
            useStore.getState().takeSnapshot();
            setNodes([]);
            setEdges([]);
            toast.success('Board cleared (Undo with Ctrl+Z)');
        }
    };

    const handleExport = () => {
        const data = { nodes, edges };
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `case-file-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target?.result as string);
                if (json.nodes && json.edges) {
                    const validTypes = ['sticky', 'image', 'text', 'article', 'link'];
                    if (json.nodes.some((n: Record<string, unknown>) => n.type && !validTypes.includes(n.type as string))) {
                        toast.error('File contains invalid node types');
                        return;
                    }
                    const hasExistingContent = (nodes && nodes.length > 0) || (edges && edges.length > 0);
                    let shouldProceed = true;
                    if (hasExistingContent) {
                        try {
                            shouldProceed = typeof window !== 'undefined' && typeof window.confirm === 'function' ? confirm('Import will replace current board content. Continue?') : true;
                        } catch {
                            shouldProceed = true;
                        }
                    }
                    if (shouldProceed) {
                        useStore.getState().takeSnapshot();
                        setNodes(json.nodes);
                        setEdges(json.edges);
                        toast.success('Evidence board imported (Undo with Ctrl+Z)');
                    }
                } else {
                    toast.error('Invalid file format: Missing nodes or edges');
                }
            } catch (err) {
                console.error(err);
                toast.error('Failed to parse JSON file');
            }
        };
        reader.onerror = () => { toast.error('Failed to read file'); };
        reader.readAsText(file);
        event.target.value = '';
    };

    const colors = ['#fef3c7', '#fca5a5', '#99f6e4', '#bfdbfe', '#bbf7d0'];
    const themes = [
        { id: 'theme-cork', name: 'Cork', color: '#a1887f' },
        { id: 'theme-noir', name: 'Noir', color: '#0f172a' },
        { id: 'theme-blueprint', name: 'Blueprint', color: '#1e3a8a' },
        { id: 'theme-minimal', name: 'Minimal', color: '#f7f1e3' },
        { id: 'theme-profile', name: 'Confidential', color: '#1c1917' },
    ];

    return (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-[var(--panel-background)]/95 backdrop-blur-md border border-[var(--panel-border)] p-2 rounded-xl shadow-2xl flex gap-2 z-40 pointer-events-auto items-center text-[var(--panel-foreground)] transition-colors duration-300 max-w-[calc(100vw-32px)] overflow-x-auto no-scrollbar">
            {/* Color selection */}
            <div className="flex gap-1 mr-2 border-r border-[var(--panel-border)] pr-2">
                {colors.map((c) => (
                    <button
                        key={c}
                        onClick={() => handleColorClick(c)}
                        className={`w-5 h-5 rounded-full border border-[var(--panel-border)] transition-transform ${activeColor === c ? 'scale-125 ring-2 ring-[var(--sidebar-accent)]' : 'hover:scale-110'}`}
                        style={{ backgroundColor: c }}
                        title={c}
                        aria-label={`Color: ${c}`}
                    />
                ))}
            </div>

            {/* Theme selection */}
            <div className="flex gap-1 mr-2 border-r border-[var(--panel-border)] pr-2">
                {themes.map((t) => (
                    <button
                        key={t.id}
                        onClick={() => setTheme(t.id)}
                        className={`w-5 h-5 rounded-full border border-[var(--panel-border)] transition-transform ${theme === t.id ? 'scale-125 ring-2 ring-[var(--sidebar-accent)]' : 'hover:scale-110'}`}
                        style={{ backgroundColor: t.color }}
                        title={t.name}
                    />
                ))}
            </div>

            {/* Node creation buttons */}
            <button
                onClick={addSticky}
                aria-label="Add Sticky Note"
                data-testid="add-sticky"
                className="px-3 py-2 hover:bg-[var(--sidebar-accent)]/10 hover:text-[var(--sidebar-accent)] rounded-lg text-sm font-medium transition-colors text-[var(--panel-foreground)]"
            >
                Sticky
            </button>
            <button
                onClick={addText}
                aria-label="Add Text"
                data-testid="add-text"
                className="px-3 py-2 hover:bg-[var(--sidebar-accent)]/10 hover:text-[var(--sidebar-accent)] rounded-lg text-sm font-medium transition-colors text-[var(--panel-foreground)]"
            >
                Text
            </button>
            <button
                onClick={addImage}
                aria-label="Add Image"
                data-testid="add-image"
                className="px-3 py-2 hover:bg-[var(--sidebar-accent)]/10 hover:text-[var(--sidebar-accent)] rounded-lg text-sm font-medium transition-colors text-[var(--panel-foreground)]"
            >
                Image
            </button>
            <button
                onClick={addArticle}
                aria-label="Add Article"
                data-testid="add-article"
                className="px-3 py-2 hover:bg-[var(--sidebar-accent)]/10 hover:text-[var(--sidebar-accent)] rounded-lg text-sm font-medium transition-colors text-[var(--panel-foreground)]"
            >
                Article
            </button>
            <button
                onClick={addLink}
                aria-label="Add Link"
                data-testid="add-link"
                className="px-3 py-2 hover:bg-[var(--sidebar-accent)]/10 hover:text-[var(--sidebar-accent)] rounded-lg text-sm font-medium transition-colors text-[var(--panel-foreground)] flex items-center gap-1"
            >
                <Link2 size={14} />
                Link
            </button>

            {/* Connect mode toggle */}
            <button
                onClick={toggleConnectMode}
                aria-label="Toggle Connect Mode"
                data-testid="toggle-connect-mode"
                title="Toggle Connect Mode"
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
                    connectMode
                        ? 'bg-red-600 text-white shadow-sm ring-2 ring-red-400'
                        : 'hover:bg-[var(--sidebar-accent)]/10 text-[var(--panel-foreground)]'
                }`}
            >
                <GitCommit size={14} className={connectMode ? 'text-white' : 'text-red-500'} />
                String
            </button>

            {/* Undo / Redo controls */}
            <div className="flex gap-1 border-l border-r border-[var(--panel-border)] px-1 mx-1">
                <button
                    onClick={undo}
                    disabled={!canUndo}
                    aria-label="Undo"
                    data-testid="toolbar-undo"
                    title="Undo (Ctrl+Z)"
                    className={`p-2 rounded-lg text-sm transition-colors ${
                        canUndo
                            ? 'hover:bg-[var(--sidebar-accent)]/10 text-[var(--panel-foreground)]'
                            : 'opacity-30 cursor-not-allowed text-[var(--panel-foreground)]'
                    }`}
                >
                    <Undo2 size={16} />
                </button>
                <button
                    onClick={redo}
                    disabled={!canRedo}
                    aria-label="Redo"
                    data-testid="toolbar-redo"
                    title="Redo (Ctrl+Shift+Z)"
                    className={`p-2 rounded-lg text-sm transition-colors ${
                        canRedo
                            ? 'hover:bg-[var(--sidebar-accent)]/10 text-[var(--panel-foreground)]'
                            : 'opacity-30 cursor-not-allowed text-[var(--panel-foreground)]'
                    }`}
                >
                    <Redo2 size={16} />
                </button>
            </div>

            <label className="p-2 hover:bg-[var(--sidebar-accent)]/10 hover:text-[var(--sidebar-accent)] rounded-lg text-[var(--panel-foreground)]/70 transition-colors cursor-pointer" title="Import JSON">
                <Upload size={18} />
                <input type="file" className="hidden" accept=".json" onChange={handleImport} />
            </label>
            <button onClick={handleExport} className="p-2 hover:bg-[var(--sidebar-accent)]/10 hover:text-[var(--sidebar-accent)] rounded-lg text-[var(--panel-foreground)]/70 transition-colors" title="Export JSON">
                <Download size={18} />
            </button>
            <button onClick={handleClear} className="p-2 hover:bg-red-500/10 text-red-500 hover:text-red-400 rounded-lg transition-colors" title="Clear Board">
                <Trash2 size={18} />
            </button>
        </div>
    );
};

export default Toolbar;
