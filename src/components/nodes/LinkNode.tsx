import React, { memo, useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { Handle, Position, NodeProps } from 'reactflow';
import { twMerge } from 'tailwind-merge';
import { Globe, ExternalLink, Trash2 } from 'lucide-react';
import useStore from '@/store/useStore';
import AppleSpinner from '@/components/ui/AppleSpinner';
import { useIsReadOnly } from '@/context/ReadOnlyContext';

const LinkNode = ({ id, data, selected }: NodeProps) => {
    const updateNodeData = useStore((state) => state.updateNodeData);
    const readOnlyContext = useIsReadOnly();
    const isReadOnly = Boolean(data?.isReadOnly ?? readOnlyContext);
    const [isLoading, setIsLoading] = useState(false);
    const [urlInput, setUrlInput] = useState(data.url || '');
    const titleRef = React.useRef(data.title);
    titleRef.current = data.title;

    // Slight random rotation for "pinned" effect
    const rotation = React.useMemo(() => {
        let hash = 0;
        for (let i = 0; i < id.length; i++) {
            hash = ((hash << 5) - hash) + id.charCodeAt(i);
            hash |= 0;
        }
        return ((hash % 400) / 100).toFixed(2);
    }, [id]);

    // Fetch preview metadata (title, image, description, favicon)
    const fetchPreview = useCallback(async (url: string) => {
        if (!url || !url.startsWith('http')) return;

        setIsLoading(true);
        try {
            const response = await fetch(`/api/preview?url=${encodeURIComponent(url)}`);
            if (response.ok) {
                const preview = await response.json();
                updateNodeData(id, {
                    title: titleRef.current || preview.title,
                    image: preview.image,
                    description: preview.description,
                    favicon: preview.favicon,
                });
            }
        } catch (err) {
            console.error('Failed to fetch link preview:', err);
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

    // Sync local input with store
    useEffect(() => {
        if (!isTypingRef.current && data.url && data.url !== urlInput) {
            setUrlInput(data.url);
        }
    }, [data.url, urlInput]);

    // Debounce URL changes
    useEffect(() => {
        const timer = setTimeout(() => {
            if (urlInput !== data.url) {
                updateNodeData(id, { url: urlInput });
            }
        }, 800);
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
                selected ? 'scale-[1.02]' : '',
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

            {/* Visual Paper Background (Detective Manila Card) */}
            <div
                className={twMerge(
                    'bg-[#fbf7ed] border border-amber-900/30 rounded-lg shadow-md p-4 pt-6 flex flex-col gap-2',
                    selected && 'ring-2 ring-blue-500 shadow-xl'
                )}
            >
                {/* Visual Thumb Tack / Pin */}
                <div className="thumb-tack" />

                {/* Evidence Badge Header */}
                <div className="flex items-center justify-between border-b border-amber-900/15 pb-2">
                    <div className="flex items-center gap-1.5">
                        <Globe size={13} className="text-amber-800 shrink-0" />
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-900/70">
                            Web Evidence Record
                        </span>
                    </div>
                    {data.url && (
                        <a
                            href={data.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-amber-800 hover:text-amber-950 p-0.5 rounded transition-colors"
                            title="Open Link"
                            aria-label="Open Link"
                        >
                            <ExternalLink size={12} />
                        </a>
                    )}
                </div>

                {/* Title Input / Display */}
                <input
                    className={twMerge(
                        'w-full bg-transparent font-bold text-stone-900 placeholder-stone-400 text-sm focus:outline-none focus:bg-amber-100/50 rounded px-1 -mx-1 nodrag',
                        isReadOnly ? 'cursor-default' : ''
                    )}
                    placeholder={isReadOnly ? '' : 'Evidence Title...'}
                    value={data.title || ''}
                    onChange={handleTitleChange}
                    onKeyDown={(e) => e.stopPropagation()}
                    readOnly={isReadOnly}
                />

                {/* Loading State */}
                {isLoading && (
                    <div className="flex items-center justify-center py-4 gap-2 text-stone-600 font-mono text-xs bg-stone-100/50 rounded p-2">
                        <AppleSpinner size="sm" className="text-stone-700" />
                        <span>Extracting link intel...</span>
                    </div>
                )}

                {/* Optional Preview Image */}
                {!isLoading && data.image && (
                    <div className="relative w-full h-28 bg-stone-200 rounded overflow-hidden border border-amber-900/10 my-1">
                        <Image
                            src={data.image}
                            alt={data.title || 'Link preview'}
                            fill
                            className="object-cover"
                            unoptimized
                        />
                    </div>
                )}

                {/* Optional Description */}
                {data.description && (
                    <p className="text-xs text-stone-600 line-clamp-2 italic leading-relaxed">
                        {data.description}
                    </p>
                )}

                {/* URL Input */}
                {!isReadOnly ? (
                    <div className="flex items-center gap-1 bg-stone-100/80 border border-stone-300 rounded px-2 py-1 text-xs text-stone-600">
                        <input
                            type="url"
                            className="w-full bg-transparent focus:outline-none text-xs text-stone-800 placeholder-stone-400 font-mono nodrag"
                            placeholder="https://evidence-source.org"
                            value={urlInput}
                            onChange={(e) => {
                                isTypingRef.current = true;
                                setUrlInput(e.target.value);
                            }}
                            onBlur={() => {
                                isTypingRef.current = false;
                            }}
                            onKeyDown={(e) => e.stopPropagation()}
                        />
                    </div>
                ) : (
                    data.url && (
                        <p className="text-[11px] font-mono text-stone-500 truncate">
                            {data.url}
                        </p>
                    )
                )}
            </div>

            {/* Connection Handles (Pinned center top) */}
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

export default memo(LinkNode);
