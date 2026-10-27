"use client";

import React, { useState } from "react";
import { X, Lock, Globe } from "lucide-react";
import { useRouter } from "next/navigation";
import AppleSpinner from "@/components/ui/AppleSpinner";

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
            <div className="w-full max-w-md bg-[var(--panel-background)] border border-[var(--panel-border)] rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 transition-colors duration-500">
                <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--panel-border)]/50 bg-[var(--background)]/50">
                    <h3 className="text-lg font-bold text-[var(--foreground)] font-serif uppercase tracking-tight">Open New Case File</h3>
                    <button onClick={onClose} className="text-[var(--panel-foreground)]/40 hover:text-[var(--sidebar-accent)] transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-[var(--panel-foreground)]/40 uppercase tracking-[0.2em] ml-1">Case Title</label>
                        <input
                            type="text"
                            required
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g. The Missing Clock..."
                            className="w-full bg-[var(--background)] border border-[var(--panel-border)] rounded-lg px-4 py-3 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--sidebar-accent)]/50 focus:border-transparent transition-all placeholder:text-[var(--panel-foreground)]/20"
                            autoFocus
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-[var(--panel-foreground)]/40 uppercase tracking-[0.2em] ml-1">Visibility</label>
                        <div className="grid grid-cols-2 gap-4">
                            {[
                                { id: 'private', label: 'Classified', icon: Lock, val: false },
                                { id: 'public', label: 'Public Intel', icon: Globe, val: true }
                            ].map((opt) => (
                                <button
                                    key={opt.id}
                                    type="button"
                                    onClick={() => setIsPublic(opt.val)}
                                    className={`flex flex-col items-center gap-3 p-4 rounded-lg border transition-all group ${isPublic === opt.val
                                        ? "bg-[var(--sidebar-accent)]/10 border-[var(--sidebar-accent)] text-[var(--sidebar-accent)] shadow-inner"
                                        : "bg-[var(--background)]/50 border-[var(--panel-border)] text-[var(--panel-foreground)]/40 hover:border-[var(--sidebar-accent)]/30"
                                        }`}
                                >
                                    <opt.icon className={`w-6 h-6 ${isPublic === opt.val ? "opacity-100" : "opacity-30 group-hover:opacity-60"}`} />
                                    <span className="text-xs font-bold uppercase tracking-widest">{opt.label}</span>
                                </button>
                            ))}
                        </div>
                        <p className="text-[10px] text-[var(--panel-foreground)]/40 text-center font-medium italic mt-2">
                            {isPublic
                                ? "Broadcast investigation to Bureau discovery files."
                                : "Encryption active. Only you can access this case."}
                        </p>
                    </div>

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-[var(--sidebar-accent)] hover:bg-[var(--sidebar-accent)]/90 disabled:opacity-50 disabled:cursor-not-allowed text-[var(--sidebar-accent-foreground)] font-bold py-3.5 rounded-lg transition-all shadow-lg shadow-[var(--sidebar-accent)]/20 flex items-center justify-center gap-2 uppercase tracking-[0.2em] text-xs"
                        >
                            {loading ? (
                                <>
                                    <AppleSpinner size="sm" />
                                    <span>Initializing Intelligence...</span>
                                </>
                            ) : "Initialize Case File"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
