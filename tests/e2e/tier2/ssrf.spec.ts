import { test, expect } from '@playwright/test';
import { createApiClient } from '../helpers';

test.describe('Tier 2: SSRF Defense & Protocol Boundaries (GET /api/preview)', () => {
    const api = createApiClient();

    test('T2-SSRF-01: Loopback IPv4 & Localhost Probing', async () => {
        const loopbackVectors = [
            'http://127.0.0.1',
            'http://127.0.0.1:80',
            'http://127.0.0.1:22',
            'http://localhost',
            'http://localhost:3000',
            'http://0.0.0.0',
            'http://0.0.0.0:8080',
        ];

        for (const url of loopbackVectors) {
            const res = await api.get<{ error?: string }>('/api/preview', {
                params: { url },
                user: null,
            });

            expect(res.status, `Loopback probe ${url} should be rejected with 400 Bad Request`).toBe(400);
            expect(res.data.error).toBeDefined();
        }
    });

    test('T2-SSRF-02: Cloud Instance Metadata Service (IMDS) Probing', async () => {
        const imdsVectors = [
            'http://169.254.169.254',
            'http://169.254.169.254/latest/meta-data/',
            'http://169.254.169.254/latest/meta-data/iam/security-credentials/',
            'http://169.254.169.254/latest/user-data',
        ];

        for (const url of imdsVectors) {
            const res = await api.get<{ error?: string }>('/api/preview', {
                params: { url },
                user: null,
            });

            expect(res.status, `Cloud IMDS probe ${url} should be rejected with 400 Bad Request`).toBe(400);
            expect(res.data.error).toBeDefined();
        }
    });

    test('T2-SSRF-03: RFC 1918 Private Subnet Probing', async () => {
        const privateVectors = [
            'http://10.0.0.1/admin',
            'http://10.255.255.254',
            'http://172.16.0.1/secret',
            'http://172.31.255.254',
            'http://192.168.1.1/router-login',
            'http://192.168.0.254',
        ];

        for (const url of privateVectors) {
            const res = await api.get<{ error?: string }>('/api/preview', {
                params: { url },
                user: null,
            });

            expect(res.status, `Private network probe ${url} should be rejected with 400 Bad Request`).toBe(400);
            expect(res.data.error).toBeDefined();
        }
    });

    test('T2-SSRF-04: Non-HTTP Scheme Rejection', async () => {
        const nonHttpVectors = [
            'file:///etc/passwd',
            'file://C:/Windows/win.ini',
            'ftp://ftp.example.com/test.txt',
            'javascript:alert(1)',
            'data:text/html,<script>alert(1)</script>',
            'gopher://127.0.0.1:70/',
        ];

        for (const url of nonHttpVectors) {
            const res = await api.get<{ error?: string }>('/api/preview', {
                params: { url },
                user: null,
            });

            expect(res.status, `Non-HTTP protocol ${url} should be rejected with 400 Bad Request`).toBe(400);
            expect(res.data.error).toBeDefined();
        }
    });

    test('T2-SSRF-05: Obfuscated & Alternative IP Formats', async () => {
        const obfuscatedVectors = [
            'http://2130706433', // Decimal representation of 127.0.0.1
            'http://0177.0.0.1',  // Octal representation
            'http://0x7f000001',  // Hex representation
            'http://[::1]',       // IPv6 loopback
            'http://[::ffff:127.0.0.1]', // IPv6-mapped IPv4 loopback
        ];

        for (const url of obfuscatedVectors) {
            const res = await api.get<{ error?: string }>('/api/preview', {
                params: { url },
                user: null,
            });

            expect(res.status, `Obfuscated IP ${url} should be rejected with 400 Bad Request`).toBe(400);
            expect(res.data.error).toBeDefined();
        }
    });

    test('T2-SSRF-06: Malformed & Truncated URL Strings', async () => {
        const malformedVectors = [
            'not-a-valid-url',
            'http://',
            'https://',
            'http://.',
            '://missing-scheme',
            'http://[invalid-ipv6]',
        ];

        for (const url of malformedVectors) {
            const res = await api.get<{ error?: string }>('/api/preview', {
                params: { url },
                user: null,
            });

            // Must reject cleanly with 400 without server crash (500)
            expect(res.status, `Malformed URL ${url} should result in 400 Bad Request`).toBe(400);
            expect(res.data.error).toBeDefined();
        }

        // Test with completely omitted URL query parameter
        const emptyRes = await api.get<{ error?: string }>('/api/preview', { user: null });
        expect(emptyRes.status).toBe(400);
        expect(emptyRes.data.error).toBeDefined();
    });
});
