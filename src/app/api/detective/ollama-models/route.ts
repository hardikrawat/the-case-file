import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { normalizeOllamaUrl } from '@/lib/ai/ai-providers';

export const maxDuration = 60;

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const rawBaseUrl = searchParams.get('baseUrl') || 'http://localhost:11434';
    const normalizedUrl = normalizeOllamaUrl(rawBaseUrl);

    // Probe Ollama with 30s timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const res = await fetch(`${normalizedUrl}/models`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return NextResponse.json({ models: [] });
    }

    const data = (await res.json()) as { data?: Array<{ id: string }> };
    const models = Array.isArray(data.data) ? data.data.map((m) => m.id) : [];

    return NextResponse.json({ models });
  } catch {
    // Ollama not reachable or offline - return empty list gracefully
    return NextResponse.json({ models: [] });
  }
}
