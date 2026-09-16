import { streamText } from 'ai';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { aiConfigurations } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { getModel } from '@/lib/ai/ai-providers';
import { buildSystemPrompt } from '@/lib/ai/detective-system-prompt';
import { serializeBoardForAI } from '@/lib/ai/board-serializer';
import { detectiveTools } from '@/lib/ai/ai-tools';

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { messages, nodes, edges, boardTitle } = await req.json();

    if (!messages) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Load user's AI config from DB
    const config = await db.query.aiConfigurations.findFirst({
      where: and(
        eq(aiConfigurations.userId, session.user.id),
        eq(aiConfigurations.isActive, true)
      ),
    });

    if (!config) {
      return NextResponse.json(
        { error: 'AI configuration not found. Please configure AI settings first.' },
        { status: 400 }
      );
    }

    // Serialize board state
    const boardNodes = nodes || [];
    const boardEdges = edges || [];
    const serializedBoard = serializeBoardForAI(boardNodes, boardEdges, boardTitle || 'Untitled Case');

    // Build system prompt
    const systemPrompt = buildSystemPrompt(serializedBoard, boardTitle || 'Untitled Case');

    // Get model instance
    const model = getModel(config as unknown as import('@/types/detective').AIProviderConfig);

    // Call streamText
    const result = streamText({
      model,
      system: systemPrompt,
      messages,
      tools: detectiveTools,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error('Chat API Error:', error);
    return NextResponse.json(
      { error: 'An error occurred during chat processing' },
      { status: 500 }
    );
  }
}
