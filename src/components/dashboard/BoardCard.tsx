"use client";

import Link from "next/link";
import { Board, BoardContent } from "@/lib/types";
import { Clock, Copy, Globe, Lock, Cpu, User } from "lucide-react";
import BoardPreview, { PreviewEdge, PreviewNode } from "./BoardPreview";
import { useEffect, useState } from "react";
import Image from "next/image";

import AppleSpinner from "@/components/ui/AppleSpinner";

interface BoardCardProps {
    board: Board;
}

const BoardCard = ({ board }: BoardCardProps) => {
    const [content, setContent] = useState<BoardContent | null>(board.content || null);
    const [isLoadingPreview, setIsLoadingPreview] = useState(!board.content);

    useEffect(() => {
        let isMounted = true;

        const loadPreview = async () => {
            if (content) return;

            try {
                const res = await fetch(`/api/boards/${board.id}`);
                if (res.ok) {
                    const data = await res.json();
                    if (isMounted && data.content) {
                        setContent(data.content);
                    }
                }
            } catch (error) {
                console.error("Failed to load preview", error);
            } finally {
                if (isMounted) setIsLoadingPreview(false);
            }
        };

        loadPreview();

        return () => {
            isMounted = false;
        };
    }, [board.id, content]);

    // Safely get nodes from content
    const nodes = (content?.nodes as unknown as PreviewNode[]) || [];
    const edges = (content?.edges as unknown as PreviewEdge[]) || [];

    return (
        <Link
            href={`/board/${board.id}`}
            className="group relative flex flex-col bg-panel rounded-xl overflow-hidden border border-panel-border hover:border-sidebar-accent transition-all duration-300 hover:shadow-lg hover:shadow-sidebar-accent/5 backdrop-blur-sm"
        >
            {/* Preview Area */}
            <div className="relative aspect-video w-full bg-[var(--background)] overflow-hidden border-b border-panel-border group-hover:opacity-100 transition-opacity">
                {isLoadingPreview ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-[var(--background)]/60 backdrop-blur-sm">
                        <AppleSpinner size="md" className="text-sidebar-accent" />
                    </div>
                ) : (
                    <>
                        {/* Simplified SVG Preview */}
                        <BoardPreview nodes={nodes} edges={edges} className="opacity-80 group-hover:opacity-100 transition-opacity duration-500" />

                        {/* Gradient Overlay for text readability (optional, but good for depth) */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    </>
                )}

                {/* Status Badges */}
                <div className="absolute top-3 right-3 flex gap-2">
                    {board.parentId && (
                        <div className="px-2 py-1 rounded bg-[var(--sidebar-accent)]/10 text-[var(--sidebar-accent)] text-xs font-mono flex items-center gap-1 border border-[var(--sidebar-accent)]/20 backdrop-blur-md shadow-sm">
                            <Copy className="w-3 h-3" /> Fork
                        </div>
                    )}
                    <div className={`px-2 py-1 rounded text-xs font-mono flex items-center gap-1 backdrop-blur-md shadow-sm border ${board.isPublic
                        ? 'bg-[var(--sidebar-accent)]/10 text-[var(--sidebar-accent)] border-[var(--sidebar-accent)]/20'
                        : 'bg-[var(--foreground)]/5 text-[var(--foreground)]/70 border-[var(--foreground)]/10'
                        }`}>
                        {board.isPublic ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                        {board.isPublic ? 'Public' : 'Private'}
                    </div>
                </div>
            </div>

            {/* Card Content */}
            <div className="p-4 flex flex-col gap-2 flex-grow bg-panel transition-colors duration-300">
                <div className="flex justify-between items-start">
                    <h3 className="font-serif text-lg font-bold text-[var(--foreground)] group-hover:text-sidebar-accent transition-colors line-clamp-1">
                        {board.title}
                    </h3>
                </div>

                {/* Metadata Grid */}
                <div className="grid grid-cols-2 gap-y-1 gap-x-4 text-xs text-[var(--foreground)]/60 mt-1 font-mono">
                    <div className="flex items-center gap-1.5" title="Creation Date">
                        <Clock className="w-3 h-3 opacity-70" />
                        <span>{new Date(board.createdAt || Date.now()).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-1.5" title="Evidence count">
                        <Cpu className="w-3 h-3 opacity-70" />
                        <span>{isLoadingPreview ? '...' : nodes.length} Nodes</span>
                    </div>
                    <div className="col-span-2 text-[var(--foreground)]/40 mt-1 uppercase tracking-wider text-[10px]">
                        Updated {new Date(board.updatedAt || Date.now()).toLocaleDateString()}
                    </div>
                </div>

                {/* Author Info */}
                {board.author && (
                    <div className="mt-2 pt-2 border-t border-panel-border/50 flex items-center gap-2">
                        {board.author.image ? (
                            <Image
                                src={board.author.image}
                                alt={board.author.name || "User"}
                                width={20}
                                height={20}
                                className="rounded-full border border-panel-border"
                            />
                        ) : (
                            <div className="w-5 h-5 rounded-full bg-sidebar-accent/10 flex items-center justify-center border border-sidebar-accent/20">
                                <User className="w-3 h-3 text-sidebar-accent" />
                            </div>
                        )}
                        <span className="text-xs text-panel-foreground/70 font-medium">
                            {board.author.name || "Unknown Detective"}
                        </span>
                    </div>
                )}
            </div>
        </Link>
    );
};

export default BoardCard;
