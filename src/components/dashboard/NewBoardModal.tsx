"use client";

import React, { useState } from "react";
import { X, Lock, Globe } from "lucide-react";
import { useRouter } from "next/navigation";
import ProgressBar from "@/components/ui/ProgressBar";

interface NewBoardModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function NewBoardModal({ isOpen, onClose }: NewBoardModalProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [title, setTitle] = useState("");
    const [isPublic, setIsPublic] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch('/api/boards', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title,
                    isPublic,
                    content: { nodes: [], edges: [] }
                }),
            });

            if (res.ok) {
                const data = await res.json();
                router.push(`/board/${data.id}`);
                onClose();
            } else {
                console.error("Failed to create board");
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-md bg-stone-900 border border-stone-800 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between px-6 py-4 border-b border-stone-800 bg-stone-950">
                    <h3 className="text-lg font-bold text-stone-100 font-serif">Open New Case File</h3>
                    <button onClick={onClose} className="text-stone-500 hover:text-stone-300">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-stone-400">Case Title</label>
                        <input
                            type="text"
                            required
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g. The Missing Clock"
                            className="w-full bg-stone-950 border border-stone-800 rounded-lg px-4 py-2 text-stone-200 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 placeholder:text-stone-700"
                            autoFocus
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-stone-400">Visibility</label>
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                type="button"
                                onClick={() => setIsPublic(false)}
                                className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-all ${!isPublic
                                    ? "bg-stone-800 border-amber-500 text-amber-500"
                                    : "bg-stone-950 border-stone-800 text-stone-500 hover:bg-stone-900"
                                    }`}
                            >
                                <Lock className="w-6 h-6" />
                                <span className="text-sm font-medium">Private</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setIsPublic(true)}
                                className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-all ${isPublic
                                    ? "bg-stone-800 border-amber-500 text-amber-500"
                                    : "bg-stone-950 border-stone-800 text-stone-500 hover:bg-stone-900"
                                    }`}
                            >
                                <Globe className="w-6 h-6" />
                                <span className="text-sm font-medium">Public</span>
                            </button>
                        </div>
                        <p className="text-xs text-stone-500 text-center">
                            {isPublic
                                ? "Visible to everyone in Discovery. Users can contribute."
                                : "Only you can view and edit this case."}
                        </p>
                    </div>

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg transition-colors flex flex-col items-center justify-center gap-2"
                        >
                            {loading ? <ProgressBar isIndeterminate label="Initializing Case..." className="max-w-[150px]" /> : "Create Case File"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
