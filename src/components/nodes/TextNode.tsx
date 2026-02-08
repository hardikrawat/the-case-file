import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { twMerge } from 'tailwind-merge';
import useStore from '@/store/useStore';

const TextNode = ({ id, data, selected }: NodeProps) => {
    const updateNodeData = useStore((state) => state.updateNodeData);

    const isReadOnly = data.isReadOnly;

    const handleChange = (evt: React.ChangeEvent<HTMLTextAreaElement>) => {
        if (isReadOnly) return;
        updateNodeData(id, { label: evt.target.value });
    };

    return (
        <div
            className={twMerge(
                'relative min-w-[150px] min-h-[50px] p-2 flex flex-col transition-all duration-200 ease-in-out',
                'border border-transparent hover:border-dashed hover:border-gray-400/50 rounded-sm', // Show border on hover for easier selection
                selected && 'border-dashed border-blue-500 bg-blue-500/10',
                'group',
                isReadOnly ? 'pointer-events-none' : ''
            )}
        >
            {/* Visual Thumb Tack / Pin */}
            <div className="thumb-tack" />

            <div className="pt-2"> {/* Spacer for tack */}
                <textarea
                    className={twMerge(
                        "w-full h-full bg-transparent border-none resize-none focus:outline-none text-xl font-bold text-center leading-tight overflow-hidden",
                        isReadOnly ? "cursor-default" : ""
                    )}
                    style={{ color: 'var(--foreground)' }}
                    placeholder={isReadOnly ? "" : "Label..."}
                    defaultValue={data.label}
                    onChange={handleChange}
                    onKeyDown={(evt) => evt.stopPropagation()}
                    rows={1}
                    onInput={(e) => {
                        // Auto-resize
                        const target = e.target as HTMLTextAreaElement;
                        target.style.height = 'auto';
                        target.style.height = target.scrollHeight + 'px';
                    }}
                    readOnly={isReadOnly}
                />
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

export default memo(TextNode);
