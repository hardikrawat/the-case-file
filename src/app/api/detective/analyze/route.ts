import { generateObject } from 'ai';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { aiConfigurations } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { getModel } from '@/lib/ai/ai-providers';
import { serializeBoardForAI } from '@/lib/ai/board-serializer';
import { checkRateLimit } from '@/lib/rate-limit';
import { decryptApiKey } from '@/lib/ai/encrypt';

// Define the expected output schema based on AnalysisResult from src/types/detective.ts
// (Assuming a general structure, this can be refined based on the actual type)
const analysisResultSchema = z.object({
  summary: z.string().describe('Executive summary of the case analysis'),
  confidenceScore: z.number().min(0).max(100).default(75).describe('Overall confidence score between 0 and 100'),
  suggestedConnections: z.array(z.object({
    id: z.string(),
    sourceNodeId: z.string(),
    targetNodeId: z.string(),
    sourceLabel: z.string(),
    targetLabel: z.string(),
    reasoning: z.string(),
    confidence: z.enum(['low', 'medium', 'high']),
  })).default([]),
  gaps: z.array(z.object({
    id: z.string(),
    description: z.string(),
    reasoning: z.string(),
    suggestedType: z.enum(['sticky', 'text', 'image', 'article']),
    urgency: z.enum(['low', 'medium', 'high']),
  })).default([]),
  contradictions: z.array(z.object({
    id: z.string(),
    nodeIdA: z.string(),
    nodeLabelA: z.string(),
    nodeIdB: z.string(),
    nodeLabelB: z.string(),
    description: z.string(),
  })).default([]),
  timeline: z.array(z.object({
    date: z.string(),
    description: z.string(),
    sourceNodeId: z.string().optional(),
    confidence: z.enum(['confirmed', 'estimated', 'speculative']),
  })).default([]),
  hypotheses: z.array(z.object({
    id: z.string(),
    title: z.string(),
    summary: z.string(),
    supportingEvidence: z.array(z.string()).default([]),
    contradictingEvidence: z.array(z.string()).default([]),
    missingEvidence: z.array(z.string()).default([]),
    confidence: z.enum(['speculative', 'plausible', 'supported', 'strong']),
  })).default([]),
  counterQuestions: z.array(z.object({
    id: z.string(),
    question: z.string(),
    context: z.string(),
    urgency: z.enum(['low', 'medium', 'high']),
  })).default([]),
});

export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rl = await checkRateLimit(`${session.user.id}:analyze`, 10, 60000);
    if (!rl.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const body = await req.json();
    const nodes = body.nodes || body.boardState?.nodes || [];
    const edges = body.edges || body.boardState?.edges || [];
    const boardTitle = body.boardTitle || 'Untitled Case';
    const analysisType = body.analysisType || body.type || 'full_scan';

    // Load AI config
    const config = await db.query.aiConfigurations.findFirst({
      where: and(
        eq(aiConfigurations.userId, session.user.id),
        eq(aiConfigurations.isActive, true)
      ),
    });

    if (!config) {
      return NextResponse.json(
        { error: 'AI configuration not found' },
        { status: 400 }
      );
    }

    // Serialize board
    const serializedBoard = serializeBoardForAI(nodes, edges, boardTitle);
    const decryptedConfig = { ...config, apiKey: config.apiKey ? decryptApiKey(config.apiKey) : null };
    const model = getModel(decryptedConfig as unknown as import('@/types/detective').AIProviderConfig);

    let prompt = `Analyze the following detective board titled "${boardTitle}".\n`;
    prompt += `Board Data:\n${serializedBoard}\n\n`;

    switch (analysisType) {
      case 'find_gaps':
        prompt += 'Focus on finding missing information, logical leaps, or gaps in the current investigation.';
        break;
      case 'generate_timeline':
        prompt += 'Focus on extracting and organizing all events into a chronological timeline.';
        break;
      case 'find_contradictions':
        prompt += 'Focus on identifying any contradictory statements, conflicting evidence, or impossible timelines.';
        break;
      case 'full_scan':
      default:
        prompt += 'Perform a comprehensive scan, providing a summary, key insights, anomalies, and potential new connections.';
        break;
    }

    // Use generateObject with 5-minute timeout
    const result = await generateObject({
      model,
      schema: analysisResultSchema,
      prompt,
      abortSignal: AbortSignal.timeout(300000), // 5-minute timeout for complex multi-node reasoning
    });

    return NextResponse.json({ ...result.object, timestamp: Date.now() });
  } catch (error) {
    console.error('Analysis API Error:', error);
    return NextResponse.json(
      { error: 'An error occurred during board analysis' },
      { status: 500 }
    );
  }
}
