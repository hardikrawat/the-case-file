import React, { useMemo } from 'react';
import { twMerge } from 'tailwind-merge';

export interface PreviewNode {
    id: string;
    type?: string;
    position: { x: number; y: number };
    width?: number;
    height?: number;
    data?: {
        color?: string;
        [key: string]: unknown;
    };
}

export interface PreviewEdge {
    id: string;
    source: string;
    target: string;
}

interface BoardPreviewProps {
    nodes: PreviewNode[];
    edges: PreviewEdge[];
    className?: string;
}

const BoardPreview: React.FC<BoardPreviewProps> = ({ nodes, edges, className }) => {
    // Calculate bounding box
    const { viewBox, validNodes, validEdges } = useMemo(() => {
        if (!nodes || nodes.length === 0) {
            return { viewBox: "0 0 800 600", validNodes: [], validEdges: [] };
        }

        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        // Filter valid nodes that have position data
        const validNodes = nodes.filter(n => n.position && typeof n.position.x === 'number' && typeof n.position.y === 'number');

        if (validNodes.length === 0) {
            return { viewBox: "0 0 800 600", validNodes: [], validEdges: [] };
        }

        validNodes.forEach(node => {
            const x = node.position.x;
            const y = node.position.y;
            // Approximate width/height if not present (defaults based on common node sizes)
            const w = node.width || 250;
            const h = node.height || 250;

            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x + w > maxX) maxX = x + w;
            if (y + h > maxY) maxY = y + h;
        });

        // Add padding around the content
        const padding = 100;
        const width = maxX - minX + (padding * 2);
        const height = maxY - minY + (padding * 2);

        // Final ViewBox string
        const viewBox = `${minX - padding} ${minY - padding} ${width} ${height}`;

        return {
            viewBox,
            validNodes,
            validEdges: edges || []
        };
    }, [nodes, edges]);

    if (!nodes || nodes.length === 0) {
        return (
            <div className={twMerge("w-full h-full flex flex-col items-center justify-center bg-[var(--panel-background)]/20 text-[var(--panel-foreground)]/50", className)}>
                <div className="w-12 h-16 border-2 border-dashed border-current rounded mb-2 opacity-50" />
                <span className="text-[10px] font-mono uppercase tracking-widest opacity-70">Empty Case File</span>
            </div>
        );
    }

    return (
        <svg
            viewBox={viewBox}
            className={twMerge("w-full h-full bg-[var(--background)]/50", className)}
            preserveAspectRatio="xMidYMid meet"
        >
            {/* Edges */}
            {validEdges.map((edge) => {
                const source = validNodes.find(n => n.id === edge.source);
                const target = validNodes.find(n => n.id === edge.target);
                if (!source || !target) return null;

                const startX = source.position.x + (source.width || 250) / 2;
                const startY = source.position.y + (source.height || 250) / 2;
                const endX = target.position.x + (target.width || 250) / 2;
                const endY = target.position.y + (target.height || 250) / 2;

                return (
                    <line
                        key={edge.id}
                        x1={startX}
                        y1={startY}
                        x2={endX}
                        y2={endY}
                        stroke="var(--sidebar-accent)"
                        strokeWidth="4"
                        strokeOpacity="0.4"
                        strokeLinecap="round"
                    />
                );
            })}

            {/* Nodes */}
            {validNodes.map((node) => {
                const x = node.position.x;
                const y = node.position.y;
                const w = node.width || 250;
                const h = node.height || 250;

                // Base styles
                let fill = "var(--panel-background)";
                let stroke = "var(--panel-border)";
                let content = null;

                switch (node.type) {
                    case 'sticky':
                        // Sticky notes are usually colored
                        fill = (node.data?.color as string) || '#fef3c7';
                        stroke = "transparent";
                        break;

                    case 'image':
                        fill = "var(--sidebar-background)";
                        stroke = "var(--panel-border)";
                        // Simple 'image' icon placeholder
                        content = (
                            <rect x={x + w * 0.25} y={y + h * 0.25} width={w * 0.5} height={h * 0.5} rx="4" fill="currentColor" fillOpacity="0.2" />
                        );
                        break;

                    case 'text':
                        fill = "transparent";
                        stroke = "transparent";
                        // Lines of text representation
                        content = (
                            <g fill="currentColor" fillOpacity="0.4">
                                <rect x={x} y={y} width={w} height="12" rx="2" />
                                <rect x={x} y={y + 24} width={w * 0.8} height="12" rx="2" />
                                <rect x={x} y={y + 48} width={w * 0.6} height="12" rx="2" />
                            </g>
                        );
                        break;

                    case 'article':
                        fill = "var(--background)";
                        stroke = "var(--panel-border)";
                        // Article layout representation
                        content = (
                            <g fill="currentColor" fillOpacity="0.3">
                                <rect x={x + 20} y={y + 20} width={w - 40} height="20" rx="2" />
                                <rect x={x + 20} y={y + 60} width={w - 40} height="10" rx="1" />
                                <rect x={x + 20} y={y + 80} width={w - 40} height="10" rx="1" />
                                <rect x={x + 20} y={y + 100} width={w - 60} height="10" rx="1" />
                            </g>
                        );
                        break;

                    default:
                        // Generic node fallback
                        break;
                }

                return (
                    <g key={node.id} className="text-foreground">
                        {/* Shadow for depth */}
                        <rect
                            x={x + 4}
                            y={y + 4}
                            width={w}
                            height={h}
                            rx="8"
                            fill="rgba(0,0,0,0.1)"
                        />
                        {/* Main Shape */}
                        <rect
                            x={x}
                            y={y}
                            width={w}
                            height={h}
                            rx="8"
                            fill={fill}
                            stroke={stroke}
                            strokeWidth="2"
                        />
                        {content}
                    </g>
                );
            })}
        </svg>
    );
};

export default BoardPreview;
