import html2canvas from 'html2canvas';

export interface ThumbnailOptions {
    width?: number;
    height?: number;
    quality?: number;
    scale?: number;
}

const DEFAULT_OPTIONS: ThumbnailOptions = {
    width: 400,
    height: 300,
    quality: 0.7,
    scale: 0.5,
};

/**
 * Generate optimized thumbnail from board element
 */
export async function generateOptimizedThumbnail(
    boardElement: HTMLElement,
    options: ThumbnailOptions = {}
): Promise<string | null> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    try {
        // Capture the board
        const canvas = await html2canvas(boardElement, {
            backgroundColor: '#1c1917',
            scale: opts.scale,
            logging: false,
            useCORS: true,
            allowTaint: false,
            width: boardElement.scrollWidth,
            height: boardElement.scrollHeight,
        });

        // Create a smaller canvas for the thumbnail
        const thumbnailCanvas = document.createElement('canvas');
        thumbnailCanvas.width = opts.width!;
        thumbnailCanvas.height = opts.height!;

        const ctx = thumbnailCanvas.getContext('2d');
        if (!ctx) return null;

        // Draw scaled image
        ctx.drawImage(canvas, 0, 0, opts.width!, opts.height!);

        // Convert to optimized data URL
        const dataUrl = thumbnailCanvas.toDataURL('image/jpeg', opts.quality);

        return dataUrl;
    } catch (error) {
        console.error('Thumbnail generation failed:', error);
        return null;
    }
}

/**
 * Get fallback thumbnail (default image)
 */
export function getFallbackThumbnail(): string {
    // Return a base64 encoded placeholder SVG
    const svg = `
        <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
            <rect width="400" height="300" fill="#1c1917"/>
            <g transform="translate(200, 150)">
                <path d="M-30,-20 L30,-20 L30,20 L-30,20 Z" fill="#78716c" opacity="0.3"/>
                <circle cx="0" cy="0" r="40" fill="none" stroke="#78716c" stroke-width="2" opacity="0.3"/>
                <text x="0" y="60" font-family="Arial" font-size="14" fill="#78716c" text-anchor="middle" opacity="0.5">
                    No Preview
                </text>
            </g>
        </svg>
    `;

    return `data:image/svg+xml;base64,${btoa(svg)}`;
}

/**
 * Save thumbnail to database
 */
export async function saveThumbnailToBoard(
    boardId: string,
    thumbnail: string
): Promise<boolean> {
    try {
        const response = await fetch(`/api/boards/${boardId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ thumbnail }),
        });

        return response.ok;
    } catch (error) {
        console.error('Failed to save thumbnail:', error);
        return false;
    }
}

/**
 * Auto-generate and save thumbnail on board save
 */
export async function autoGenerateThumbnail(
    boardId: string,
    boardElement: HTMLElement
): Promise<void> {
    try {
        const thumbnail = await generateOptimizedThumbnail(boardElement);

        if (thumbnail) {
            await saveThumbnailToBoard(boardId, thumbnail);
        }
    } catch (error) {
        console.error('Auto-generate thumbnail failed:', error);
        // Fail silently - don't block save operation
    }
}
