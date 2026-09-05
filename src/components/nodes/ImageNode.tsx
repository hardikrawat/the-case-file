import React, { memo, useState } from 'react';
import Image from 'next/image';
import { Handle, Position, NodeProps } from 'reactflow';
import { twMerge } from 'tailwind-merge';
import { Upload, Trash2 } from 'lucide-react';
import useStore from '@/store/useStore';
import { useIsReadOnly } from '@/context/ReadOnlyContext';
import AppleSpinner from '@/components/ui/AppleSpinner';
import { toast } from 'sonner';

const ImageNode = ({ id, data, selected }: NodeProps) => {
    const updateNodeData = useStore((state) => state.updateNodeData);
    const readOnlyContext = useIsReadOnly();
    const isReadOnly = Boolean(data?.isReadOnly ?? readOnlyContext);
    const [uploading, setUploading] = useState(false);

    // Slight random rotation for "pinned" effect
    const rotation = React.useMemo(() => {
        let hash = 0;
        for (let i = 0; i < id.length; i++) {
            hash = ((hash << 5) - hash) + id.charCodeAt(i);
            hash |= 0;
        }
        return ((hash % 400) / 100).toFixed(2);
    }, [id]);

    const handleUpload = async (evt: React.ChangeEvent<HTMLInputElement>) => {
        if (isReadOnly || uploading) return;
        const file = evt.target.files?.[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            toast.error("File is too large (max 5MB)");
            return;
        }
        if (!file.type.startsWith("image/")) {
            toast.error("Only image files are supported");
            return;
        }

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);

            const res = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            });

            if (res.ok) {
                const uploaded = await res.json();
                if (uploaded.url) {
                    updateNodeData(id, { src: uploaded.url });
                    return;
                }
            }

            // Fallback to data URL if endpoint unavailable/unauthorized
            const reader = new FileReader();
            reader.onload = (e) => {
                updateNodeData(id, { src: e.target?.result as string });
            };
            reader.readAsDataURL(file);
        } catch (error) {
            console.error('Image upload failed, falling back to local preview', error);
            const reader = new FileReader();
            reader.onload = (e) => {
                updateNodeData(id, { src: e.target?.result as string });
            };
            reader.readAsDataURL(file);
        } finally {
            setUploading(false);
        }
    };

    const handleCaptionChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
        if (isReadOnly) return;
        updateNodeData(id, { caption: evt.target.value });
    };

    return (
        <div
            style={{
                transform: `rotate(${rotation}deg)`,
                fontFamily: '"Architects Daughter", "Marker Felt", cursive'
            }}
            className={twMerge(
                'relative w-64 p-3 pb-8 flex flex-col transition-all duration-300 ease-in-out',
                'polaroid-frame',
                selected ? 'shadow-2xl scale-[1.02] ring-2 ring-red-900/20' : 'shadow-xl',
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

            {/* Visual Thumb Tack / Pin */}
            <div className="thumb-tack" />

            {/* Exhibit Label */}
            <div className="absolute top-2 right-2 bg-red-800 text-white text-[8px] font-bold px-1 py-0.5 rounded-sm transform rotate-12 opacity-80 z-10">
                {`EXHIBIT ${id.slice(-1).toUpperCase()}`}
            </div>

            {/* Image Area */}
            <div className="w-full aspect-square bg-stone-200 flex items-center justify-center overflow-hidden relative border border-black/5 evidence-photo">
                {data.src ? (
                    <div className="relative w-full h-full opacity-90">
                        <Image
                            src={data.src}
                            alt={data.caption || 'Evidence photo'}
                            fill
                            className="object-cover pointer-events-none"
                            unoptimized
                        />
                    </div>
                ) : (
                    <label className={twMerge(
                        "flex flex-col items-center gap-2 text-stone-400 transition-colors w-full h-full justify-center",
                        isReadOnly || uploading ? "cursor-default" : "cursor-pointer hover:text-stone-600"
                    )}>
                        {uploading ? (
                            <>
                                <AppleSpinner size="sm" className="text-stone-600" />
                                <span className="text-[10px] font-bold uppercase tracking-wider">Developing...</span>
                            </>
                        ) : (
                            <>
                                <Upload size={24} />
                                <span className="text-[10px] font-bold uppercase tracking-wider">Add Evidence</span>
                                <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={isReadOnly || uploading} />
                            </>
                        )}
                    </label>
                )}
            </div>

            {/* Caption Area */}
            <input
                className={twMerge(
                    "w-full mt-4 text-center text-lg bg-transparent border-none focus:outline-none placeholder-stone-400 font-medium text-stone-800",
                    isReadOnly ? "cursor-default" : ""
                )}
                placeholder={isReadOnly ? "" : "Label this clue..."}
                value={data.caption || ''}
                onChange={handleCaptionChange}
                onKeyDown={(evt) => evt.stopPropagation()}
                readOnly={isReadOnly}
            />

            {/* Handles - pinned to the top center */}
            <Handle
                type="target"
                position={Position.Top}
                id="target"
                className="size-3 -top-1 left-1/2 -translate-x-1/2 bg-stone-800 border-none z-30 rounded-full opacity-0 group-hover:opacity-100"
            />
            <Handle
                type="source"
                position={Position.Bottom}
                id="source"
                className="size-3 -bottom-1 left-1/2 -translate-x-1/2 bg-stone-800 border-none z-30 rounded-full opacity-0 group-hover:opacity-100"
            />
        </div>
    );
};

export default memo(ImageNode);
