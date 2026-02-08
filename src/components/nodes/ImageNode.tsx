import React, { memo } from 'react';
import Image from 'next/image';
import { Handle, Position, NodeProps } from 'reactflow';
import { twMerge } from 'tailwind-merge';
import { Upload } from 'lucide-react';
import useStore from '@/store/useStore';

const ImageNode = ({ id, data, selected }: NodeProps) => {
    const updateNodeData = useStore((state) => state.updateNodeData);

    // Slight random rotation for "pinned" effect
    const rotation = React.useMemo(() => (Math.random() * 6 - 3).toFixed(2), []);

    const isReadOnly = data.isReadOnly;

    const handleUpload = (evt: React.ChangeEvent<HTMLInputElement>) => {
        if (isReadOnly) return;
        const file = evt.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                updateNodeData(id, { src: e.target?.result as string });
            };
            reader.readAsDataURL(file);
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
                'group',
                isReadOnly ? 'pointer-events-none' : ''
            )}
        >
            {/* Visual Thumb Tack / Pin */}
            <div className="thumb-tack" />

            {/* Exhibit Label */}
            <div className="absolute top-2 right-2 bg-red-800 text-white text-[8px] font-bold px-1 py-0.5 rounded-sm transform rotate-12 opacity-80 z-10">
                EXHIBIT A
            </div>

            {/* Image Area */}
            <div className="w-full aspect-square bg-stone-200 flex items-center justify-center overflow-hidden relative border border-black/5 evidence-photo">
                {data.src ? (
                    <div className="relative w-full h-full opacity-90">
                        <Image
                            src={data.src}
                            alt="Evidence"
                            fill
                            className="object-cover pointer-events-none"
                            unoptimized
                        />
                    </div>
                ) : (
                    <label className={twMerge(
                        "flex flex-col items-center gap-2 text-stone-400 transition-colors w-full h-full justify-center",
                        isReadOnly ? "cursor-default" : "cursor-pointer hover:text-stone-600"
                    )}>
                        <Upload size={24} />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Add Evidence</span>
                        <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={isReadOnly} />
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
                position={Position.Top}
                id="source"
                className="size-3 -top-1 left-1/2 -translate-x-1/2 bg-stone-800 border-none z-30 rounded-full opacity-0 group-hover:opacity-100"
            />
        </div>
    );
};

export default memo(ImageNode);
