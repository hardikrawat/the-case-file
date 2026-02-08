import { describe, it, expect } from 'vitest';
import {
    calculateEdgePath,
    getEdgeLabelPosition,
    getEdgeStyleAttributes,
    getArrowMarker,
    renderEdge,
    EDGE_STYLES,
} from '@/lib/edge-styles';

describe('Edge Styles', () => {
    describe('calculateEdgePath', () => {
        it('should generate valid SVG path', () => {
            const path = calculateEdgePath(0, 0, 100, 100);
            expect(path).toMatch(/^M \d+,\d+ C/);
        });

        it('should handle different curvatures', () => {
            const straight = calculateEdgePath(0, 0, 100, 100, 0);
            const curved = calculateEdgePath(0, 0, 100, 100, 0.5);
            expect(straight).not.toBe(curved);
        });
    });

    describe('getEdgeLabelPosition', () => {
        it('should return midpoint', () => {
            const pos = getEdgeLabelPosition(0, 0, 100, 100);
            expect(pos.x).toBe(50);
            expect(pos.y).toBe(40); // 50 - 10
        });
    });

    describe('getEdgeStyleAttributes', () => {
        it('should apply dashed style', () => {
            const attrs = getEdgeStyleAttributes({
                type: 'dashed',
                color: '#ffffff',
                width: 2,
            });
            expect(attrs.strokeDasharray).toBe('8 4');
        });

        it('should apply bold style with increased width', () => {
            const attrs = getEdgeStyleAttributes({
                type: 'bold',
                width: 2,
            });
            expect(attrs.strokeWidth).toBe(4);
        });

        it('should apply dotted style', () => {
            const attrs = getEdgeStyleAttributes({
                type: 'dotted',
                width: 2,
            });
            expect(attrs.strokeDasharray).toBe('2 4');
        });

        it('should handle default connection style', () => {
            const attrs = getEdgeStyleAttributes({
                type: 'default',
                color: '#78716c',
            });
            expect(attrs.markerEnd).toContain('arrow-');
        });

        it('should include arrow marker', () => {
            const attrs = getEdgeStyleAttributes({
                type: 'arrow',
                color: '#ff0000',
            });
            expect(attrs.markerEnd).toContain('arrow-');
        });
    });

    describe('getArrowMarker', () => {
        it('should generate SVG marker definition', () => {
            const marker = getArrowMarker('#ff0000');
            expect(marker).toContain('<marker');
            expect(marker).toContain('id="arrow-ff0000"');
            expect(marker).toContain('fill="#ff0000"');
        });

        it('should use default color if not provided', () => {
            const marker = getArrowMarker();
            expect(marker).toContain('fill="#78716c"');
        });
    });

    describe('renderEdge', () => {
        it('should render edge path and attributes', () => {
            const result = renderEdge(0, 0, 100, 100, {
                type: 'default',
                width: 2,
            });
            expect(result.path).toBeTruthy();
            expect(result.attributes).toBeTruthy();
            expect(result.attributes.strokeWidth).toBe(2);
            expect(result.label).toBeUndefined();
        });

        it('should include label if provided', () => {
            const result = renderEdge(0, 0, 100, 100, {
                type: 'default',
                label: 'Test Label',
            });
            expect(result.label).toBeDefined();
            expect(result.label?.text).toBe('Test Label');
            expect(result.label?.x).toBe(50);
        });
    });

    describe('EDGE_STYLES', () => {
        it('should have predefined styles', () => {
            expect(EDGE_STYLES.connection).toBeDefined();
            expect(EDGE_STYLES.leads_to).toBeDefined();
            expect(EDGE_STYLES.suspects).toBeDefined();
        });

        it('should have labels for some styles', () => {
            expect(EDGE_STYLES.leads_to.label).toBe('leads to');
            expect(EDGE_STYLES.suspects.label).toBe('suspect');
        });
    });
});
