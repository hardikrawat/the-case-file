export type EdgeType = 'default' | 'arrow' | 'dashed' | 'dotted' | 'bold';

export interface EdgeStyle {
    type: EdgeType;
    label?: string;
    color?: string;
    width?: number;
}

/**
 * Get SVG marker definition for edge arrows
 */
export function getArrowMarker(color: string = '#78716c'): string {
    const markerId = `arrow-${color.replace('#', '')}`;
    return `
        <defs>
            <marker
                id="${markerId}"
                markerWidth="10"
                markerHeight="10"
                refX="9"
                refY="3"
                orient="auto"
                markerUnits="strokeWidth"
            >
                <path d="M0,0 L0,6 L9,3 z" fill="${color}" />
            </marker>
        </defs>
    `;
}

/**
 * Get edge style attributes
 */
export function getEdgeStyleAttributes(style: EdgeStyle): {
    stroke: string;
    strokeWidth: number;
    strokeDasharray?: string;
    markerEnd?: string;
} {
    const color = style.color || '#78716c';
    const width = style.width || 2;

    const attrs: any = {
        stroke: color,
        strokeWidth: width,
    };

    // Add dash pattern based on type
    switch (style.type) {
        case 'dashed':
            attrs.strokeDasharray = '8 4';
            break;
        case 'dotted':
            attrs.strokeDasharray = '2 4';
            break;
        case 'bold':
            attrs.strokeWidth = width * 2;
            break;
    }

    // Add arrow marker
    if (style.type === 'arrow' || style.type === 'default') {
        attrs.markerEnd = `url(#arrow-${color.replace('#', '')})`;
    }

    return attrs;
}

/**
 * Calculate edge path with curved bezier
 */
export function calculateEdgePath(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    curvature: number = 0.2
): string {
    const dx = x2 - x1;
    const dy = y2 - y1;

    // Calculate control points for smooth curve
    const cx1 = x1 + dx * curvature;
    const cy1 = y1;
    const cx2 = x2 - dx * curvature;
    const cy2 = y2;

    return `M ${x1},${y1} C ${cx1},${cy1} ${cx2},${cy2} ${x2},${y2}`;
}

/**
 * Get label position for edge
 */
export function getEdgeLabelPosition(
    x1: number,
    y1: number,
    x2: number,
    y2: number
): { x: number; y: number } {
    return {
        x: (x1 + x2) / 2,
        y: (y1 + y2) / 2 - 10,
    };
}

/**
 * Render edge with label
 */
export function renderEdge(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    style: EdgeStyle
): {
    path: string;
    attributes: any;
    label?: { x: number; y: number; text: string };
} {
    const path = calculateEdgePath(x1, y1, x2, y2);
    const attributes = getEdgeStyleAttributes(style);

    let label;
    if (style.label) {
        const pos = getEdgeLabelPosition(x1, y1, x2, y2);
        label = { ...pos, text: style.label };
    }

    return { path, attributes, label };
}

/**
 * Predefined edge styles
 */
export const EDGE_STYLES: Record<string, EdgeStyle> = {
    connection: {
        type: 'default',
        color: '#78716c',
        width: 2,
    },
    leads_to: {
        type: 'arrow',
        color: '#f59e0b',
        width: 2,
        label: 'leads to',
    },
    related: {
        type: 'dashed',
        color: '#60a5fa',
        width: 2,
        label: 'related',
    },
    suspects: {
        type: 'arrow',
        color: '#ef4444',
        width: 3,
        label: 'suspect',
    },
    evidence: {
        type: 'bold',
        color: '#10b981',
        width: 2,
        label: 'evidence',
    },
};
