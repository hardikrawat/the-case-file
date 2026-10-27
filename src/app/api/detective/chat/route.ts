import { streamText } from 'ai';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { aiConfigurations } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { getModel } from '@/lib/ai/ai-providers';
import { buildSystemPrompt } from '@/lib/ai/detective-system-prompt';
import { serializeBoardForAI } from '@/lib/ai/board-serializer';
import { checkRateLimit } from '@/lib/rate-limit';
import { decryptApiKey } from '@/lib/ai/encrypt';


import { extractEntities } from '@/lib/ai/entity-extractor';
import { analyzeSpatialLayout } from '@/lib/ai/spatial-analyzer';
import { detectiveTools } from '@/lib/ai/ai-tools';

export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rl = await checkRateLimit(`${session.user.id}:chat`, 20, 60000);
    if (!rl.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
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

    // Add spatial analysis and entity extraction
    const spatialLayout = analyzeSpatialLayout(boardNodes, boardEdges);
    const spatialString = JSON.stringify({
      density: spatialLayout.density,
      isolatedNodesCount: spatialLayout.isolatedNodes.length,
      clustersCount: spatialLayout.clusters.length,
      hubs: spatialLayout.hubs.map(h => ({ id: h.node.id, connections: h.connectionCount }))
    }, null, 2);

    const fullBoardContext = `${serializedBoard}\n\nSPATIAL LAYOUT:\n${spatialString}`;

    const entityMapObj = extractEntities(boardNodes);
    const entityMapString = JSON.stringify(entityMapObj, null, 2);

    // Build system prompt
    const systemPrompt = buildSystemPrompt(fullBoardContext, entityMapString);

    // Get model instance
    const decryptedConfig = { ...config, apiKey: config.apiKey ? decryptApiKey(config.apiKey) : null };
    const model = getModel(decryptedConfig as unknown as import('@/types/detective').AIProviderConfig);

    const result = streamText({
      model,
      system: systemPrompt,
      messages,
      tools: detectiveTools,
      maxSteps: 5,
      abortSignal: AbortSignal.timeout(300000), // 5-minute timeout for deep reasoning/slow models
    } as Parameters<typeof streamText>[0]);

    return result.toTextStreamResponse();
  } catch (error) {
    console.error('Chat API Error:', error);
    return NextResponse.json(
      { error: 'An error occurred during chat processing' },
      { status: 500 }
    );
  }
}
