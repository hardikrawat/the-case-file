import { generateObject } from 'ai';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { aiConfigurations } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { getModel } from '@/lib/ai/ai-providers';
import { checkRateLimit } from '@/lib/rate-limit';
import { decryptApiKey } from '@/lib/ai/encrypt';
import { getBoardAccess } from '@/lib/auth-checks';

const rawExtractedBoardSchema = z.object({
  caseTitle: z.string().describe('An evocative, punchy forensic title for the case'),
  confidenceScore: z.number().min(0).max(100).describe('Overall case confidence score based on evidence strength, 0-100').default(70),
  counterQuestions: z.array(z.object({
    question: z.string().describe('Critical investigative question the detective should answer next'),
    context: z.string().describe('Why this question matters for the investigation'),
    urgency: z.enum(['low', 'medium', 'high']).describe('How urgently this needs to be answered'),
  })).default([]),
  summary: z.string().describe('2-3 sentence executive synopsis of the crime, incident, or investigation'),
  nodes: z.array(
    z.object({
      id: z.string().describe('Unique identifier for this clue, e.g. incident-heist, suspect-abath, clue-door-tamper'),
      type: z.enum(['sticky', 'text', 'article', 'image', 'link']).default('sticky').describe('Visual note representation'),
      category: z.enum(['incident', 'suspect', 'victim', 'clue', 'alibi', 'location', 'timeline', 'lead']).describe('Investigative category'),
      label: z.string().describe('Main headline, suspect name, or clue title'),
      description: z.string().describe('Factual details, testimony excerpts, or evidence significance'),
      color: z.enum(['#fca5a5', '#fef3c7', '#bbf7d0', '#bfdbfe', '#99f6e4']).optional().describe('Color code: #fca5a5 (suspects/red), #fef3c7 (clues/yellow), #bbf7d0 (alibis/green), #bfdbfe (forensics/blue), #99f6e4 (locations/teal)'),
      cluster: z.enum(['center_incident', 'left_suspects', 'right_evidence', 'bottom_timeline', 'top_locations']).describe('Placement zone on the board'),
    })
  ),
  edges: z.array(
    z.object({
      sourceId: z.string().describe('Source node ID'),
      targetId: z.string().describe('Target node ID'),
      label: z.string().describe('Short relation label, e.g., "Alibi contradicts", "Fingerprints on", "Seen at", "Stolen from"'),
      reasoning: z.string().describe('Deductive explanation for why these two clues are linked'),
      confidence: z.enum(['low', 'medium', 'high']).default('medium').describe('How confident is this connection'),
    })
  ),
  timeline: z.array(z.object({
    date: z.string().describe('Date or time of the event as mentioned in the narrative, e.g., "March 18, 1990, 1:24 AM" or "72 hours prior"'),
    description: z.string().describe('What happened at this time'),
    sourceNodeId: z.string().optional().describe('The node ID this event relates to'),
    confidence: z.enum(['confirmed', 'estimated', 'speculative']).describe('How certain the date/time is'),
  })).default([]),
  hypotheses: z.array(
    z.object({
      title: z.string().describe('Theory headline'),
      summary: z.string().describe('Explanation of how the evidence supports this theory'),
      confidence: z.enum(['speculative', 'plausible', 'supported', 'strong']).describe('Confidence level'),
      supportingNodeIds: z.array(z.string()).default([]).describe('IDs of nodes that support this hypothesis'),
      contradictingNodeIds: z.array(z.string()).default([]).describe('IDs of nodes that contradict this hypothesis'),
    })
  ).default([]),
});

