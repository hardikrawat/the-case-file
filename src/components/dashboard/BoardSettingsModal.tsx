'use client';

import React, { useState, useEffect } from 'react';
import {
    X,
    Globe,
    Lock,
    Save,
    FileText,
    Grid,
    RotateCcw,
    Sparkles,
    Check,
    Navigation,
    ShieldAlert,
} from 'lucide-react';
import useStore from '@/store/useStore';
import { useShallow } from 'zustand/react/shallow';
import AppleSpinner from "@/components/ui/AppleSpinner";
import { toast } from 'sonner';

interface BoardSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    boardId: string;
}

type TabType = 'dossier' | 'autosave' | 'canvas';

export default function BoardSettingsModal({ isOpen, onClose, boardId }: BoardSettingsModalProps) {
    const {
        boardTitle,
        isPublic,
        parentId,
        boardVersion,
        setBoardMetadata,
        setBoardVersion,

        // Canvas & Editor Preferences
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
    } = useStore(useShallow((state) => ({
        boardTitle: state.boardTitle,
        isPublic: state.isPublic,
        parentId: state.parentId,
        boardVersion: state.boardVersion,
        setBoardMetadata: state.setBoardMetadata,
        setBoardVersion: state.setBoardVersion,

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
    })));

    const [activeTab, setActiveTab] = useState<TabType>('dossier');
    const [title, setTitle] = useState(boardTitle);
    const [publicAccess, setPublicAccess] = useState(isPublic);
    const [saving, setSaving] = useState(false);

    // Sync local state with store when modal opens
    useEffect(() => {
        if (isOpen) {
            setTitle(boardTitle);
            setPublicAccess(isPublic);
        }
    }, [isOpen, boardTitle, isPublic]);

    if (!isOpen) return null;

    const handleSaveDossier = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedTitle = title.trim();
        if (!trimmedTitle) {
            toast.error('Case title cannot be empty');
            return;
        }
        if (trimmedTitle.length > 120) {
            toast.error('Case title cannot exceed 120 characters');
            return;
        }

        setSaving(true);

        try {
            const res = await fetch(`/api/boards/${boardId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: trimmedTitle,
                    isPublic: publicAccess,
                    version: boardVersion
                }),
            });

            if (res.ok) {
                const data = await res.json().catch(() => ({}));
                if (typeof data.version === 'number') {
                    setBoardVersion(data.version);
                    useStore.getState().setBoardVersion(data.version);
                }
                setBoardMetadata(trimmedTitle, publicAccess, parentId);
                toast.success('Dossier details saved successfully');
            } else if (res.status === 409) {
                const data = await res.json().catch(() => ({}));
                toast.error(data.message || 'Case was modified in another session. Please reload the latest board.');
            } else {
                console.error('Failed to update settings');
                toast.error('Failed to save settings');
            }
        } catch (error) {
            console.error(error);
            toast.error('Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    const handleResetDefaults = () => {
        resetPreferences();
        toast.success('Canvas & Auto-Save settings reset to defaults');
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="w-full max-w-lg bg-[var(--panel-background)] border border-[var(--panel-border)] rounded-2xl shadow-2xl text-[var(--panel-foreground)] transition-colors duration-300 overflow-hidden flex flex-col max-h-[90vh]">
                
                {/* Modal Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--panel-border)] bg-[var(--background)]/30">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-[var(--sidebar-accent)]/10 text-[var(--sidebar-accent)]">
                            <Sparkles className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold font-serif text-[var(--foreground)]">Case & Board Settings</h2>
                            <p className="text-xs text-[var(--panel-foreground)]/60">Configure dossier visibility, auto-save, and canvas controls</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-1.5 text-[var(--panel-foreground)]/60 hover:text-[var(--foreground)] hover:bg-[var(--sidebar-accent)]/15 rounded-lg transition-colors"
                        aria-label="Close settings"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs Navigation */}
                <div className="flex border-b border-[var(--panel-border)] bg-[var(--background)]/20 px-6 pt-2 gap-2">
                    <button
                        type="button"
                        onClick={() => setActiveTab('dossier')}
                        className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold rounded-t-lg transition-all border-b-2 ${
                            activeTab === 'dossier'
                                ? 'border-[var(--sidebar-accent)] text-[var(--sidebar-accent)] bg-[var(--panel-background)] shadow-sm'
                                : 'border-transparent text-[var(--panel-foreground)]/60 hover:text-[var(--foreground)]'
                        }`}
                    >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Case Dossier</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('autosave')}
                        className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold rounded-t-lg transition-all border-b-2 ${
                            activeTab === 'autosave'
                                ? 'border-[var(--sidebar-accent)] text-[var(--sidebar-accent)] bg-[var(--panel-background)] shadow-sm'
                                : 'border-transparent text-[var(--panel-foreground)]/60 hover:text-[var(--foreground)]'
                        }`}
                    >
                        <Save className="w-3.5 h-3.5" />
                        <span>Auto-Save & Safety</span>
                        {!autoSaveEnabled && (
                            <span className="text-[10px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">Off</span>
                        )}
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('canvas')}
                        className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold rounded-t-lg transition-all border-b-2 ${
                            activeTab === 'canvas'
                                ? 'border-[var(--sidebar-accent)] text-[var(--sidebar-accent)] bg-[var(--panel-background)] shadow-sm'
                                : 'border-transparent text-[var(--panel-foreground)]/60 hover:text-[var(--foreground)]'
                        }`}
                    >
                        <Grid className="w-3.5 h-3.5" />
                        <span>Canvas & Grid</span>
                    </button>
                </div>

                {/* Modal Body */}
                <div className="p-6 overflow-y-auto space-y-6 flex-1">
                    
                    {/* TAB 1: Case Dossier */}
                    {activeTab === 'dossier' && (
                        <form onSubmit={handleSaveDossier} className="space-y-5">
                            <div className="space-y-1.5">
                                <div className="flex justify-between items-center">
                                    <label className="text-xs font-semibold text-[var(--foreground)] uppercase tracking-wider">
                                        Case File Title
                                    </label>
                                    <span className="text-[10px] text-[var(--panel-foreground)]/50 font-mono">
                                        {title.length}/120
                                    </span>
                                </div>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="w-full bg-[var(--background)] border border-[var(--panel-border)] rounded-lg px-3.5 py-2.5 text-xs md:text-sm text-[var(--foreground)] placeholder-[var(--panel-foreground)]/40 focus:outline-none focus:ring-2 focus:ring-[var(--sidebar-accent)]/50 transition-all font-medium"
                                    placeholder="e.g. The Black Dahlia"
                                    maxLength={120}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-[var(--foreground)] uppercase tracking-wider block">
                                    Visibility & Access
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setPublicAccess(false)}
                                        className={`flex flex-col items-start p-3.5 rounded-xl border text-left transition-all ${
                                            !publicAccess
                                                ? 'bg-[var(--sidebar-accent)]/10 border-[var(--sidebar-accent)] text-[var(--sidebar-accent)] ring-1 ring-[var(--sidebar-accent)]/40 shadow-sm'
                                                : 'bg-[var(--background)] border-[var(--panel-border)] text-[var(--panel-foreground)]/70 hover:border-[var(--sidebar-accent)]/40'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <Lock className="w-4 h-4" />
                                            <span className="font-bold text-xs">Private Dossier</span>
                                        </div>
                                        <span className="text-[11px] text-[var(--panel-foreground)]/60 leading-tight">
                                            Only you and invited collaborators can view or edit.
                                        </span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setPublicAccess(true)}
                                        className={`flex flex-col items-start p-3.5 rounded-xl border text-left transition-all ${
                                            publicAccess
                                                ? 'bg-[var(--sidebar-accent)]/10 border-[var(--sidebar-accent)] text-[var(--sidebar-accent)] ring-1 ring-[var(--sidebar-accent)]/40 shadow-sm'
                                                : 'bg-[var(--background)] border-[var(--panel-border)] text-[var(--panel-foreground)]/70 hover:border-[var(--sidebar-accent)]/40'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <Globe className="w-4 h-4" />
                                            <span className="font-bold text-xs">Public Case</span>
                                        </div>
                                        <span className="text-[11px] text-[var(--panel-foreground)]/60 leading-tight">
                                            Anyone in the detective community can discover and view.
                                        </span>
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={saving}
                                className="w-full bg-[var(--sidebar-accent)] hover:bg-[var(--sidebar-accent)]/90 text-[var(--sidebar-accent-foreground)] font-bold py-2.5 rounded-lg text-xs md:text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                            >
                                {saving ? (
                                    <>
                                        <AppleSpinner size="sm" />
                                        <span>Saving Dossier Changes...</span>
                                    </>
                                ) : (
                                    <>
                                        <Check className="w-4 h-4" />
                                        <span>Save Dossier Details</span>
                                    </>
                                )}
                            </button>
                        </form>
                    )}

                    {/* TAB 2: Auto-Save & Safety */}
                    {activeTab === 'autosave' && (
                        <div className="space-y-5">
                            
                            {/* Auto-Save Toggle Feature */}
                            <div className="p-4 rounded-xl bg-[var(--background)]/60 border border-[var(--panel-border)] space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5 pr-4">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-[var(--foreground)]">
                                                Automatic Canvas Saving
                                            </span>
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                                                autoSaveEnabled 
                                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                            }`}>
                                                {autoSaveEnabled ? 'Enabled' : 'Disabled'}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-[var(--panel-foreground)]/65 leading-relaxed">
                                            Automatically synchronize board clues, notes, and red string connections to the server after edits.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={autoSaveEnabled}
                                        onClick={() => {
                                            const next = !autoSaveEnabled;
                                            setAutoSaveEnabled(next);
                                            toast.info(next ? 'Auto-save activated' : 'Auto-save disabled (Manual Save Mode)');
                                        }}
                                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[var(--sidebar-accent)]/50 ${
                                            autoSaveEnabled ? 'bg-[var(--sidebar-accent)]' : 'bg-neutral-700'
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
                                    <div className="pt-2 border-t border-[var(--panel-border)]/60 space-y-1.5">
                                        <label className="text-[11px] font-semibold text-[var(--panel-foreground)]/80 block">
                                            Auto-Save Interval Delay
                                        </label>
                                        <div className="grid grid-cols-4 gap-1.5">
                                            {[
                                                { label: '1s (Fast)', value: 1000 },
                                                { label: '2s (Normal)', value: 2000 },
                                                { label: '5s (Relaxed)', value: 5000 },
                                                { label: '10s (Slow)', value: 10000 },
                                            ].map((interval) => (
                                                <button
                                                    key={interval.value}
                                                    type="button"
                                                    onClick={() => setAutoSaveDelay(interval.value)}
                                                    className={`px-2 py-1.5 text-[11px] font-medium rounded-lg border transition-all ${
                                                        autoSaveDelay === interval.value
                                                            ? 'bg-[var(--sidebar-accent)] text-[var(--sidebar-accent-foreground)] border-[var(--sidebar-accent)] font-semibold'
                                                            : 'bg-[var(--panel-background)] border-[var(--panel-border)] text-[var(--panel-foreground)]/70 hover:border-[var(--sidebar-accent)]/40'
                                                    }`}
                                                >
                                                    {interval.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Unsaved Changes Safety Prompt */}
                            <div className="p-4 rounded-xl bg-[var(--background)]/60 border border-[var(--panel-border)] flex items-center justify-between">
                                <div className="space-y-0.5 pr-4">
                                    <div className="flex items-center gap-1.5">
                                        <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                                        <span className="text-xs font-bold text-[var(--foreground)]">
                                            Warn Before Leaving Unsaved Case
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-[var(--panel-foreground)]/65 leading-relaxed">
                                        Prompt for confirmation when closing tab or navigating away while uncommitted changes exist.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={warnOnUnsavedChanges}
                                    onClick={() => setWarnOnUnsavedChanges(!warnOnUnsavedChanges)}
                                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[var(--sidebar-accent)]/50 ${
                                        warnOnUnsavedChanges ? 'bg-[var(--sidebar-accent)]' : 'bg-neutral-700'
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

                            {/* Keyboard Shortcuts Guide Box */}
                            <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-800/30 text-purple-200 text-xs space-y-1.5">
                                <div className="font-semibold text-purple-300 flex items-center gap-1.5">
                                    <span>Quick Detective Keybinds:</span>
                                </div>
                                <ul className="text-[11px] space-y-1 text-purple-200/80 font-mono">
                                    <li>• <kbd className="px-1.5 py-0.5 bg-black/40 rounded border border-purple-800/40 text-purple-300">Cmd+S</kbd> / <kbd className="px-1.5 py-0.5 bg-black/40 rounded border border-purple-800/40 text-purple-300">Ctrl+S</kbd> — Instantly save board state</li>
                                    <li>• <kbd className="px-1.5 py-0.5 bg-black/40 rounded border border-purple-800/40 text-purple-300">Cmd+Z</kbd> — Undo clue reposition or text edit</li>
                                    <li>• <kbd className="px-1.5 py-0.5 bg-black/40 rounded border border-purple-800/40 text-purple-300">Cmd+Shift+Z</kbd> — Redo previous canvas action</li>
                                </ul>
                            </div>
                        </div>
                    )}

                    {/* TAB 3: Canvas & Grid */}
                    {activeTab === 'canvas' && (
                        <div className="space-y-5">
                            
                            {/* Grid Snapping */}
                            <div className="p-4 rounded-xl bg-[var(--background)]/60 border border-[var(--panel-border)] space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5 pr-4">
                                        <div className="flex items-center gap-1.5">
                                            <Grid className="w-3.5 h-3.5 text-[var(--sidebar-accent)]" />
                                            <span className="text-xs font-bold text-[var(--foreground)]">
                                                Snap Clues to Grid
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-[var(--panel-foreground)]/65 leading-relaxed">
                                            Magnetically align sticky notes, photographs, and evidence cards along regular coordinates.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={snapToGrid}
                                        onClick={() => setSnapToGrid(!snapToGrid)}
                                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[var(--sidebar-accent)]/50 ${
                                            snapToGrid ? 'bg-[var(--sidebar-accent)]' : 'bg-neutral-700'
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

                                {snapToGrid && (
                                    <div className="pt-2 border-t border-[var(--panel-border)]/60 space-y-1.5">
                                        <label className="text-[11px] font-semibold text-[var(--panel-foreground)]/80 block">
                                            Grid Step Interval
                                        </label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {[
                                                { label: '10px (Fine)', value: 10 },
                                                { label: '15px (Balanced)', value: 15 },
                                                { label: '20px (Spacious)', value: 20 },
                                            ].map((size) => (
                                                <button
                                                    key={size.value}
                                                    type="button"
                                                    onClick={() => setGridSize(size.value)}
                                                    className={`px-2 py-1.5 text-[11px] font-medium rounded-lg border transition-all ${
                                                        gridSize === size.value
                                                            ? 'bg-[var(--sidebar-accent)] text-[var(--sidebar-accent-foreground)] border-[var(--sidebar-accent)] font-semibold'
                                                            : 'bg-[var(--panel-background)] border-[var(--panel-border)] text-[var(--panel-foreground)]/70 hover:border-[var(--sidebar-accent)]/40'
                                                    }`}
                                                >
                                                    {size.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Canvas Background Pattern */}
                            <div className="p-4 rounded-xl bg-[var(--background)]/60 border border-[var(--panel-border)] space-y-2">
                                <label className="text-xs font-bold text-[var(--foreground)] block">
                                    Canvas Background Pattern
                                </label>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    {[
                                        { id: 'dots', label: 'Dots', desc: 'Classic cork' },
                                        { id: 'lines', label: 'Forensic Grid', desc: 'Graph lines' },
                                        { id: 'cross', label: 'Crosshairs', desc: 'Coordinates' },
                                        { id: 'none', label: 'Blank', desc: 'Clean slate' },
                                    ].map((pattern) => (
                                        <button
                                            key={pattern.id}
                                            type="button"
                                            onClick={() => setCanvasBackground(pattern.id as 'dots' | 'lines' | 'cross' | 'none')}
                                            className={`p-2.5 rounded-lg border text-center transition-all ${
                                                canvasBackground === pattern.id
                                                    ? 'bg-[var(--sidebar-accent)]/15 border-[var(--sidebar-accent)] text-[var(--sidebar-accent)] font-bold shadow-sm'
                                                    : 'bg-[var(--panel-background)] border-[var(--panel-border)] text-[var(--panel-foreground)]/70 hover:border-[var(--sidebar-accent)]/30'
                                            }`}
                                        >
                                            <div className="text-xs font-medium">{pattern.label}</div>
                                            <div className="text-[10px] text-[var(--panel-foreground)]/50">{pattern.desc}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Navigation & Minimap Controls */}
                            <div className="p-4 rounded-xl bg-[var(--background)]/60 border border-[var(--panel-border)] space-y-3">
                                <span className="text-xs font-bold text-[var(--foreground)] block">
                                    Navigation & Canvas Interaction
                                </span>

                                {/* Zoom on Scroll */}
                                <div className="flex items-center justify-between pt-1">
                                    <div className="space-y-0.5 pr-4">
                                        <div className="text-xs font-medium text-[var(--foreground)]">
                                            Zoom with Scroll Wheel
                                        </div>
                                        <div className="text-[11px] text-[var(--panel-foreground)]/65">
                                            Use mouse wheel or two-finger swipe to zoom canvas in and out.
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={zoomOnScroll}
                                        onClick={() => setZoomOnScroll(!zoomOnScroll)}
                                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                                            zoomOnScroll ? 'bg-[var(--sidebar-accent)]' : 'bg-neutral-700'
                                        }`}
                                    >
                                        <span
                                            aria-hidden="true"
                                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${
                                                zoomOnScroll ? 'translate-x-5' : 'translate-x-0'
                                            }`}
                                        />
                                    </button>
                                </div>

                                {/* Pan on Drag */}
                                <div className="flex items-center justify-between pt-2 border-t border-[var(--panel-border)]/60">
                                    <div className="space-y-0.5 pr-4">
                                        <div className="text-xs font-medium text-[var(--foreground)]">
                                            Pan on Canvas Drag
                                        </div>
                                        <div className="text-[11px] text-[var(--panel-foreground)]/65">
                                            Click and drag empty background to freely pan the board.
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={panOnDrag}
                                        onClick={() => setPanOnDrag(!panOnDrag)}
                                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                                            panOnDrag ? 'bg-[var(--sidebar-accent)]' : 'bg-neutral-700'
                                        }`}
                                    >
                                        <span
                                            aria-hidden="true"
                                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${
                                                panOnDrag ? 'translate-x-5' : 'translate-x-0'
                                            }`}
                                        />
                                    </button>
                                </div>

                                {/* Show MiniMap by default */}
                                <div className="flex items-center justify-between pt-2 border-t border-[var(--panel-border)]/60">
                                    <div className="space-y-0.5 pr-4">
                                        <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--foreground)]">
                                            <Navigation className="w-3.5 h-3.5" />
                                            <span>Open MiniMap by Default</span>
                                        </div>
                                        <div className="text-[11px] text-[var(--panel-foreground)]/65">
                                            Keep corner radar minimap open automatically when loading dossiers.
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={showMiniMapDefault}
                                        onClick={() => setShowMiniMapDefault(!showMiniMapDefault)}
                                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                                            showMiniMapDefault ? 'bg-[var(--sidebar-accent)]' : 'bg-neutral-700'
                                        }`}
                                    >
                                        <span
                                            aria-hidden="true"
                                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${
                                                showMiniMapDefault ? 'translate-x-5' : 'translate-x-0'
                                            }`}
                                        />
                                    </button>
                                </div>
                            </div>

                            {/* Reset to Defaults button */}
                            <div className="pt-2 flex justify-end">
                                <button
                                    type="button"
                                    onClick={handleResetDefaults}
                                    className="px-3 py-1.5 text-xs text-[var(--panel-foreground)]/70 hover:text-[var(--foreground)] hover:bg-[var(--sidebar-accent)]/15 border border-[var(--panel-border)] rounded-lg flex items-center gap-1.5 transition-colors"
                                    title="Reset canvas preferences to defaults"
                                >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    <span>Reset to Defaults</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Modal Footer */}
                <div className="flex items-center justify-end px-6 py-3 border-t border-[var(--panel-border)] bg-[var(--background)]/30">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-1.5 text-xs font-semibold text-[var(--panel-foreground)]/80 hover:text-[var(--foreground)] hover:bg-[var(--sidebar-accent)]/15 rounded-lg transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
