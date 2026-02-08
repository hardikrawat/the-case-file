import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { twMerge } from 'tailwind-merge';
import useStore from '@/store/useStore';

const TextNode = ({ id, data, selected }: NodeProps) => {
    const updateNodeData = useStore((state) => state.updateNodeData);

    const handleChange = (evt: React.ChangeEvent<HTMLTextAreaElement>) => {
        updateNodeData(id, { label: evt.target.value });
    };

    return (
        <div
            className={twMerge(
                'relative min-w-[150px] min-h-[50px] p-2 flex flex-col transition-all duration-200 ease-in-out',
                'border border-transparent hover:border-dashed hover:border-gray-400/50 rounded-sm', // Show border on hover for easier selection
                selected && 'border-dashed border-blue-500 bg-blue-500/10',
                'group'
            )}
        >
            <textarea
                className="w-full h-full bg-transparent border-none resize-none focus:outline-none text-xl font-bold text-center leading-tight overflow-hidden"
                style={{ color: 'var(--foreground)' }}
                placeholder="Label..."
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
            />

            {/* Handles */}
            <Handle
                type="target"
                position={Position.Top}
                id="target"
                className="opacity-0 w-full h-full top-0 left-0 rounded-none border-none"
            />
            <Handle
                type="source"
                position={Position.Top}
                id="source"
                className="opacity-0 w-full h-full top-0 left-0 rounded-none border-none"
            />
        </div>
    );
};

export default memo(TextNode);
