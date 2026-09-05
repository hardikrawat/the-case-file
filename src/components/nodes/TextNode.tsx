import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { twMerge } from 'tailwind-merge';
import { Trash2 } from 'lucide-react';
import useStore from '@/store/useStore';
import { useIsReadOnly } from '@/context/ReadOnlyContext';

const TextNode = ({ id, data, selected }: NodeProps) => {
    const updateNodeData = useStore((state) => state.updateNodeData);
    const readOnlyContext = useIsReadOnly();
    const isReadOnly = Boolean(data?.isReadOnly ?? readOnlyContext);

    const handleChange = (evt: React.ChangeEvent<HTMLTextAreaElement>) => {
        if (isReadOnly) return;
        updateNodeData(id, { label: evt.target.value });
    };

    return (
        <div
            className={twMerge(
                'relative min-w-[150px] min-h-[50px] p-2 flex flex-col transition-all duration-200 ease-in-out',
                'border border-transparent hover:border-dashed hover:border-gray-400/50 rounded-sm',
                selected && 'border-dashed border-blue-500 bg-blue-500/10',
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

            <div className="pt-2">
                <textarea
                    className={twMerge(
                        "w-full h-full bg-transparent border-none resize-none focus:outline-none text-xl font-bold text-center leading-tight overflow-hidden nodrag",
                        isReadOnly ? "cursor-default" : ""
                    )}
                    style={{ color: 'var(--foreground)' }}
                    placeholder={isReadOnly ? "" : "Label..."}
                    value={data.label || ''}
                    onChange={handleChange}
                    onKeyDown={(evt) => evt.stopPropagation()}
                    rows={1}
                    onInput={(e) => {
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
                position={Position.Bottom}
                id="source"
                className="size-3 -bottom-1 left-1/2 -translate-x-1/2 bg-stone-800 border-none z-50 rounded-full opacity-0 group-hover:opacity-100"
            />
        </div>
    );
};

export default memo(TextNode);
