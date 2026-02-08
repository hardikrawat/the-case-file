import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportToJSON, exportToPNG, exportToPDF, exportBoard } from '@/lib/export';
import { saveAs } from 'file-saver';
import { jsPDF } from 'jspdf';

// Mock html2canvas
vi.mock('html2canvas', () => ({
    default: vi.fn().mockImplementation(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 100;
        canvas.height = 100;
        return Promise.resolve(canvas);
    }),
}));

// Mock file-saver
vi.mock('file-saver', () => ({
    saveAs: vi.fn(),
}));

// Mock jspdf
vi.mock('jspdf', () => ({
    jsPDF: vi.fn().mockImplementation(() => ({
        addImage: vi.fn(),
        save: vi.fn(),
    })),
}));

// Mock canvas methods
HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
    drawImage: vi.fn(),
}) as any;
HTMLCanvasElement.prototype.toDataURL = vi.fn().mockReturnValue('data:image/png;base64,mocked');
HTMLCanvasElement.prototype.toBlob = vi.fn((cb) => cb(new Blob(['test'], { type: 'image/png' })));

describe('Export Utilities', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('exportToJSON', () => {
        it('should save JSON file', async () => {
            const data = { test: 'data' };
            await exportToJSON(data, 'test.json');
            expect(saveAs).toHaveBeenCalledWith(expect.any(Blob), 'test.json');
        });
    });

    describe('exportToPNG', () => {
        it('should save PNG file', async () => {
            const element = document.createElement('div');
            await exportToPNG(element, 'test.png');
            expect(saveAs).toHaveBeenCalledWith(expect.any(Blob), 'test.png');
        });
    });

    describe('exportToPDF', () => {
        it('should save PDF file', async () => {
            const element = document.createElement('div');
            await exportToPDF(element, 'test.pdf');
            const mockPDFInstance = (jsPDF as any).mock.results[0].value;
            expect(mockPDFInstance.save).toHaveBeenCalledWith('test.pdf');
        });
    });

    describe('exportBoard', () => {
        it('should call appropriate export function', async () => {
            // We can spy on the exported functions if we import * as exportLib
            // But since we are calling them from the same module, mocking is harder unless we extract them.
            // However, `exportBoard` calls `exportToJSON` etc directly. 
            // Since they are in the same module, typical mocking won't work for internal calls unless verified via side effects (saveAs/jsPDF).

            await exportBoard('json', { data: 1 }, undefined, 'file.json');
            expect(saveAs).toHaveBeenCalledWith(expect.any(Blob), 'file.json');
        });

        it('should throw if element missing for png', async () => {
            await expect(exportBoard('png', {})).rejects.toThrow();
        });
    });
});
