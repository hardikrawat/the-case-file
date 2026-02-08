import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get('url');

    if (!url) {
        return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    try {
        // Simple SSRF protection: only allow http/https
        if (!url.startsWith('http')) {
            return NextResponse.json({ error: 'Invalid URL protocol' }, { status: 400 });
        }

        const response = await fetch(url, {
            next: { revalidate: 3600 }, // Cache for 1 hour
            headers: {
                'User-Agent': 'TheCaseFile-Bot/1.0',
            },
        });

        if (!response.ok) {
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
