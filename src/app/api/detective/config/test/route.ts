import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { validateConfig } from '@/lib/ai/ai-providers';
import { checkRateLimit } from '@/lib/rate-limit';
import { decryptApiKey } from '@/lib/ai/encrypt';
import { db } from '@/lib/db';
import { aiConfigurations } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';

export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ valid: false, error: 'Unauthorized' }, { status: 401 });
    }

    const rl = await checkRateLimit(`${session.user.id}:config_test`, 30, 60000);
    if (!rl.success) {
      return NextResponse.json(
        { valid: false, error: 'Rate limit exceeded. Please wait a moment before testing again.' },
        { status: 429 }
      );
    }

    let config = await req.json();
    if (!config?.provider || !config?.modelId) {
      return NextResponse.json(
        { valid: false, error: 'Provider and model are required.' },
        { status: 400 }
      );
    }

    const providerLower = (config.provider as string).toLowerCase();
    config.provider = providerLower;

    if (providerLower !== 'ollama') {
      config.baseUrl = undefined;
    }

    if (providerLower !== 'ollama' && (!config.apiKey || config.apiKey === '********')) {
      const savedConfig = await db.query.aiConfigurations.findFirst({
        where: and(
          eq(aiConfigurations.userId, session.user.id),
          eq(aiConfigurations.isActive, true)
        ),
      });

      // Crucial: Only reuse saved key if savedConfig is for the exact same provider
      if (savedConfig && savedConfig.apiKey && savedConfig.provider?.toLowerCase() === providerLower) {
        config = { ...config, apiKey: decryptApiKey(savedConfig.apiKey) };
      }
    }

    if (providerLower !== 'ollama' && (!config.apiKey || !config.apiKey.trim())) {
      return NextResponse.json(
        { valid: false, error: `API key is required to test ${config.provider}.` },
        { status: 400 }
      );
    }

    const result = await validateConfig(config);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Config test error:', error);
    return NextResponse.json(
      { valid: false, error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
