'use client';

import React, { useState, useEffect } from 'react';
import { X, Globe, Lock } from 'lucide-react';
import useStore from '@/store/useStore';
import { useShallow } from 'zustand/react/shallow';
import ProgressBar from '@/components/ui/ProgressBar';

interface BoardSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    boardId: string;
}

export default function BoardSettingsModal({ isOpen, onClose, boardId }: BoardSettingsModalProps) {
    const { boardTitle, isPublic, parentId, setBoardMetadata } = useStore(useShallow((state) => ({
        boardTitle: state.boardTitle,
        isPublic: state.isPublic,
        parentId: state.parentId,
        setBoardMetadata: state.setBoardMetadata,
    })));

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

    const handleSave = async (e: any) => {
        e.preventDefault();
        setSaving(true);

        try {
            const res = await fetch(`/api/boards/${boardId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title,
                    isPublic: publicAccess
                }),
            });

            if (res.ok) {
                setBoardMetadata(title, publicAccess, parentId);
                onClose();
            } else {
                console.error('Failed to update settings');
            }
        } catch (error) {
            console.error(error);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-md bg-stone-900 border border-stone-800 rounded-xl shadow-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold font-serif text-amber-500">Case Settings</h2>
                    <button onClick={onClose} className="text-stone-400 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSave} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-stone-300">Case Title</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full bg-stone-950 border border-stone-800 rounded-lg px-4 py-3 text-stone-100 placeholder-stone-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all"
                            placeholder="e.g. The Black Dahlia"
                            required
                        />
                    </div>

                    <div className="space-y-3">
                        <label className="text-sm font-medium text-stone-300">Visibility</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setPublicAccess(false)}
                                className={`flex flex-col items-center justify-center gap-2 p-4 rounded-lg border transition-all ${!publicAccess ? 'bg-amber-500/10 border-amber-500 text-amber-500' : 'bg-stone-950 border-stone-800 text-stone-500 hover:border-stone-700'}`}
                            >
                                <Lock className="w-6 h-6" />
                                <span className="font-medium text-sm">Private</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setPublicAccess(true)}
                                className={`flex flex-col items-center justify-center gap-2 p-4 rounded-lg border transition-all ${publicAccess ? 'bg-amber-500/10 border-amber-500 text-amber-500' : 'bg-stone-950 border-stone-800 text-stone-500 hover:border-stone-700'}`}
                            >
                                <Globe className="w-6 h-6" />
                                <span className="font-medium text-sm">Public</span>
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={saving}
                        className="w-full bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold py-3 rounded-lg transition-colors flex flex-col items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {saving ? <ProgressBar isIndeterminate label="Saving Evidence..." className="max-w-[150px]" /> : "Save Changes"}
                    </button>
                </form>
            </div>
        </div>
    );
}
