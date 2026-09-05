import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { createId } from '@paralleldrive/cuid2';
import { checkRateLimit } from '@/lib/rate-limit';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MIME_TO_EXT: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
};
const UPLOAD_DIR = join(process.cwd(), 'public', 'uploads');

function detectImageMime(buffer: Buffer): string | null {
    if (buffer.length < 12) return null;

    // JPEG: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        return 'image/jpeg';
    }

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47 &&
        buffer[4] === 0x0d &&
        buffer[5] === 0x0a &&
        buffer[6] === 0x1a &&
        buffer[7] === 0x0a
    ) {
        return 'image/png';
    }

    // GIF: GIF87a or GIF89a
    if (
        buffer[0] === 0x47 &&
        buffer[1] === 0x49 &&
        buffer[2] === 0x46 &&
        buffer[3] === 0x38 &&
        (buffer[4] === 0x37 || buffer[4] === 0x39) &&
        buffer[5] === 0x61
    ) {
        return 'image/gif';
    }

    // WEBP: RIFF....WEBP
    if (
        buffer[0] === 0x52 &&
        buffer[1] === 0x49 &&
        buffer[2] === 0x46 &&
        buffer[3] === 0x46 &&
        buffer[8] === 0x57 &&
        buffer[9] === 0x45 &&
        buffer[10] === 0x42 &&
        buffer[11] === 0x50
    ) {
        return 'image/webp';
    }

    return null;
}

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Rate Limit (User-based): 20 uploads per hour per user
        const rateLimit = await checkRateLimit(`upload:${session.user.id}`, 20, 3600000);
        if (!rateLimit.success) {
            return NextResponse.json(
                { error: 'Upload limit exceeded. Please wait before uploading more files.' },
                { status: 429 }
            );
        }

        const formData = await req.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json(
                { error: 'File too large. Maximum size is 5MB.' },
                { status: 400 }
            );
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Verify real magic bytes - do not trust client headers
        const detectedMime = detectImageMime(buffer);
        if (!detectedMime || !ALLOWED_TYPES.includes(detectedMime)) {
            return NextResponse.json(
                { error: 'Invalid file content. Only real JPEG, PNG, GIF, and WebP images are allowed.' },
                { status: 400 }
            );
        }

        // Enforce extension strictly from verified MIME, never from file.name
        const extension = MIME_TO_EXT[detectedMime];
        const filename = `${createId()}.${extension}`;
        const filepath = join(UPLOAD_DIR, filename);

        // Create upload directory if it doesn't exist
        try {
            await mkdir(UPLOAD_DIR, { recursive: true });
        } catch {
            // Directory might already exist
        }

        await writeFile(filepath, buffer);

        // Return public URL
        const publicUrl = `/uploads/${filename}`;

        return NextResponse.json({
            url: publicUrl,
            filename,
            size: file.size,
            type: detectedMime,
        });
    } catch (error) {
        console.error('Upload error:', error);
        return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }
}
