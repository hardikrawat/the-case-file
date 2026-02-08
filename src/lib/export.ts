import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { saveAs } from 'file-saver';

export interface ExportOptions {
    format: 'json' | 'png' | 'pdf';
    filename?: string;
}

/**
 * Export board to JSON
 */
export async function exportToJSON(boardData: unknown, filename?: string): Promise<void> {
    const jsonString = JSON.stringify(boardData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    saveAs(blob, filename || `board-${Date.now()}.json`);
}

/**
 * Export board to PNG
 */
export async function exportToPNG(element: HTMLElement, filename?: string): Promise<void> {
    const canvas = await html2canvas(element, {
        backgroundColor: '#1c1917',
        scale: 2,
        logging: false,
        useCORS: true,
    });

    canvas.toBlob((blob) => {
        if (blob) {
            saveAs(blob, filename || `board-${Date.now()}.png`);
        }
    });
}

/**
 * Export board to PDF
 */
export async function exportToPDF(element: HTMLElement, filename?: string): Promise<void> {
    const canvas = await html2canvas(element, {
        backgroundColor: '#1c1917',
        scale: 2,
        logging: false,
        useCORS: true,
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [canvas.width, canvas.height],
    });

    pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
    pdf.save(filename || `board-${Date.now()}.pdf`);
}

/**
 * Main export function
 */
export async function exportBoard(
    format: 'json' | 'png' | 'pdf',
    boardData: unknown,
    element?: HTMLElement,
    filename?: string
): Promise<void> {
    switch (format) {
        case 'json':
            await exportToJSON(boardData, filename);
            break;
        case 'png':
            if (!element) throw new Error('Element required for PNG export');
            await exportToPNG(element, filename);
            break;
        case 'pdf':
            if (!element) throw new Error('Element required for PDF export');
            await exportToPDF(element, filename);
            break;
    }
}
