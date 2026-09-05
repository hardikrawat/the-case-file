'use client';

import React from 'react';
import useStore from '@/store/useStore';
import { useShallow } from 'zustand/react/shallow';
import {
    Palette,
    Check,
    Save,
    ShieldAlert,
    Grid,
    Navigation,
    RotateCcw,
    Sliders,
    MousePointer,
} from 'lucide-react';
import { toast } from 'sonner';

export default function SettingsPage() {
    const {
        theme,
        setTheme,
        autoSaveEnabled,
        setAutoSaveEnabled,
        autoSaveDelay,
        setAutoSaveDelay,
        snapToGrid,
        setSnapToGrid,
        gridSize,
        setGridSize,
        canvasBackground,
        setCanvasBackground,
        warnOnUnsavedChanges,
        setWarnOnUnsavedChanges,
        zoomOnScroll,
        setZoomOnScroll,
        panOnDrag,
        setPanOnDrag,
        showMiniMapDefault,
        setShowMiniMapDefault,
        resetPreferences,
    } = useStore(
        useShallow((state) => ({
            theme: state.theme,
            setTheme: state.setTheme,
            autoSaveEnabled: state.autoSaveEnabled,
            setAutoSaveEnabled: state.setAutoSaveEnabled,
            autoSaveDelay: state.autoSaveDelay,
            setAutoSaveDelay: state.setAutoSaveDelay,
            snapToGrid: state.snapToGrid,
            setSnapToGrid: state.setSnapToGrid,
            gridSize: state.gridSize,
            setGridSize: state.setGridSize,
            canvasBackground: state.canvasBackground,
            setCanvasBackground: state.setCanvasBackground,
            warnOnUnsavedChanges: state.warnOnUnsavedChanges,
            setWarnOnUnsavedChanges: state.setWarnOnUnsavedChanges,
            zoomOnScroll: state.zoomOnScroll,
            setZoomOnScroll: state.setZoomOnScroll,
            panOnDrag: state.panOnDrag,
            setPanOnDrag: state.setPanOnDrag,
            showMiniMapDefault: state.showMiniMapDefault,
            setShowMiniMapDefault: state.setShowMiniMapDefault,
            resetPreferences: state.resetPreferences,
        }))
    );

    const themes = [
        { id: 'theme-cork', name: 'Cork Board', color: '#a1887f', desc: 'Classic detective cork texture' },
        { id: 'theme-noir', name: 'Noir Detective', color: '#0f172a', desc: 'Moody deep-midnight aesthetic' },
        { id: 'theme-blueprint', name: 'Blueprint', color: '#1e3a8a', desc: 'Architectural case blueprint' },
        { id: 'theme-minimal', name: 'Minimalist Dossier', color: '#f7f1e3', desc: 'Clean, modern paper dossier' },
        { id: 'theme-profile', name: 'Confidential File', color: '#1c1917', desc: 'High-contrast redacted dark' },
    ];

    const handleReset = () => {
        resetPreferences();
        toast.success('Investigation and auto-save preferences restored to defaults');
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-16">
            
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-panel-border pb-6">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-sidebar-accent/10 rounded-xl text-sidebar-accent border border-sidebar-accent/20">
                        <Sliders className="w-8 h-8" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold font-serif text-sidebar-foreground">Investigation Settings</h1>
                        <p className="text-sm text-sidebar-foreground/60">Customize auto-save, evidence canvas controls, and dossier environment</p>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={handleReset}
                    className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-panel/60 border border-panel-border text-panel-foreground/80 hover:text-foreground hover:bg-sidebar-accent/15 transition-colors self-start sm:self-auto shadow-sm"
                    title="Restore default settings"
                >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset to Defaults</span>
                </button>
            </div>

            {/* SECTION 1: Auto-Save & Data Protection */}
            <section className="bg-panel/50 border border-panel-border rounded-xl p-6 sm:p-8 backdrop-blur-sm space-y-6">
                <div className="flex items-center gap-2.5 pb-2 border-b border-panel-border">
                    <div className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-400">
                        <Save className="w-4 h-4" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-panel-foreground">Auto-Save & Data Protection</h2>
                        <p className="text-xs text-panel-foreground/60">Manage automatic background saving and prevent accidental loss of investigation progress</p>
                    </div>
                </div>

                {/* Auto-Save Master Toggle */}
                <div className="p-4 rounded-xl bg-background/60 border border-panel-border space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1 pr-4">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-foreground">
                                    Automatic Canvas Saving
                                </span>
                                <span
                                    className={`text-[10px] px-2 py-0.5 rounded font-mono font-semibold ${
                                        autoSaveEnabled
                                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                    }`}
                                >
                                    {autoSaveEnabled ? 'Enabled' : 'Disabled (Manual Save Mode)'}
                                </span>
                            </div>
                            <p className="text-xs text-panel-foreground/70 leading-relaxed max-w-2xl">
                                Automatically save clues, sticky notes, photographs, and red string connections in the background as you work. When disabled, changes are only saved when you click the Save button or press <kbd className="px-1 py-0.5 bg-black/40 rounded border border-panel-border text-[11px] font-mono">Cmd+S</kbd>.
                            </p>
                        </div>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={autoSaveEnabled}
                            onClick={() => {
                                const next = !autoSaveEnabled;
                                setAutoSaveEnabled(next);
                                toast.info(next ? 'Auto-save activated' : 'Auto-save disabled (Manual Save Mode active)');
                            }}
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-sidebar-accent/50 ${
                                autoSaveEnabled ? 'bg-sidebar-accent' : 'bg-neutral-700'
                            }`}
                        >
                            <span
                                aria-hidden="true"
                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                    autoSaveEnabled ? 'translate-x-5' : 'translate-x-0'
                                }`}
                            />
                        </button>
                    </div>

                    {/* Auto-Save Interval Options */}
                    {autoSaveEnabled && (
                        <div className="pt-3 border-t border-panel-border/60 space-y-2">
                            <label className="text-xs font-semibold text-panel-foreground/80 block">
                                Auto-Save Delay Interval
                            </label>
                            <p className="text-[11px] text-panel-foreground/60">
                                How long to wait after moving evidence or editing notes before automatically saving:
                            </p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {[
                                    { label: '1s (Fast)', value: 1000, desc: 'Real-time saves' },
                                    { label: '2s (Normal)', value: 2000, desc: 'Recommended' },
                                    { label: '5s (Relaxed)', value: 5000, desc: 'Fewer network saves' },
                                    { label: '10s (Slow)', value: 10000, desc: 'Minimal background saves' },
                                ].map((interval) => (
                                    <button
                                        key={interval.value}
                                        type="button"
                                        onClick={() => {
                                            setAutoSaveDelay(interval.value);
                                            toast.success(`Auto-save interval set to ${interval.label}`);
                                        }}
                                        className={`p-2.5 text-left rounded-lg border transition-all ${
                                            autoSaveDelay === interval.value
                                                ? 'bg-sidebar-accent/15 border-sidebar-accent text-sidebar-accent font-semibold ring-1 ring-sidebar-accent/30 shadow-sm'
                                                : 'bg-panel/40 border-panel-border text-panel-foreground/70 hover:border-sidebar-accent/40'
                                        }`}
                                    >
                                        <div className="text-xs font-bold">{interval.label}</div>
                                        <div className="text-[10px] text-panel-foreground/50">{interval.desc}</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Unsaved Changes Safety Prompt */}
                <div className="p-4 rounded-xl bg-background/60 border border-panel-border flex items-center justify-between">
                    <div className="space-y-1 pr-4">
                        <div className="flex items-center gap-2">
                            <ShieldAlert className="w-4 h-4 text-amber-400" />
                            <span className="text-sm font-bold text-foreground">
                                Warn on Unsaved Dossier Edits
                            </span>
                        </div>
                        <p className="text-xs text-panel-foreground/70 leading-relaxed max-w-2xl">
                            Display a confirmation warning before closing your browser tab or navigating to another page if you have uncommitted evidence changes.
                        </p>
                    </div>
                    <button
                        type="button"
                        role="switch"
                        aria-checked={warnOnUnsavedChanges}
                        onClick={() => {
                            const next = !warnOnUnsavedChanges;
                            setWarnOnUnsavedChanges(next);
                            toast.info(next ? 'Unsaved navigation warnings enabled' : 'Unsaved navigation warnings disabled');
                        }}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-sidebar-accent/50 ${
                            warnOnUnsavedChanges ? 'bg-sidebar-accent' : 'bg-neutral-700'
                        }`}
                    >
                        <span
                            aria-hidden="true"
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                warnOnUnsavedChanges ? 'translate-x-5' : 'translate-x-0'
                            }`}
                        />
                    </button>
                </div>
            </section>

            {/* SECTION 2: Investigation Canvas & Grid */}
            <section className="bg-panel/50 border border-panel-border rounded-xl p-6 sm:p-8 backdrop-blur-sm space-y-6">
                <div className="flex items-center gap-2.5 pb-2 border-b border-panel-border">
                    <div className="p-1.5 rounded-md bg-blue-500/10 text-blue-400">
                        <Grid className="w-4 h-4" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-panel-foreground">Canvas & Alignment Controls</h2>
                        <p className="text-xs text-panel-foreground/60">Configure evidence alignment, magnetic grid snapping, and board visual style</p>
                    </div>
                </div>

                {/* Snap to Grid Toggle */}
                <div className="p-4 rounded-xl bg-background/60 border border-panel-border space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1 pr-4">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-foreground">
                                    Snap Evidence to Grid
                                </span>
                                <span
                                    className={`text-[10px] px-2 py-0.5 rounded font-mono font-semibold ${
                                        snapToGrid
                                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                            : 'bg-neutral-500/20 text-neutral-400 border border-panel-border'
                                    }`}
                                >
                                    {snapToGrid ? 'Active' : 'Freeform Placement'}
                                </span>
                            </div>
                            <p className="text-xs text-panel-foreground/70 leading-relaxed max-w-2xl">
                                Magnetically snap clues, images, sticky notes, and evidence cards into orderly positions when dragging across the board.
                            </p>
                        </div>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={snapToGrid}
                            onClick={() => {
                                const next = !snapToGrid;
                                setSnapToGrid(next);
                                toast.info(next ? 'Grid snapping enabled' : 'Grid snapping disabled (Freeform mode)');
                            }}
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-sidebar-accent/50 ${
                                snapToGrid ? 'bg-sidebar-accent' : 'bg-neutral-700'
                            }`}
                        >
                            <span
                                aria-hidden="true"
                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                    snapToGrid ? 'translate-x-5' : 'translate-x-0'
                                }`}
                            />
                        </button>
                    </div>

                    {/* Grid Step Interval */}
                    {snapToGrid && (
                        <div className="pt-3 border-t border-panel-border/60 space-y-2">
                            <label className="text-xs font-semibold text-panel-foreground/80 block">
                                Grid Step Size
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { label: '10px (Fine)', value: 10, desc: 'Precise subtle alignment' },
                                    { label: '15px (Balanced)', value: 15, desc: 'Even layout spacing' },
                                    { label: '20px (Spacious)', value: 20, desc: 'Clean organized tiles' },
                                ].map((size) => (
                                    <button
                                        key={size.value}
                                        type="button"
                                        onClick={() => {
                                            setGridSize(size.value);
                                            toast.success(`Grid spacing set to ${size.label}`);
                                        }}
                                        className={`p-2.5 text-left rounded-lg border transition-all ${
                                            gridSize === size.value
                                                ? 'bg-sidebar-accent/15 border-sidebar-accent text-sidebar-accent font-semibold ring-1 ring-sidebar-accent/30 shadow-sm'
                                                : 'bg-panel/40 border-panel-border text-panel-foreground/70 hover:border-sidebar-accent/40'
                                        }`}
                                    >
                                        <div className="text-xs font-bold">{size.label}</div>
                                        <div className="text-[10px] text-panel-foreground/50">{size.desc}</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Canvas Background Pattern */}
                <div className="p-4 rounded-xl bg-background/60 border border-panel-border space-y-3">
                    <label className="text-sm font-bold text-foreground block">
                        Canvas Background Pattern
                    </label>
                    <p className="text-xs text-panel-foreground/70">
                        Select the coordinate style or texture rendered across the board backdrop:
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                            { id: 'dots', label: 'Evidence Dots', desc: 'Classic detective cork dots' },
                            { id: 'lines', label: 'Forensic Grid', desc: 'Architectural graph paper' },
                            { id: 'cross', label: 'Crosshairs', desc: 'Target coordinate marks' },
                            { id: 'none', label: 'Clean Slate', desc: 'Solid backdrop with no pattern' },
                        ].map((pattern) => (
                            <button
                                key={pattern.id}
                                type="button"
                                onClick={() => {
                                    setCanvasBackground(pattern.id as 'dots' | 'lines' | 'cross' | 'none');
                                    toast.success(`Background style changed to ${pattern.label}`);
                                }}
                                className={`p-3 rounded-xl border text-left transition-all ${
                                    canvasBackground === pattern.id
                                        ? 'bg-sidebar-accent/15 border-sidebar-accent text-sidebar-accent ring-1 ring-sidebar-accent/30 shadow-sm'
                                        : 'bg-panel/40 border-panel-border text-panel-foreground/70 hover:border-sidebar-accent/30'
                                }`}
                            >
                                <div className="text-xs font-bold mb-0.5">{pattern.label}</div>
                                <div className="text-[10px] text-panel-foreground/50">{pattern.desc}</div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Minimap Default State */}
                <div className="p-4 rounded-xl bg-background/60 border border-panel-border flex items-center justify-between">
                    <div className="space-y-1 pr-4">
                        <div className="flex items-center gap-2">
                            <Navigation className="w-4 h-4 text-sidebar-accent" />
                            <span className="text-sm font-bold text-foreground">
                                Open MiniMap Radar by Default
                            </span>
                        </div>
                        <p className="text-xs text-panel-foreground/70 leading-relaxed max-w-2xl">
                            Keep the bottom-right board overview minimap visible automatically whenever opening a case dossier.
                        </p>
                    </div>
                    <button
                        type="button"
                        role="switch"
                        aria-checked={showMiniMapDefault}
                        onClick={() => {
                            const next = !showMiniMapDefault;
                            setShowMiniMapDefault(next);
                            toast.info(next ? 'MiniMap default enabled' : 'MiniMap default disabled');
                        }}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-sidebar-accent/50 ${
                            showMiniMapDefault ? 'bg-sidebar-accent' : 'bg-neutral-700'
                        }`}
                    >
                        <span
                            aria-hidden="true"
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                showMiniMapDefault ? 'translate-x-5' : 'translate-x-0'
                            }`}
                        />
                    </button>
                </div>
            </section>

            {/* SECTION 3: Canvas Navigation & Gestures */}
            <section className="bg-panel/50 border border-panel-border rounded-xl p-6 sm:p-8 backdrop-blur-sm space-y-6">
                <div className="flex items-center gap-2.5 pb-2 border-b border-panel-border">
                    <div className="p-1.5 rounded-md bg-purple-500/10 text-purple-400">
                        <MousePointer className="w-4 h-4" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-panel-foreground">Navigation & Gestures</h2>
                        <p className="text-xs text-panel-foreground/60">Configure mouse wheel scrolling, zoom behavior, and canvas panning</p>
                    </div>
                </div>

                <div className="space-y-3">
                    {/* Zoom on Scroll */}
                    <div className="p-4 rounded-xl bg-background/60 border border-panel-border flex items-center justify-between">
                        <div className="space-y-1 pr-4">
                            <span className="text-sm font-bold text-foreground block">
                                Zoom with Mouse Wheel / Trackpad
                            </span>
                            <p className="text-xs text-panel-foreground/70 leading-relaxed max-w-2xl">
                                Scrolling the mouse wheel or pinching with trackpad zooms the evidence board smoothly in and out.
                            </p>
                        </div>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={zoomOnScroll}
                            onClick={() => {
                                const next = !zoomOnScroll;
                                setZoomOnScroll(next);
                                toast.info(next ? 'Zoom on scroll enabled' : 'Zoom on scroll disabled');
                            }}
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-sidebar-accent/50 ${
                                zoomOnScroll ? 'bg-sidebar-accent' : 'bg-neutral-700'
                            }`}
                        >
                            <span
                                aria-hidden="true"
                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                    zoomOnScroll ? 'translate-x-5' : 'translate-x-0'
                                }`}
                            />
                        </button>
                    </div>

                    {/* Pan on Drag */}
                    <div className="p-4 rounded-xl bg-background/60 border border-panel-border flex items-center justify-between">
                        <div className="space-y-1 pr-4">
                            <span className="text-sm font-bold text-foreground block">
                                Pan Canvas on Drag
                            </span>
                            <p className="text-xs text-panel-foreground/70 leading-relaxed max-w-2xl">
                                Click and drag on empty canvas background to effortlessly pan across large investigation boards.
                            </p>
                        </div>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={panOnDrag}
                            onClick={() => {
                                const next = !panOnDrag;
                                setPanOnDrag(next);
                                toast.info(next ? 'Pan on drag enabled' : 'Pan on drag disabled');
                            }}
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-sidebar-accent/50 ${
                                panOnDrag ? 'bg-sidebar-accent' : 'bg-neutral-700'
                            }`}
                        >
                            <span
                                aria-hidden="true"
                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                    panOnDrag ? 'translate-x-5' : 'translate-x-0'
                                }`}
                            />
                        </button>
                    </div>
                </div>
            </section>

            {/* SECTION 4: Appearance & Themes */}
            <section className="bg-panel/50 border border-panel-border rounded-xl p-6 sm:p-8 backdrop-blur-sm space-y-6">
                <div className="flex items-center gap-2.5 pb-2 border-b border-panel-border">
                    <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-400">
                        <Palette className="w-4 h-4" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-panel-foreground">Appearance & Themes</h2>
                        <p className="text-xs text-panel-foreground/60">Choose the detective environment color palette and mood</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {themes.map((t) => (
                        <button
                            key={t.id}
                            type="button"
                            onClick={() => {
                                setTheme(t.id);
                                toast.success(`Theme set to ${t.name}`);
                            }}
                            className={`group relative flex items-center gap-4 p-4 rounded-xl border transition-all duration-200 text-left hover:scale-[1.01] ${
                                theme === t.id
                                    ? 'bg-sidebar-accent/15 border-sidebar-accent ring-1 ring-sidebar-accent shadow-md'
                                    : 'bg-background/50 border-panel-border hover:border-sidebar-accent/40'
                            }`}
                        >
                            <div
                                className="w-11 h-11 rounded-xl border border-panel-border shadow-sm shrink-0"
                                style={{ backgroundColor: t.color }}
                            />
                            <div className="flex-1 min-w-0">
                                <span className={`block font-bold text-sm truncate ${theme === t.id ? 'text-sidebar-accent' : 'text-panel-foreground'}`}>
                                    {t.name}
                                </span>
                                <span className="text-[11px] text-panel-foreground/60 block line-clamp-1">
                                    {t.desc}
                                </span>
                            </div>
                            {theme === t.id && (
                                <div className="p-1 rounded-full bg-sidebar-accent/20 text-sidebar-accent">
                                    <Check className="w-4 h-4" />
                                </div>
                            )}
                        </button>
                    ))}
                </div>
            </section>

            {/* SECTION 5: Keybinds Quick Reference */}
            <section className="bg-purple-950/20 border border-purple-800/30 rounded-xl p-6 text-purple-200 space-y-3">
                <h3 className="font-bold text-sm text-purple-300 flex items-center gap-2">
                    <span>Detective Keybinds Reference</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
                    <div className="p-3 bg-black/40 rounded-lg border border-purple-800/30 space-y-1">
                        <div className="text-purple-300 font-bold">Cmd+S / Ctrl+S</div>
                        <div className="text-purple-200/70 text-[11px] font-sans">Instantly save case file</div>
                    </div>
                    <div className="p-3 bg-black/40 rounded-lg border border-purple-800/30 space-y-1">
                        <div className="text-purple-300 font-bold">Cmd+Z / Ctrl+Z</div>
                        <div className="text-purple-200/70 text-[11px] font-sans">Undo canvas action</div>
                    </div>
                    <div className="p-3 bg-black/40 rounded-lg border border-purple-800/30 space-y-1">
                        <div className="text-purple-300 font-bold">Cmd+Shift+Z</div>
                        <div className="text-purple-200/70 text-[11px] font-sans">Redo canvas action</div>
                    </div>
                    <div className="p-3 bg-black/40 rounded-lg border border-purple-800/30 space-y-1">
                        <div className="text-purple-300 font-bold">Escape</div>
                        <div className="text-purple-200/70 text-[11px] font-sans">Cancel connect mode</div>
                    </div>
                </div>
            </section>
        </div>
    );
}

