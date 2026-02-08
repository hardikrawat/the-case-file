import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { twMerge } from 'tailwind-merge';
import useStore from '@/store/useStore';

const StickyNoteNode = ({ id, data, selected }: NodeProps) => {
    const updateNodeData = useStore((state) => state.updateNodeData);

    // Slight random rotation for "pinned" effect
    const rotation = React.useMemo(() => (Math.random() * 4 - 2).toFixed(2), []);

    const handleChange = (evt: React.ChangeEvent<HTMLTextAreaElement>) => {
        updateNodeData(id, { label: evt.target.value });
    };

    return (
        <div
            style={{
                transform: `rotate(${rotation}deg)`,
                backgroundColor: data.color || '#fef3c7',
                color: '#2d2d2d',
                fontFamily: '"Architects Daughter", "Marker Felt", "Comic Sans MS", cursive',
                backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(0,0,0,0.05) 100%)' // Subtle depth gradient
            }}
            className={twMerge(
                'relative w-64 h-64 p-6 pt-10 flex flex-col transition-all duration-300 ease-in-out',
                'sticky-note-paper hand-cut curled-corner',
                selected ? 'paper-depth-shadow-selected scale-[1.03]' : 'paper-depth-shadow',
                'group'
            )}
        >
            {/* Visual Thumb Tack / Pin */}
            <div className="thumb-tack" />

            {/* Content Area */}
            <textarea
                className="w-full h-full bg-transparent border-none resize-none focus:outline-none text-xl leading-relaxed placeholder-stone-600/30 font-medium"
                placeholder="Pin a clue..."
                defaultValue={data.label}
                onChange={handleChange}
                onKeyDown={(evt) => evt.stopPropagation()}
            />

            {/* Connection Handles (Pinned center) */}
            <Handle
                type="target"
                position={Position.Top}
                id="target"
                className="size-3 -top-1 left-1/2 -translate-x-1/2 bg-stone-800 border-none z-20 rounded-full opacity-0 group-hover:opacity-100"
            />
            <Handle
                type="source"
                position={Position.Top}
                id="source"
                className="size-3 -top-1 left-1/2 -translate-x-1/2 bg-stone-800 border-none z-20 rounded-full opacity-0 group-hover:opacity-100"
            />
        </div>
    );
};

export default memo(StickyNoteNode);
