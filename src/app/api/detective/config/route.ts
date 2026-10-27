import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { aiConfigurations } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { createId } from '@paralleldrive/cuid2';
import { checkRateLimit } from '@/lib/rate-limit';
import { encryptApiKey } from '@/lib/ai/encrypt';
import { normalizeOllamaUrl } from '@/lib/ai/ai-providers';

const configSchema = z.object({
  provider: z.string(),
  modelId: z.string(),
  apiKey: z.string().optional().nullable(),
  baseUrl: z.string().optional().nullable(),
});

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rl = await checkRateLimit(`${session.user.id}:config_get`, 30, 60000);
    if (!rl.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const config = await db.query.aiConfigurations.findFirst({
      where: and(
        eq(aiConfigurations.userId, session.user.id),
        eq(aiConfigurations.isActive, true)
      ),
    });

    if (!config) {
      return NextResponse.json({ config: null });
    }

    return NextResponse.json({
      config: {
        ...config,
        apiKey: config.apiKey ? '********' : null,
      },
    });
  } catch (error) {
    console.error('Failed to get AI config:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rl = await checkRateLimit(`${session.user.id}:config_post`, 20, 60000);
    if (!rl.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const body = await req.json();
    const validatedData = configSchema.parse(body);
    const providerLower = validatedData.provider.toLowerCase();

    // Deactivate existing active configs
    const activeConfigs = await db
      .update(aiConfigurations)
      .set({ isActive: false })
      .where(
        and(
          eq(aiConfigurations.userId, session.user.id),
          eq(aiConfigurations.isActive, true)
        )
      )
      .returning();

    const previousConfig = activeConfigs.length > 0 ? activeConfigs[0] : null;

    let finalApiKey: string | null = null;
    let finalBaseUrl: string | null = null;

    if (providerLower === 'ollama') {
      finalApiKey = null;
      finalBaseUrl = normalizeOllamaUrl(validatedData.baseUrl);
    } else {
      finalBaseUrl = null;
      if (validatedData.apiKey && validatedData.apiKey !== '********' && validatedData.apiKey.trim() !== '') {
        finalApiKey = encryptApiKey(validatedData.apiKey.trim());
      } else if (
        previousConfig &&
        previousConfig.provider?.toLowerCase() === providerLower &&
        previousConfig.apiKey
      ) {
        // Re-use saved key only for the same provider
        finalApiKey = previousConfig.apiKey;
      }
    }

    // Insert new config
    const [newConfig] = await db
      .insert(aiConfigurations)
      .values({
        id: createId(),
        userId: session.user.id,
        provider: providerLower,
        modelId: validatedData.modelId,
        apiKey: finalApiKey,
        baseUrl: finalBaseUrl,
        isActive: true,
      })
      .returning();

    return NextResponse.json({
      success: true,
      config: {
        ...newConfig,
        apiKey: newConfig.apiKey ? '********' : null,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error('Failed to save AI config:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rl = await checkRateLimit(`${session.user.id}:config_delete`, 10, 60000);
    if (!rl.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    await db
      .update(aiConfigurations)
      .set({ isActive: false })
      .where(
        and(
          eq(aiConfigurations.userId, session.user.id),
          eq(aiConfigurations.isActive, true)
        )
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete AI config:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
