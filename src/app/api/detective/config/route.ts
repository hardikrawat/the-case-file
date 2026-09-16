import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { aiConfigurations } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { createId } from '@paralleldrive/cuid2';

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

    const body = await req.json();
    const validatedData = configSchema.parse(body);

    // In a real implementation, we might validate the config by making a test call here

    // Deactivate existing active configs
    await db
      .update(aiConfigurations)
      .set({ isActive: false })
      .where(
        and(
          eq(aiConfigurations.userId, session.user.id),
          eq(aiConfigurations.isActive, true)
        )
      );

    // Insert new config
    const [newConfig] = await db
      .insert(aiConfigurations)
      .values({
        id: createId(),
        userId: session.user.id,
        provider: validatedData.provider,
        modelId: validatedData.modelId,
        apiKey: validatedData.apiKey || null,
        baseUrl: validatedData.baseUrl || null,
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
