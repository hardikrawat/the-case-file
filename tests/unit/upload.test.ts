import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/upload/route';
import { auth } from '@/auth';
import { NextRequest } from 'next/server';

vi.mock('@/auth', () => ({
    auth: vi.fn(),
}));

vi.mock('fs/promises', () => {
    const mockWriteFile = vi.fn().mockResolvedValue(undefined);
    const mockMkdir = vi.fn().mockResolvedValue(undefined);
    return {
        default: {
            writeFile: mockWriteFile,
            mkdir: mockMkdir,
        },
        writeFile: mockWriteFile,
        mkdir: mockMkdir,
    };
});

vi.mock('@/lib/rate-limit', () => ({
    checkRateLimit: vi.fn().mockResolvedValue({ success: true, reset: Date.now() + 60000 }),
}));

describe('File Upload Hardening (POST /api/upload)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const createUploadRequest = (filePayload?: { buffer: Buffer; name: string; type: string }) => {
        const formData = {
            get: vi.fn((key: string) => {
                if (key !== 'file' || !filePayload) return null;
                return {
                    name: filePayload.name,
                    size: filePayload.buffer.length,
                    type: filePayload.type,
                    arrayBuffer: async () => filePayload.buffer.buffer.slice(
                        filePayload.buffer.byteOffset,
                        filePayload.buffer.byteOffset + filePayload.buffer.byteLength
                    ),
                };
            }),
        };

        return {
            formData: async () => formData,
        } as unknown as NextRequest;
    };

    it('should return 401 if unauthenticated', async () => {
        vi.mocked(auth).mockResolvedValue(null as any);
        const req = createUploadRequest();
        const res = await POST(req);
        expect(res.status).toBe(401);
    });

    it('should return 400 if file is missing', async () => {
        vi.mocked(auth).mockResolvedValue({ user: { id: 'agent-1' } } as any);
        const req = createUploadRequest();
        const res = await POST(req);
        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.error).toBe('No file provided');
    });

    it('should accept valid PNG image and enforce .png extension', async () => {
        vi.mocked(auth).mockResolvedValue({ user: { id: 'agent-1' } } as any);

        // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
        const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
        const req = createUploadRequest({
            buffer: pngBuffer,
            name: 'client_image.jpg', // Client spoofed name as jpg
            type: 'image/jpeg',        // Client spoofed content-type
        });

        const res = await POST(req);
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.type).toBe('image/png');
        expect(json.filename.endsWith('.png')).toBe(true);
        expect(json.url.endsWith('.png')).toBe(true);
    });

    it('should accept valid JPEG image and enforce .jpg extension', async () => {
        vi.mocked(auth).mockResolvedValue({ user: { id: 'agent-1' } } as any);

        // JPEG magic bytes: FF D8 FF
        const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
        const req = createUploadRequest({
            buffer: jpegBuffer,
            name: 'document.pdf', // Client spoofed name
            type: 'application/pdf',
        });

        const res = await POST(req);
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.type).toBe('image/jpeg');
        expect(json.filename.endsWith('.jpg')).toBe(true);
    });

    it('should reject non-image file with spoofed MIME type (Stored XSS defense)', async () => {
        vi.mocked(auth).mockResolvedValue({ user: { id: 'agent-1' } } as any);

        // HTML payload claiming to be image/png
        const htmlPayload = Buffer.from('<html><script>alert("xss")</script></html>');
        const req = createUploadRequest({
            buffer: htmlPayload,
            name: 'evil.html',
            type: 'image/png', // Spoofed header
        });

        const res = await POST(req);
        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.error).toContain('Invalid file content');
    });

    it('should reject file exceeding MAX_FILE_SIZE (5MB)', async () => {
        vi.mocked(auth).mockResolvedValue({ user: { id: 'agent-1' } } as any);

        const oversizedBuffer = Buffer.alloc(5 * 1024 * 1024 + 1024);
        const req = createUploadRequest({
            buffer: oversizedBuffer,
            name: 'large.png',
            type: 'image/png',
        });

        const res = await POST(req);
        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.error).toContain('File too large');
    });
});
