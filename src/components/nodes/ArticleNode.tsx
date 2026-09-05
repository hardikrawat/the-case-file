import React, { memo, useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { Handle, Position, NodeProps } from 'reactflow';
import { twMerge } from 'tailwind-merge';
import { Globe, ExternalLink, Trash2 } from 'lucide-react';
import useStore from '@/store/useStore';
import AppleSpinner from '@/components/ui/AppleSpinner';
import { useIsReadOnly } from '@/context/ReadOnlyContext';

const ArticleNode = ({ id, data, selected }: NodeProps) => {
    const updateNodeData = useStore((state) => state.updateNodeData);
    const readOnlyContext = useIsReadOnly();
    const isReadOnly = Boolean(data?.isReadOnly ?? readOnlyContext);
    const [isLoading, setIsLoading] = useState(false);
    const [urlInput, setUrlInput] = useState(data.url || '');
    const titleRef = React.useRef(data.title);
    titleRef.current = data.title;

    const dateStr = React.useMemo(() => {
        if (data?.date) {
            try {
                return new Date(data.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
            } catch {
                // fallback
            }
        }
        return 'Special Edition';
    }, [data?.date]);

    // Slight random rotation for "pinned" effect
    const rotation = React.useMemo(() => {
        let hash = 0;
        for (let i = 0; i < id.length; i++) {
            hash = ((hash << 5) - hash) + id.charCodeAt(i);
            hash |= 0;
        }
        return ((hash % 400) / 100).toFixed(2);
    }, [id]);

    // Fetch preview data
    const fetchPreview = useCallback(async (url: string) => {
        if (!url || !url.startsWith('http')) return;

        setIsLoading(true);
        try {
            const response = await fetch(`/api/preview?url=${encodeURIComponent(url)}`);
            const preview = await response.json();

            if (response.ok) {
                updateNodeData(id, {
                    title: titleRef.current || preview.title,
                    image: preview.image,
                    description: preview.description
                });
            }
        } catch (err) {
            console.error('Failed to fetch preview:', err);
        } finally {
            setIsLoading(false);
        }
    }, [id, updateNodeData]);

    useEffect(() => {
        if (data.url && !data.image) {
            fetchPreview(data.url);
        }
    }, [data.url, data.image, fetchPreview]);

    const isTypingRef = React.useRef(false);

    // Sync local input with store (important for rehydration)
    useEffect(() => {
        if (!isTypingRef.current && data.url && data.url !== urlInput) {
            setUrlInput(data.url);
        }
    }, [data.url, urlInput]);

    // Debounce URL input
    useEffect(() => {
        const timer = setTimeout(() => {
            if (urlInput !== data.url) {
                updateNodeData(id, { url: urlInput });
            }
        }, 1000);
        return () => clearTimeout(timer);
    }, [urlInput, data.url, id, updateNodeData]);

    const handleTitleChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
        if (isReadOnly) return;
        updateNodeData(id, { title: evt.target.value });
    };

    return (
        <div
            style={{ transform: `rotate(${rotation}deg)` }}
            className={twMerge(
                'relative w-72 transition-all duration-300 ease-in-out',
                selected && 'scale-[1.02]',
                'group'
            )}
        >
            {/* Delete button */}
            {!isReadOnly && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        useStore.getState().deleteNode(id);
                    }}
                    aria-label="Delete Node"
                    data-testid="delete-node"
                    title="Delete Node"
                    className={twMerge(
                        'absolute -top-2 -right-2 z-50 p-1 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-md transition-all duration-200 pointer-events-auto',
                        selected ? 'opacity-100 scale-100' : 'opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100'
                    )}
                >
                    <Trash2 size={12} />
                </button>
            )}

            {/* Background / Shape Layer (Clipped) */}
            <div
                className={twMerge(
                    "absolute inset-0 w-full h-full newspaper-clipping torn-edge",
                    selected && 'ring-2 ring-amber-700/50 shadow-2xl'
                )}
            />

            {/* Content Layer */}
            <div className="relative z-10 flex flex-col p-1 w-full h-full torn-edge">
                {/* Visual Thumb Tack / Pin */}
                <div className="thumb-tack" />

                {/* Header / Masthead Style */}
                <div className="px-3 pt-4 pb-2 border-b border-black/10 text-center">
                    <p className="text-[10px] font-serif uppercase tracking-[0.2em] text-stone-500 mb-1">
                        Special Report • {dateStr}
                    </p>
                    <input
                        className={twMerge(
                            "font-serif font-black text-stone-900 bg-transparent border-none focus:outline-none placeholder-stone-400 text-xl text-center leading-tight tracking-tight px-0 mb-4 nodrag",
                            isReadOnly ? "cursor-default" : ""
                        )}
                        style={{ fontVariantCaps: 'small-caps' }}
                        placeholder={isReadOnly ? "" : "THE DAILY HEADLINE"}
                        value={data.title || ''}
                        onChange={handleTitleChange}
                        onKeyDown={(evt) => evt.stopPropagation()}
                        readOnly={isReadOnly}
                    />
                </div>

                {/* Preview Image / Newsprint Photo */}
                <div className="px-4 py-2">
                    <div className="aspect-[4/3] bg-stone-300/30 flex items-center justify-center relative overflow-hidden border border-black/5 shadow-inner">
                        {isLoading ? (
                            <div className="flex flex-col items-center gap-1.5 p-2">
                                <AppleSpinner size="sm" className="text-stone-700" />
                                <span className="text-[10px] font-mono text-stone-600">Extracting...</span>
                            </div>
                        ) : data.image ? (
                            <div className="relative w-full h-full newsprint-image opacity-80">
                                <Image
                                    src={data.image}
                                    alt={data.title || 'Article preview'}
                                    fill
                                    className="object-cover"
                                    unoptimized
                                />
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center gap-2 text-stone-400 opacity-50">
                                <Globe size={32} />
                            </div>
                        )}
                    </div>
                </div>

                <div className="px-4 pb-6 pt-1 flex flex-col gap-3">
                    {data.description && (
                        <p className="text-xs text-stone-700 font-serif leading-relaxed italic border-l-2 border-stone-300 pl-3 py-1">
                            {data.description}
                        </p>
                    )}

                    {/* Meta & URL */}
                    <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-black/5">
                        <div className="flex items-center gap-2 text-[10px] text-stone-400">
                            <Globe size={10} />
                            <input
                                className="w-full bg-transparent border-none focus:outline-none truncate font-mono tracking-tight nodrag"
                                placeholder={isReadOnly ? "" : "https://example.com"}
                                value={urlInput}
                                onChange={(e) => {
                                    if (!isReadOnly) {
                                        isTypingRef.current = true;
                                        setUrlInput(e.target.value);
                                    }
                                }}
                                onBlur={() => {
                                    isTypingRef.current = false;
                                }}
                                onKeyDown={(evt) => evt.stopPropagation()}
                                readOnly={isReadOnly}
                            />
                        </div>

                        {data.url && (
                            <a
                                href={data.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[10px] text-stone-500 hover:text-stone-800 transition-colors py-1 w-fit pointer-events-auto"
                                onKeyDown={(evt) => evt.stopPropagation()}
                            >
                                Read Full Story <ExternalLink size={8} />
                            </a>
                        )}
                    </div>
                </div>
            </div>

            {/* Handles - pinned to the top center */}
            <Handle
                type="target"
                position={Position.Top}
                id="target"
                className="size-3 -top-1 left-1/2 -translate-x-1/2 bg-stone-800 border-none z-50 rounded-full opacity-0 group-hover:opacity-100"
            />
            <Handle
                type="source"
                position={Position.Bottom}
                id="source"
                className="size-3 -bottom-1 left-1/2 -translate-x-1/2 bg-stone-800 border-none z-50 rounded-full opacity-0 group-hover:opacity-100"
            />
        </div>
    );
};

export default memo(ArticleNode);
