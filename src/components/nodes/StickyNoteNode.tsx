import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { twMerge } from 'tailwind-merge';
import { Trash2 } from 'lucide-react';
import useStore from '@/store/useStore';
import { useIsReadOnly } from '@/context/ReadOnlyContext';

const StickyNoteNode = ({ id, data, selected }: NodeProps) => {
    const updateNodeData = useStore((state) => state.updateNodeData);
    const readOnlyContext = useIsReadOnly();
    const isReadOnly = Boolean(data?.isReadOnly ?? readOnlyContext);

    // Slight random rotation for "pinned" effect
    const rotation = React.useMemo(() => {
        let hash = 0;
        for (let i = 0; i < id.length; i++) {
            hash = ((hash << 5) - hash) + id.charCodeAt(i);
            hash |= 0;
        }
        return ((hash % 400) / 100).toFixed(2);
    }, [id]);

    const handleChange = (evt: React.ChangeEvent<HTMLTextAreaElement>) => {
        if (isReadOnly) return;
        updateNodeData(id, { label: evt.target.value });
    };

    return (
        <div
            style={{
                transform: `rotate(${rotation}deg)`,
            }}
            className={twMerge(
                'relative w-64 h-64 transition-all duration-300 ease-in-out',
                selected ? 'scale-[1.03]' : '',
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

            {/* Visual Paper Background (Clipped) */}
            <div
                className={twMerge(
                    "absolute inset-0 w-full h-full sticky-note-paper hand-cut curled-corner",
                    selected ? 'paper-depth-shadow-selected' : 'paper-depth-shadow',
                )}
                style={{
                    backgroundColor: data.color || '#fef3c7',
                    backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(0,0,0,0.05) 100%)'
                }}
            />

            {/* Visual Thumb Tack / Pin - On Wrapper (Top) */}
            <div className="thumb-tack" />

            {/* Content Area - On Wrapper */}
            <div className="absolute inset-0 z-10 w-full h-full p-6 pt-10 flex flex-col hand-cut">
                <textarea
                    className={twMerge(
                        "w-full h-full bg-transparent border-none resize-none focus:outline-none text-xl leading-relaxed placeholder-stone-600/30 font-medium nodrag",
                        isReadOnly ? "cursor-default" : ""
                    )}
                    style={{
                        color: '#2d2d2d',
                        fontFamily: '"Architects Daughter", "Marker Felt", "Comic Sans MS", cursive',
                    }}
                    placeholder={isReadOnly ? "" : "Pin a clue..."}
                    value={data.label || ''}
                    onChange={handleChange}
                    onKeyDown={(evt) => evt.stopPropagation()}
                    readOnly={isReadOnly}
                />
            </div>

            {/* Connection Handles (Pinned center) - On Wrapper (Not Clipped) */}
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

export default memo(StickyNoteNode);