export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rl = await checkRateLimit(`${session.user.id}:generate_board`, 5, 60000);
    if (!rl.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const body = await req.json();
    const { statement, mode = 'replace', density = 'balanced', existingNodes = [] } = body;

    if (body.boardId) {
      const access = await getBoardAccess(body.boardId, session.user.id);
      if (access.board && !access.canEdit) {
        return NextResponse.json({ error: 'You do not have permission to edit this board' }, { status: 403 });
      }
    }

    if (!statement || typeof statement !== 'string' || statement.trim().length < 15) {
      return NextResponse.json(
        { error: 'Please provide a descriptive statement, crime narrative, or police report.' },
        { status: 400 }
      );
    }

    // Load user's AI config
    const config = await db.query.aiConfigurations.findFirst({
      where: and(
        eq(aiConfigurations.userId, session.user.id),
        eq(aiConfigurations.isActive, true)
      ),
    });

    if (!config) {
      return NextResponse.json(
        { error: 'AI configuration not found. Please configure your API key in Settings first.' },
        { status: 400 }
      );
    }

    const decryptedConfig = { ...config, apiKey: config.apiKey ? decryptApiKey(config.apiKey) : null };
    const model = getModel(decryptedConfig as unknown as import('@/types/detective').AIProviderConfig);

    const prompt = `You are a MASTER FORENSIC DETECTIVE and Crime Board Specialist.
Analyze the following unstructured crime statement, police report, or case narrative and construct an interactive murder-board / investigation board.

INVESTIGATION STATEMENT:
"""
${statement.trim()}
"""

INSTRUCTIONS:
1. Extract ALL key suspects, victims, physical clues, forensic evidence, witness statements, crime scene locations, and timeline milestones.
2. Structure the nodes into clear investigative zones:
   - 'center_incident': The central crime/event or primary victim.
   - 'left_suspects': Suspects, persons of interest, and their claimed alibis. Color: #fca5a5 (suspects) or #bbf7d0 (alibis).
   - 'right_evidence': Physical weapons, forensic reports, stolen items, digital traces. Color: #fef3c7 or #bfdbfe.
   - 'top_locations': Crime scenes, addresses, escape routes. Color: #99f6e4.
   - 'bottom_timeline': Sequential chronological events or public clippings. Type: 'article' or 'sticky'.
3. Weave RED YARN CONNECTIONS (edges) between nodes:
   - Connect suspects to the incident, weapons, or victims with clear relation labels ("Owned by", "Seen fleeing with", "Fingerprints on").
   - Flag contradictions between alibis and physical evidence ("Conflicts with footage", "Alibi disproven").
4. Formulate 2-3 logical working hypotheses explaining how the crime occurred.
${density === 'comprehensive' ? '5. Provide comprehensive forensic granularity (include minor clues, witness quotes, and background connections).' : '5. Keep it punchy, focused, and immediately actionable for a lead detective.'}
6. Do NOT use 'image' type nodes since there are no actual images to display. Use 'sticky' or 'article' instead.
`;

    const result = await generateObject({
      model,
      schema: rawExtractedBoardSchema,
      prompt,
      abortSignal: AbortSignal.timeout(300000), // 5-minute timeout for large narrative forensic extraction
    });

    const parsed = result.object;

    const idMap = new Map<string, string>();
    parsed.nodes.forEach(n => {
      const baseId = n.id.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
      const newId = `${baseId}-${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 5)}`;
      idMap.set(baseId, newId);
      n.id = newId;
    });
    parsed.edges.forEach(e => {
      e.sourceId = idMap.get(e.sourceId.toLowerCase().replace(/[^a-z0-9_-]/g, '-')) || e.sourceId;
      e.targetId = idMap.get(e.targetId.toLowerCase().replace(/[^a-z0-9_-]/g, '-')) || e.targetId;
    });
    parsed.hypotheses.forEach(h => {
      h.supportingNodeIds = h.supportingNodeIds.map(id => idMap.get(id.toLowerCase().replace(/[^a-z0-9_-]/g, '-')) || id);
      h.contradictingNodeIds = h.contradictingNodeIds.map(id => idMap.get(id.toLowerCase().replace(/[^a-z0-9_-]/g, '-')) || id);
    });
    if (parsed.timeline) {
      parsed.timeline.forEach(t => {
        if (t.sourceNodeId) {
          t.sourceNodeId = idMap.get(t.sourceNodeId.toLowerCase().replace(/[^a-z0-9_-]/g, '-')) || t.sourceNodeId;
        }
      });
    }

    // Calculate layout coordinates
    // If appending, find the rightmost X edge of existing nodes
    let baseX = 0;
    const baseY = 0;
    if (mode === 'append' && Array.isArray(existingNodes) && existingNodes.length > 0) {
      const maxX = Math.max(...existingNodes.map((n: { position?: { x: number } }) => n.position?.x || 0));
      baseX = maxX + 450;
    }

    // Counters for spatial cluster spacing
    let incidentCount = 0;
    let suspectCount = 0;
    let evidenceCount = 0;
    let locationCount = 0;
    let timelineCount = 0;

    const validatedNodeIds = new Set<string>();

    const generatedNodes = parsed.nodes.map((n) => {
      let x = 600;
      let y = 380;

      switch (n.cluster) {
        case 'center_incident':
          x = 550 + incidentCount * 280;
          y = 350 + (incidentCount % 2) * 50;
          incidentCount++;
          break;
        case 'left_suspects':
          x = 100 + (suspectCount % 2) * 230;
          y = 220 + Math.floor(suspectCount / 2) * 240;
          suspectCount++;
          break;
        case 'right_evidence':
          x = 940 + (evidenceCount % 2) * 240;
          y = 220 + Math.floor(evidenceCount / 2) * 240;
          evidenceCount++;
          break;
        case 'top_locations':
          x = 350 + (locationCount % 3) * 290;
          y = 80 + Math.floor(locationCount / 3) * 160;
          locationCount++;
          break;
        case 'bottom_timeline':
          x = 300 + (timelineCount % 3) * 320;
          y = 680 + Math.floor(timelineCount / 3) * 240;
          timelineCount++;
          break;
        default:
          x = 500 + Math.random() * 200;
          y = 400 + Math.random() * 200;
      }

      // Add gentle organic jitter so notes look hand-pinned
      const jitterX = Math.floor((Math.random() - 0.5) * 25);
      const jitterY = Math.floor((Math.random() - 0.5) * 25);

      const finalX = baseX + x + jitterX;
      const finalY = baseY + y + jitterY;

      const nodeId = n.id.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
      validatedNodeIds.add(nodeId);

      // Determine default colors if omitted
      let nodeColor = n.color;
      if (!nodeColor) {
        if (n.category === 'suspect') nodeColor = '#fca5a5';
        else if (n.category === 'alibi') nodeColor = '#bbf7d0';
        else if (n.category === 'location') nodeColor = '#99f6e4';
        else if (n.category === 'victim' || n.category === 'clue') nodeColor = '#bfdbfe';
        else nodeColor = '#fef3c7';
      }

      const formattedData: Record<string, unknown> = {
        color: nodeColor,
      };

      if (n.type === 'article') {
        formattedData.title = n.label;
        formattedData.description = n.description;
        formattedData.date = 'Case Evidence File';
      } else if (n.type === 'image') {
        formattedData.caption = `${n.label}: ${n.description}`;
        formattedData.src = '/placeholder-evidence.png';
      } else if (n.type === 'text') {
        formattedData.label = `${n.label} — ${n.description}`;
      } else if (n.type === 'link') {
        formattedData.label = n.label;
        formattedData.title = n.label;
        formattedData.description = n.description;
      } else {
        // sticky
        formattedData.label = `${n.label}\n\n${n.description}`;
      }

      return {
        id: nodeId,
        type: n.type,
        category: n.category,
        position: { x: finalX, y: finalY },
        data: formattedData,
      };
    });

    // Filter edges to ensure both source and target exist
    const generatedEdges = parsed.edges
      .filter((e) => {
        const source = e.sourceId.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
        const target = e.targetId.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
        return validatedNodeIds.has(source) && validatedNodeIds.has(target) && source !== target;
      })
      .map((e, idx) => {
        const source = e.sourceId.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
        const target = e.targetId.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
        return {
          id: `edge-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
          source,
          target,
          type: 'string',
          animated: false,
          label: e.label,
          data: { label: e.reasoning || e.label },
        };
      });

    const analysis: import('@/types/detective').AnalysisResult = {
      summary: parsed.summary,
      confidenceScore: parsed.confidenceScore,
      suggestedConnections: parsed.edges.map((e, idx) => ({
        id: `sugg-${idx}-${Date.now()}`,
        sourceNodeId: e.sourceId.toLowerCase().replace(/[^a-z0-9_-]/g, '-'),
        targetNodeId: e.targetId.toLowerCase().replace(/[^a-z0-9_-]/g, '-'),
        sourceLabel: generatedNodes.find(n => n.id === e.sourceId.toLowerCase().replace(/[^a-z0-9_-]/g, '-'))?.data.label?.toString().split('\n')[0] || e.sourceId,
        targetLabel: generatedNodes.find(n => n.id === e.targetId.toLowerCase().replace(/[^a-z0-9_-]/g, '-'))?.data.label?.toString().split('\n')[0] || e.targetId,
        reasoning: e.reasoning,
        confidence: e.confidence || 'medium',
        applied: true,
      })),
      gaps: parsed.nodes.filter(n => n.category === 'lead' || n.category === 'alibi').map((n, idx) => ({
        id: `gap-${idx}-${Date.now()}`,
        description: `Investigate: ${n.label}`,
        reasoning: n.description,
        suggestedType: n.type || 'sticky',
        urgency: (n.category === 'alibi' ? 'high' : 'medium') as 'low' | 'medium' | 'high',
      })),
      contradictions: parsed.edges
        .filter(e => e.label.toLowerCase().includes('contradict') || e.label.toLowerCase().includes('conflict'))
        .map((e, idx) => ({
          id: `contra-${idx}-${Date.now()}`,
          nodeIdA: e.sourceId.toLowerCase().replace(/[^a-z0-9_-]/g, '-'),
          nodeIdB: e.targetId.toLowerCase().replace(/[^a-z0-9_-]/g, '-'),
          nodeLabelA: generatedNodes.find(n => n.id === e.sourceId.toLowerCase().replace(/[^a-z0-9_-]/g, '-'))?.data.label?.toString().split('\n')[0] || e.sourceId,
          nodeLabelB: generatedNodes.find(n => n.id === e.targetId.toLowerCase().replace(/[^a-z0-9_-]/g, '-'))?.data.label?.toString().split('\n')[0] || e.targetId,
          description: e.reasoning,
        })),
      timeline: parsed.timeline && parsed.timeline.length > 0
        ? parsed.timeline.map((t, idx) => ({
            id: `tl-${idx}`,
            date: t.date,
            description: t.description,
            confidence: t.confidence,
            sourceNodeId: t.sourceNodeId ? t.sourceNodeId.toLowerCase().replace(/[^a-z0-9_-]/g, '-') : undefined,
          }))
        : parsed.nodes
            .filter(n => n.category === 'timeline' || n.type === 'article')
            .map((n, idx) => ({
              id: `tl-${idx}`,
              date: `Event #${idx + 1}`,
              description: n.description ? `${n.label}: ${n.description}` : n.label,
              confidence: 'confirmed' as const,
              sourceNodeId: n.id.toLowerCase().replace(/[^a-z0-9_-]/g, '-'),
            })),
      hypotheses: parsed.hypotheses.map(h => ({
        id: `hypo-${Math.random().toString(36).slice(2, 7)}`,
        title: h.title,
        summary: h.summary,
        confidence: h.confidence,
        supportingEvidence: h.supportingNodeIds,
        contradictingEvidence: h.contradictingNodeIds,
        missingEvidence: [],
      })),
      counterQuestions: parsed.counterQuestions.map((cq, idx) => ({
        id: `cq-${idx}-${Date.now()}`,
        ...cq,
      })),
      timestamp: Date.now(),
    };

    return NextResponse.json({
      caseTitle: parsed.caseTitle,
      summary: parsed.summary,
      nodes: generatedNodes,
      edges: generatedEdges,
      hypotheses: parsed.hypotheses,
      analysis,
    });
  } catch (error) {
    console.error('Generate Board API Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate investigation board';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
