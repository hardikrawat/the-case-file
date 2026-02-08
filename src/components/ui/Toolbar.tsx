'use client';

import React from 'react';
import { useReactFlow } from 'reactflow';
import useStore from '@/store/useStore';

import { Download, Trash2, Link, Upload } from 'lucide-react';

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
    const setTheme = useStore((state) => state.setTheme);
    const theme = useStore((state) => state.theme);
    const { project } = useReactFlow();

    if (isReadOnly) return null;

    const addSticky = () => {
        // Default to center-ish if project doesn't work as expected in all contexts
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;

        // Project screen coordinates to flow coordinates
        // We need to account for the viewport transform
        const projected = project({ x: centerX, y: centerY });

        // Use activeColor or default
        const color = activeColor || '#fef3c7';

        const newNode = {
            id: `sticky-${Date.now()}`,
            type: 'sticky',
            position: projected || { x: centerX, y: centerY },
            data: { label: '', color },
        };
        addNode(newNode);
    };

    const addImage = () => {
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        const projected = project({ x: centerX, y: centerY });

        const newNode = {
            id: `image-${Date.now()}`,
            type: 'image',
            position: projected || { x: centerX, y: centerY },
            data: { caption: '', src: '' },
        };
        addNode(newNode);
    };

    const addText = () => {
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        const projected = project({ x: centerX, y: centerY });

        const newNode = {
            id: `text-${Date.now()}`,
            type: 'text',
            position: projected || { x: centerX, y: centerY },
            data: { label: 'New Text' },
        };
        addNode(newNode);
    };

    const addArticle = () => {
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        const projected = project({ x: centerX, y: centerY });

        const newNode = {
            id: `article-${Date.now()}`,
            type: 'article',
            position: projected || { x: centerX, y: centerY },
            data: { title: '', url: '' },
        };
        addNode(newNode);
    };

    const handleClear = () => {
        if (confirm('Are you sure you want to clear the board?')) {
            setNodes([]);
            setEdges([]);
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
                    setNodes(json.nodes);
                    setEdges(json.edges);
                } else {
                    alert('Invalid file format');
                }
            } catch (err) {
                console.error(err);
                alert('Failed to parse JSON');
            }
        };
        reader.readAsText(file);
        // Reset input
        event.target.value = '';
    };



    const colors = ['#fef3c7', '#fca5a5', '#99f6e4', '#bfdbfe', '#bbf7d0'];
    const themes = [
        { id: 'theme-cork', name: 'Cork', color: '#a1887f' },
        { id: 'theme-noir', name: 'Noir', color: '#0f172a' },
        { id: 'theme-blueprint', name: 'Blueprint', color: '#1e3a8a' },
        { id: 'theme-minimal', name: 'Minimal', color: '#f7f1e3' },
    ];

    return (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-white/90 backdrop-blur-sm border border-gray-200 p-2 rounded-xl shadow-xl flex gap-2 z-50 pointer-events-auto items-center text-gray-900">
            <div className="flex gap-1 mr-2 border-r border-gray-300 pr-2">
                {colors.map((c) => (
                    <button
                        key={c}
                        onClick={() => setActiveColor(c)}
                        className={`w-5 h-5 rounded-full border border-gray-300 transition-transform ${activeColor === c ? 'scale-125 border-gray-400' : 'hover:scale-110'}`}
                        style={{ backgroundColor: c }}
                        title={c}
                    />
                ))}
            </div>

            <div className="flex gap-1 mr-2 border-r border-gray-300 pr-2">
                {themes.map((t) => (
                    <button
                        key={t.id}
                        onClick={() => setTheme(t.id)}
                        className={`w-5 h-5 rounded-full border border-gray-300 transition-transform ${theme === t.id ? 'scale-125 border-gray-400 ring-2 ring-offset-1 ring-blue-400' : 'hover:scale-110'}`}
                        style={{ backgroundColor: t.color }}
                        title={t.name}
                    />
                ))}
            </div>

            <button onClick={addSticky} className="px-4 py-2 hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors text-gray-700">Sticky</button>
            <button onClick={addText} className="px-4 py-2 hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors text-gray-700">Text</button>
            <button onClick={addImage} className="px-4 py-2 hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors text-gray-700">Image</button>
            <button onClick={addArticle} className="px-4 py-2 hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors text-gray-700">Article</button>

            <div className="w-px h-6 bg-gray-300 mx-2"></div>

            <button
                onClick={toggleConnectMode}
                className={`p-2 rounded-lg transition-colors ${connectMode ? 'bg-blue-100 text-blue-600 ring-2 ring-blue-400' : 'hover:bg-gray-100 text-gray-600'}`}
                title={connectMode ? "Exit Connect Mode" : "Connect Items"}
            >
                <Link size={18} />
            </button>

            <label className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors cursor-pointer" title="Import JSON">
                <Upload size={18} />
                <input type="file" className="hidden" accept=".json" onChange={handleImport} />
            </label>
            <button onClick={handleExport} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors" title="Export JSON"><Download size={18} /></button>
            <button onClick={handleClear} className="p-2 hover:bg-red-100 text-red-600 rounded-lg transition-colors" title="Clear Board"><Trash2 size={18} /></button>


        </div>
    );
};

export default Toolbar;
