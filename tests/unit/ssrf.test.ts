import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/preview/route';
import { NextRequest } from 'next/server';

// Mock rate-limit
vi.mock('@/lib/rate-limit', () => ({
    checkRateLimit: vi.fn().mockResolvedValue({ success: true, reset: Date.now() + 60000 }),
}));

describe('SSRF Defense in GET /api/preview', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const createPreviewRequest = (url?: string) => {
        const reqUrl = url !== undefined
            ? `http://localhost:3000/api/preview?url=${encodeURIComponent(url)}`
            : 'http://localhost:3000/api/preview';
        return new NextRequest(reqUrl, {
            headers: {
                'x-forwarded-for': '198.51.100.1',
            },
        });
    };

    it('should return 400 when URL query parameter is missing', async () => {
        const req = createPreviewRequest();
        const res = await GET(req);
        const json = await res.json();

        expect(res.status).toBe(400);
        expect(json.error).toBe('URL is required');
    });

    it('should reject loopback IPv4 addresses with 400 Bad Request', async () => {
        const loopbacks = [
            'http://127.0.0.1',
            'http://127.0.0.1:8080',
            'http://127.0.0.2',
            'http://0.0.0.0',
            'http://localhost',
            'http://test.localhost',
        ];

        for (const url of loopbacks) {
            const req = createPreviewRequest(url);
            const res = await GET(req);
            const json = await res.json();

            expect(res.status).toBe(400);
            expect(json.error).toBeDefined();
        }
    });

    it('should reject Cloud IMDS addresses (169.254.169.254) with 400 Bad Request', async () => {
        const imdsVectors = [
            'http://169.254.169.254',
            'http://169.254.169.254/latest/meta-data/',
            'http://169.254.1.1',
        ];

        for (const url of imdsVectors) {
            const req = createPreviewRequest(url);
            const res = await GET(req);
            const json = await res.json();

            expect(res.status).toBe(400);
            expect(json.error).toBeDefined();
        }
    });

    it('should reject RFC 1918 private subnets with 400 Bad Request', async () => {
        const privateSubnets = [
            'http://10.0.0.1',
            'http://10.255.255.254',
            'http://172.16.0.1',
            'http://172.31.255.254',
            'http://192.168.1.1',
            'http://192.168.0.254',
        ];

        for (const url of privateSubnets) {
            const req = createPreviewRequest(url);
            const res = await GET(req);
            const json = await res.json();

            expect(res.status).toBe(400);
            expect(json.error).toBeDefined();
        }
    });

    it('should reject non-HTTP schemes with 400 Bad Request', async () => {
        const nonHttp = [
            'file:///etc/passwd',
            'ftp://ftp.example.com',
            'javascript:alert(1)',
            'data:text/html,<script>alert(1)</script>',
            'gopher://127.0.0.1:70',
        ];

        for (const url of nonHttp) {
            const req = createPreviewRequest(url);
            const res = await GET(req);
            const json = await res.json();

            expect(res.status).toBe(400);
            expect(json.error).toBeDefined();
        }
    });

    it('should reject obfuscated IP representations with 400 Bad Request', async () => {
        const obfuscated = [
            'http://2130706433', // 127.0.0.1 decimal
            'http://0177.0.0.1',  // 127.0.0.1 octal
            'http://0x7f000001',  // 127.0.0.1 hex
            'http://[::1]',       // IPv6 loopback
            'http://[::ffff:127.0.0.1]', // IPv4-mapped IPv6
        ];

        for (const url of obfuscated) {
            const req = createPreviewRequest(url);
            const res = await GET(req);
            const json = await res.json();

            expect(res.status).toBe(400);
            expect(json.error).toBeDefined();
        }
    });

    it('should reject malformed and truncated URLs with 400 Bad Request', async () => {
        const malformed = [
            'not-a-url',
            'http://',
            'https://',
            'http://.',
            '://missing-scheme',
            'http://[invalid-ipv6]',
        ];

        for (const url of malformed) {
            const req = createPreviewRequest(url);
            const res = await GET(req);
            const json = await res.json();

            expect(res.status).toBe(400);
            expect(json.error).toBeDefined();
        }
    });
});
