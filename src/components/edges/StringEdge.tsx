import React, { memo, useState } from 'react';
import { BaseEdge, EdgeLabelRenderer, EdgeProps, useReactFlow } from 'reactflow';
import { Scissors } from 'lucide-react';
import useStore from '@/store/useStore';
import { useIsReadOnly } from '@/context/ReadOnlyContext';

const StringEdge = ({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    style = {},
    markerEnd,
    selected,
    data,
}: EdgeProps) => {
    const { getZoom } = useReactFlow();
    const zoom = getZoom();
    const [isHovered, setIsHovered] = useState(false);
    const readOnlyContext = useIsReadOnly();
    const isReadOnly = Boolean(data?.isReadOnly ?? readOnlyContext);

    // Custom Path: Physical "Sag" instead of just Bezier
    // We calculate a midpoint that is weighted downwards to simulate gravity
    const midX = (sourceX + targetX) / 2;
    const dist = Math.sqrt(Math.pow(targetX - sourceX, 2) + Math.pow(targetY - sourceY, 2));
    const sag = dist * 0.08;
    const midY = (sourceY + targetY) / 2 + sag;

    const edgePath = `M ${sourceX},${sourceY} Q ${midX},${midY} ${targetX},${targetY}`;
    const labelX = midX;
    const labelY = midY - 10;

    const onEdgeClick = (evt: React.MouseEvent) => {
        evt.stopPropagation();
        if (isReadOnly) return;
        // Synchronize deletion with both Zustand store and local ReactFlow state
        useStore.getState().deleteEdge(id);
    };

    const showCutButton = (selected || isHovered) && !isReadOnly;

    return (
        <>
            {/* Invisible wide interaction path for hover detection */}
            <path
                d={edgePath}
                fill="none"
                stroke="transparent"
                strokeWidth={24}
                className="react-flow__edge-interaction cursor-pointer"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            />

            <BaseEdge
                path={edgePath}
                markerEnd={markerEnd}
                style={{
                    ...style,
                    strokeWidth: 5,
                    stroke: selected || isHovered ? '#ef4444' : '#991b1b', // Darker base for texture
                    filter: "url('#yarn-texture') drop-shadow(1px 3px 3px rgba(0,0,0,0.5))",
                    transition: 'stroke 0.2s, filter 0.2s',
                    strokeLinecap: 'round',
                }}
            />
            {/* Twisted strand layer */}
            <BaseEdge
                path={edgePath}
                style={{
                    strokeWidth: 2.5,
                    stroke: '#dc2626',
                    strokeDasharray: '4, 2',
                    opacity: 0.8,
                    pointerEvents: 'none',
                    filter: "url('#yarn-texture')",
                }}
            />
            {/* Highlight core for depth */}
            <BaseEdge
                path={edgePath}
                style={{
                    strokeWidth: 1.2,
                    stroke: '#f87171',
                    opacity: 0.4,
                    pointerEvents: 'none',
                    strokeDasharray: '2, 6',
                }}
            />

            {showCutButton && (
                <EdgeLabelRenderer>
                    <div
                        style={{
                            position: 'absolute',
                            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px) scale(${Math.min(2.5, Math.max(0.7, 1 / (zoom || 1)))})`,
                            fontSize: 12,
                            pointerEvents: 'all',
                        }}
                        className="nodrag nopan"
                        onMouseEnter={() => setIsHovered(true)}
                        onMouseLeave={() => setIsHovered(false)}
                    >
                        <button
                            className="bg-red-600 hover:bg-red-700 text-white rounded-full p-1.5 shadow-lg hover:scale-110 transition-all flex items-center justify-center pointer-events-auto"
                            onClick={onEdgeClick}
                            title="Cut Connection String"
                            aria-label="Sever connection string between evidence clues"
                            data-testid={`cut-string-${id}`}
                        >
                            <Scissors size={12} className="rotate-90" />
                        </button>
                    </div>
                </EdgeLabelRenderer>
            )}
        </>
    );
};

export default memo(StringEdge);
