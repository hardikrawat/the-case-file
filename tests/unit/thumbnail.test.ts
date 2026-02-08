import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateOptimizedThumbnail, getFallbackThumbnail, saveThumbnailToBoard, autoGenerateThumbnail } from '@/lib/thumbnail';

// Mock html2canvas
vi.mock('html2canvas', () => ({
    default: vi.fn().mockImplementation(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 100;
        canvas.height = 100;
        return Promise.resolve(canvas);
    }),
}));

// Mock fetch
global.fetch = vi.fn();

// Mock HTMLCanvasElement.getContext
HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
    drawImage: vi.fn(),
    // Add other context methods if needed
}) as any;

HTMLCanvasElement.prototype.toDataURL = vi.fn().mockReturnValue('data:image/png;base64,mocked');

describe('Thumbnail Utilities', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('generateOptimizedThumbnail', () => {
        it('should generate a thumbnail from an element', async () => {
            const element = document.createElement('div');
            const result = await generateOptimizedThumbnail(element);

            expect(result).toBeTruthy();
            expect(result).toContain('data:image/png'); // JSDOM default
        });

        it('should return null on error', async () => {
            // Force html2canvas error by mocking it to reject
            const html2canvas = await import('html2canvas');
            vi.mocked(html2canvas.default).mockRejectedValueOnce(new Error('Canvas error'));

            const element = document.createElement('div');
            const result = await generateOptimizedThumbnail(element);

            expect(result).toBeNull();
        });
    });

    describe('getFallbackThumbnail', () => {
        it('should return a valid data URL', () => {
            const fallback = getFallbackThumbnail();
            expect(fallback).toContain('data:image/svg+xml;base64,');
        });
    });

    describe('saveThumbnailToBoard', () => {
        it('should call API to save thumbnail', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true }),
            } as any);

            const result = await saveThumbnailToBoard('board-123', 'data:image/png;base64,test');

            expect(result).toBe(true);
            expect(global.fetch).toHaveBeenCalledWith('/api/boards/board-123', expect.objectContaining({
                method: 'PUT',
                body: expect.stringContaining('"thumbnail":"data:image/png;base64,test"'),
            }));
        });

        it('should handle API errors', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: false,
            } as any);

            const result = await saveThumbnailToBoard('board-123', 'data:image/png;base64,test');
            expect(result).toBe(false);
        });

        it('should handle network errors', async () => {
            vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'));

            const result = await saveThumbnailToBoard('board-123', 'data:image/png;base64,test');
            expect(result).toBe(false);
        });
    });

    describe('autoGenerateThumbnail', () => {
        it('should generate and save thumbnail', async () => {
            // Mock success for fetch
            vi.mocked(global.fetch).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true }),
            } as any);

            const element = document.createElement('div');
            await autoGenerateThumbnail('board-123', element);

            // Should call html2canvas (via generateOptimizedThumbnail)
            const html2canvas = await import('html2canvas');
            expect(html2canvas.default).toHaveBeenCalled();
            // Should call fetch (via saveThumbnailToBoard)
            expect(global.fetch).toHaveBeenCalledWith('/api/boards/board-123', expect.any(Object));
        });

        it('should handle generation failure silently', async () => {
            const html2canvas = await import('html2canvas');
            vi.mocked(html2canvas.default).mockRejectedValueOnce(new Error('Canvas Error'));

            const element = document.createElement('div');
            // Should not throw
            await autoGenerateThumbnail('board-123', element);
        });
    });
});
