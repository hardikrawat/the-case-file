import { tool } from 'ai';
import { z } from 'zod';

export const detectiveTools = {
  suggest_connection: tool({
    description: 'Suggest a logical connection between two pieces of evidence',
    inputSchema: z.object({
      sourceNodeId: z.string().describe('The ID of the source node'),
      targetNodeId: z.string().describe('The ID of the target node'),
      label: z.string().describe('A short label for the connection (e.g., "was seen at", "conflicts with")'),
      reasoning: z.string().describe('Detailed reasoning for why these nodes are connected'),
      confidence: z.enum(['low', 'medium', 'high']).describe('Confidence level of this connection')
    }),
    execute: async () => "I have recorded your tool call. However, the user cannot see tool calls. You MUST now output a detailed text response summarizing what you just did so the user can read it in the chat.", // Client-side processing
  }),

  flag_evidence: tool({
    description: 'Flag a specific node for attention (e.g., contradiction, critical clue)',
    inputSchema: z.object({
      nodeId: z.string().describe('The ID of the node to flag'),
      flagType: z.enum(['critical', 'contradiction', 'unverified', 'needs_review']),
      reasoning: z.string().describe('Why this evidence is being flagged')
    }),
    execute: async () => "I have recorded your tool call. However, the user cannot see tool calls. You MUST now output a detailed text response summarizing what you just did so the user can read it in the chat.",
  }),

  request_evidence: tool({
    description: 'Identify a specific gap in the investigation and request evidence to fill it',
    inputSchema: z.object({
      description: z.string().describe('Description of what information is missing'),
      reasoning: z.string().describe('Why this information is critical to the investigation'),
      suggestedType: z.enum(['sticky', 'text', 'image', 'article']).describe('What form the evidence might take'),
      urgency: z.enum(['low', 'medium', 'high'])
    }),
    execute: async () => "I have recorded your tool call. However, the user cannot see tool calls. You MUST now output a detailed text response summarizing what you just did so the user can read it in the chat.",
  }),

  generate_timeline: tool({
    description: 'Extract and order events into a timeline',
    inputSchema: z.object({
      events: z.array(z.object({
        date: z.string().describe('The date/time of the event'),
        description: z.string().describe('What happened'),
        sourceNodeId: z.string().optional().describe('The node ID providing this timeline event'),
        confidence: z.enum(['confirmed', 'estimated', 'speculative'])
      }))
    }),
    execute: async () => "I have recorded your tool call. However, the user cannot see tool calls. You MUST now output a detailed text response summarizing what you just did so the user can read it in the chat.",
  }),

  identify_cluster: tool({
    description: 'Group related evidence into a logical theme or cluster',
    inputSchema: z.object({
      theme: z.string().describe('The central theme of this cluster'),
      nodeIds: z.array(z.string()).describe('The IDs of the nodes in this cluster'),
      summary: z.string().describe('Summary of what this cluster reveals')
    }),
    execute: async () => "I have recorded your tool call. However, the user cannot see tool calls. You MUST now output a detailed text response summarizing what you just did so the user can read it in the chat.",
  }),

  generate_hypothesis: tool({
    description: 'Propose a hypothesis based on current evidence',
    inputSchema: z.object({
      title: z.string().describe('A short title for the hypothesis'),
      summary: z.string().describe('Detailed explanation of the hypothesis'),
      supportingEvidenceIds: z.array(z.string()).describe('Node IDs that support this hypothesis'),
      contradictingEvidenceIds: z.array(z.string()).describe('Node IDs that contradict this hypothesis'),
      confidence: z.enum(['speculative', 'plausible', 'supported', 'strong'])
    }),
    execute: async () => "I have recorded your tool call. However, the user cannot see tool calls. You MUST now output a detailed text response summarizing what you just did so the user can read it in the chat.",
  })
};
