import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { saveAs } from 'file-saver';

export interface ExportOptions {
    format: 'json' | 'png' | 'pdf';
    filename?: string;
}

/**
 * Export board to standardized JSON dossier
 */
export async function exportToJSON(boardData: Record<string, unknown>, filename?: string): Promise<void> {
    const rawContent = (boardData.content as Record<string, unknown>) || {};
    const nodes = boardData.nodes || rawContent.nodes || [];
    const edges = boardData.edges || rawContent.edges || [];
    const caseTitle = (boardData.title as string) || (boardData.caseTitle as string) || 'Untitled Case';

    const dossier = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        caseTitle,
        nodes,
        edges,
    };

    const jsonString = JSON.stringify(dossier, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    saveAs(blob, filename || `${caseTitle.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}.json`);
}

/**
 * Export board to PNG screenshot
 */
export async function exportToPNG(element?: HTMLElement, filename?: string): Promise<void> {
    const target = element || (document.querySelector('.react-flow') as HTMLElement) || document.body;
    const canvas = await html2canvas(target, {
        backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--background').trim() || '#1c1917',
        scale: 2,
        logging: false,
        useCORS: true,
    });

    canvas.toBlob((blob) => {
        if (blob) {
            saveAs(blob, filename || `case-file-${Date.now()}.png`);
        } else {
            console.error('Failed to create PNG blob');
        }
    });
}

/**
 * Export board to PDF dossier
 */
export async function exportToPDF(element?: HTMLElement, filename?: string): Promise<void> {
    const target = element || (document.querySelector('.react-flow') as HTMLElement) || document.body;
    const canvas = await html2canvas(target, {
        backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--background').trim() || '#1c1917',
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
    pdf.save(filename || `case-dossier-${Date.now()}.pdf`);
}

/**
 * Main export dispatcher
 */
export async function exportBoard(
    format: 'json' | 'png' | 'pdf',
    boardData: Record<string, unknown>,
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
