// Provider types
export type AIProviderType = 'openai' | 'anthropic' | 'google' | 'ollama';

export interface AIProviderConfig {
  provider: AIProviderType;
  modelId: string;
  apiKey?: string;
  baseUrl?: string; // For Ollama custom endpoint
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: AIProviderType;
  description?: string;
}

// Detective message types
export interface DetectiveMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  toolInvocations?: ToolInvocation[];
}

export interface ToolInvocation {
  toolName: string;
  args: Record<string, unknown>;
  result?: unknown;
  state: 'pending' | 'result';
}

// Analysis types
export interface SuggestedConnection {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceLabel: string;
  targetLabel: string;
  reasoning: string;
  confidence: 'low' | 'medium' | 'high';
  applied?: boolean;
  dismissed?: boolean;
}

export interface InformationGap {
  id: string;
  description: string;
  reasoning: string;
  suggestedType: 'sticky' | 'text' | 'image' | 'article';
  urgency: 'low' | 'medium' | 'high';
}

export interface Contradiction {
  id: string;
  nodeIdA: string;
  nodeLabelA: string;
  nodeIdB: string;
  nodeLabelB: string;
  description: string;
}

export interface TimelineEvent {
  date: string;
  description: string;
  sourceNodeId?: string;
  confidence: 'confirmed' | 'estimated' | 'speculative';
}

export interface Hypothesis {
  id: string;
  title: string;
  summary: string;
  supportingEvidence: string[]; // node IDs
  contradictingEvidence: string[];
  missingEvidence: string[]; // descriptions
  confidence: 'speculative' | 'plausible' | 'supported' | 'strong';
}

export interface CounterQuestion {
  id: string;
  question: string;
  context: string;
  urgency: 'low' | 'medium' | 'high';
}

export interface AnalysisResult {
  summary: string;
  suggestedConnections: SuggestedConnection[];
  gaps: InformationGap[];
  contradictions: Contradiction[];
  timeline: TimelineEvent[];
  hypotheses: Hypothesis[];
  counterQuestions: CounterQuestion[];
  confidenceScore: number; // 0-100
  timestamp: number;
}

export interface DetectiveSession {
  id: string;
  boardId: string;
  messages: DetectiveMessage[];
  createdAt: number;
  updatedAt: number;
}
