import React, { memo, useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { Handle, Position, NodeProps } from 'reactflow';
import { twMerge } from 'tailwind-merge';
import { Globe, ExternalLink } from 'lucide-react';
import useStore from '@/store/useStore';
import ProgressBar from '@/components/ui/ProgressBar';

const ArticleNode = ({ id, data, selected }: NodeProps) => {
    const updateNodeData = useStore((state) => state.updateNodeData);
    const [isLoading, setIsLoading] = useState(false);
    const [urlInput, setUrlInput] = useState(data.url || '');

    // Slight random rotation for "pinned" effect
    const rotation = React.useMemo(() => (Math.random() * 2 - 1).toFixed(2), []);

    // Fetch preview data
    const fetchPreview = useCallback(async (url: string) => {
        if (!url || !url.startsWith('http')) return;

        setIsLoading(true);
        try {
            const response = await fetch(`/api/preview?url=${encodeURIComponent(url)}`);
            const preview = await response.json();

            if (response.ok) {
                updateNodeData(id, {
                    title: data.title || preview.title,
                    image: preview.image,
                    description: preview.description
                });
            }
        } catch (err) {
            console.error('Failed to fetch preview:', err);
        } finally {
            setIsLoading(false);
        }
    }, [id, data.title, updateNodeData]);

    useEffect(() => {
        if (data.url && !data.image && !isLoading) {
            fetchPreview(data.url);
        }
    }, [data.url, data.image, fetchPreview, isLoading]);

    // Sync local input with store (important for rehydration)
    useEffect(() => {
        if (data.url && data.url !== urlInput) {
            setUrlInput(data.url);
        }
    }, [data.url, urlInput]);

    // Debounce URL input
    useEffect(() => {
        const timer = setTimeout(() => {
            if (urlInput !== data.url) {
                updateNodeData(id, { url: urlInput });
                // We don't fetch here; the reactive useEffect above will catch it 
                // once the store updates data.url
            }
        }, 1000);
        return () => clearTimeout(timer);
    }, [urlInput, data.url, id, updateNodeData]);

    const handleTitleChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
        if (data.isReadOnly) return;
        updateNodeData(id, { title: evt.target.value });
    };

    const isReadOnly = data.isReadOnly;

    return (
        <div
            style={{ transform: `rotate(${rotation}deg)` }}
            className={twMerge(
                'relative w-72 transition-all duration-300 ease-in-out',
                selected && 'scale-[1.02]',
                'group',
                isReadOnly ? 'pointer-events-none' : ''
            )}
        >
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
                        Special Report • {new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </p>
                    <input
                        className={twMerge(
                            "font-serif font-black text-stone-900 bg-transparent border-none focus:outline-none placeholder-stone-400 text-xl text-center leading-tight tracking-tight px-0 mb-4",
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
                            <ProgressBar isIndeterminate label="Extracting..." className="max-w-[120px]" />
                        ) : data.image ? (
                            <div className="relative w-full h-full newsprint-image opacity-80">
                                <Image
                                    src={data.image}
                                    alt={data.title}
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
                                className="w-full bg-transparent border-none focus:outline-none truncate font-mono tracking-tight"
                                placeholder={isReadOnly ? "" : "https://example.com"}
                                value={urlInput}
                                onChange={(e) => !isReadOnly && setUrlInput(e.target.value)}
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
                position={Position.Top}
                id="source"
                className="size-3 -top-1 left-1/2 -translate-x-1/2 bg-stone-800 border-none z-50 rounded-full opacity-0 group-hover:opacity-100"
            />
        </div>
    );
};

export default memo(ArticleNode);
