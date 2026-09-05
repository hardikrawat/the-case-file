import { NextRequest, NextResponse } from 'next/server';
import dns from 'node:dns/promises';
import net from 'node:net';
import { checkRateLimit } from '@/lib/rate-limit';

function isPrivateIPv4(ip: string): boolean {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some(n => isNaN(n) || n < 0 || n > 255)) return true;
    const [a, b, c] = parts;
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 10) return true; // 10.0.0.0/8 (RFC 1918)
    if (a === 127) return true; // 127.0.0.0/8 (Loopback)
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 (Link-Local / IMDS)
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 (RFC 1918)
    if (a === 192 && b === 168) return true; // 192.168.0.0/16 (RFC 1918)
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 (Carrier-grade NAT)
    if (a === 192 && b === 0 && c === 0) return true; // 192.0.0.0/24
    if (a === 192 && b === 0 && c === 2) return true; // 192.0.2.0/24 (TEST-NET-1)
    if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15
    if (a === 198 && b === 51 && c === 100) return true; // 198.51.100.0/24 (TEST-NET-2)
    if (a === 203 && b === 0 && c === 113) return true; // 203.0.113.0/24 (TEST-NET-3)
    if (a >= 224) return true; // 224.0.0.0/4 & 240.0.0.0/4 (Multicast & Reserved)
    return false;
}

function isPrivateIPv6(ip: string): boolean {
    const lower = ip.toLowerCase();
    if (lower === '::1' || lower === '::') return true;
    // Check IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1 or ::ffff:7f00:1)
    if (lower.startsWith('::ffff:')) {
        const rest = lower.slice(7);
        if (net.isIPv4(rest)) return isPrivateIPv4(rest);
        const hexParts = rest.split(':');
        if (hexParts.length === 2) {
            const p1 = parseInt(hexParts[0], 16);
            const p2 = parseInt(hexParts[1], 16);
            const a = (p1 >> 8) & 0xff;
            const b = p1 & 0xff;
            const c = (p2 >> 8) & 0xff;
            const d = p2 & 0xff;
            return isPrivateIPv4(`${a}.${b}.${c}.${d}`);
        }
    }
    // Link-local: fe80::/10
    if (/^fe[89ab]/i.test(lower)) return true;
    // Unique local (ULA): fc00::/7
    if (/^f[cd]/i.test(lower)) return true;
    return false;
}

function isPrivateIP(ip: string): boolean {
    if (net.isIPv4(ip)) return isPrivateIPv4(ip);
    if (net.isIPv6(ip)) return isPrivateIPv6(ip);
    return true;
}

async function validateUrlSafety(urlStr: string): Promise<{ safe: boolean; error?: string; urlObj?: URL }> {
    let parsed: URL;
    try {
        parsed = new URL(urlStr);
    } catch {
        return { safe: false, error: 'Invalid URL format' };
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return { safe: false, error: 'Invalid URL protocol: only http and https are allowed' };
    }

    const rawHost = parsed.hostname;
    if (!rawHost || rawHost === '.') {
        return { safe: false, error: 'Invalid hostname' };
    }

    const host = rawHost.replace(/^\[|\]$/g, '');
    if (host === 'localhost' || host.endsWith('.localhost')) {
        return { safe: false, error: 'Access to localhost is forbidden' };
    }

    if (net.isIP(host)) {
        if (isPrivateIP(host)) {
            return { safe: false, error: 'Access to private network address is forbidden' };
        }
    } else {
        try {
            const addresses = await dns.lookup(host, { all: true });
            if (!addresses || addresses.length === 0) {
                return { safe: false, error: 'Failed to resolve hostname' };
            }
            for (const addr of addresses) {
                if (isPrivateIP(addr.address)) {
                    return { safe: false, error: 'Access to private network address is forbidden' };
                }
            }
        } catch {
            return { safe: false, error: 'Failed to resolve hostname' };
        }
    }

    return { safe: true, urlObj: parsed };
}

export async function GET(req: NextRequest) {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
               req.headers.get('x-real-ip') || 
               '127.0.0.1';

    // Rate Limiting: 20 requests per minute per IP
    const rateLimit = await checkRateLimit(`preview:${ip}`, 20, 60000);
    if (!rateLimit.success) {
        return NextResponse.json({ error: 'Too many requests. Please wait.' }, { status: 429 });
    }

    const { searchParams } = new URL(req.url);
    const url = searchParams.get('url');

    if (!url) {
        return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    const validation = await validateUrlSafety(url);
    if (!validation.safe || !validation.urlObj) {
        return NextResponse.json({ error: validation.error || 'Invalid URL' }, { status: 400 });
    }

    try {
        let currentUrl = validation.urlObj.toString();
        let response: Response | null = null;
        let hops = 0;

        while (hops < 3) {
            response = await fetch(currentUrl, {
                redirect: 'manual',
                signal: AbortSignal.timeout(5000),
                headers: {
                    'User-Agent': 'TheCaseFile-Bot/1.0',
                },
            });

            if (response.status >= 300 && response.status < 400) {
                const location = response.headers.get('location');
                if (!location) break;

                const nextUrl = new URL(location, currentUrl).toString();
                const nextValidation = await validateUrlSafety(nextUrl);
                if (!nextValidation.safe) {
                    return NextResponse.json({ error: nextValidation.error }, { status: 400 });
                }
                currentUrl = nextUrl;
                hops++;
            } else {
                break;
            }
        }

        if (!response || !response.ok) {
            return NextResponse.json({ error: 'Failed to fetch article' }, { status: 500 });
        }

        const html = await response.text();

        // Extract metadata using regex (cheap and doesn't require extra heavy libs)
        const getMeta = (property: string) => {
            const regex = new RegExp(`<meta[^>]+property=["']og:${property}["'][^>]+content=["']([^"']+)["']`, 'i');
            const match = html.match(regex);
            if (match) return match[1];

            // Try name instead of property
            const nameRegex = new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i');
            const nameMatch = html.match(nameRegex);
            return nameMatch ? nameMatch[1] : null;
        };

        // Also try standard title tag
        const getTitle = () => {
            const match = html.match(/<title>([^<]+)<\/title>/i);
            return match ? match[1] : null;
        };

        const title = getMeta('title') || getTitle() || url;
        const image = getMeta('image');
        const description = getMeta('description');

        return NextResponse.json({
            title: title.trim(),
            image,
            description: description?.trim(),
            url,
        });
    } catch (error) {
        console.error('Preview error:', error);
        return NextResponse.json({ error: 'Failed to generate preview' }, { status: 500 });
    }
}
