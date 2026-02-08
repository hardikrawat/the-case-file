import React, { memo } from 'react';
import { BaseEdge, EdgeLabelRenderer, EdgeProps, getBezierPath, useReactFlow } from 'reactflow';
import { X } from 'lucide-react';

const StringEdge = ({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style = {},
    markerEnd,
    selected,
}: EdgeProps) => {
    const { setEdges } = useReactFlow();

    // Custom Path: Physical "Sag" instead of just Bezier
    // We calculate a midpoint that is weighted downwards to simulate gravity
    const midX = (sourceX + targetX) / 2;
    const midY = (sourceY + targetY) / 2 + Math.abs(targetX - sourceX) * 0.12; // Natural dip based on distance

    const edgePath = `M ${sourceX},${sourceY} Q ${midX},${midY} ${targetX},${targetY}`;
    const labelX = midX;
    const labelY = midY - 10;

    const onEdgeClick = (evt: React.MouseEvent) => {
        evt.stopPropagation();
        setEdges((edges) => edges.filter((e) => e.id !== id));
    };

    return (
        <>
            <BaseEdge
                path={edgePath}
                markerEnd={markerEnd}
                style={{
                    ...style,
                    strokeWidth: 5,
                    stroke: selected ? '#ef4444' : '#991b1b', // Darker base for texture
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
            {selected && (
                <EdgeLabelRenderer>
                    <div
                        style={{
                            position: 'absolute',
                            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                            fontSize: 12,
                            pointerEvents: 'all',
                        }}
                        className="nodrag nopan"
                    >
                        <button
                            className="bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center hover:bg-red-600 shadow-sm transition-colors"
                            onClick={onEdgeClick}
                            title="Cut String"
                        >
                            <X size={12} />
                        </button>
                    </div>
                </EdgeLabelRenderer>
            )}
        </>
    );
};

export default memo(StringEdge);
