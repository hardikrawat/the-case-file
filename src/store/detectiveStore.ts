import { create } from 'zustand';
import type { AIProviderConfig, DetectiveMessage, AnalysisResult } from '@/types/detective';

interface DetectiveState {
  // Panel state
  isPanelOpen: boolean;
  panelMode: 'chat' | 'analysis' | 'config';
  
  // AI configuration
  aiConfig: AIProviderConfig | null;
  isConfigured: boolean;
  isConfigLoading: boolean;
  
  // Conversation
  messages: DetectiveMessage[];
  isStreaming: boolean;
  currentSessionId: string | null;
  
  // Analysis results
  lastAnalysis: AnalysisResult | null;
  isAnalyzing: boolean;
  
  // Actions
  togglePanel: () => void;
  openPanel: () => void;
  closePanel: () => void;
  setPanelMode: (mode: 'chat' | 'analysis' | 'config') => void;
  setAIConfig: (config: AIProviderConfig | null) => void;
  setConfigured: (configured: boolean) => void;
  setConfigLoading: (loading: boolean) => void;
  addMessage: (message: DetectiveMessage) => void;
  setMessages: (messages: DetectiveMessage[]) => void;
  setStreaming: (streaming: boolean) => void;
  setSessionId: (id: string | null) => void;
  setAnalysis: (analysis: AnalysisResult | null) => void;
  setAnalyzing: (analyzing: boolean) => void;
  clearConversation: () => void;
}

const useDetectiveStore = create<DetectiveState>()((set) => ({
  isPanelOpen: false,
  panelMode: 'chat',
  aiConfig: null,
  isConfigured: false,
  isConfigLoading: false,
  messages: [],
  isStreaming: false,
  currentSessionId: null,
  lastAnalysis: null,
  isAnalyzing: false,

  togglePanel: () => set((state) => ({ isPanelOpen: !state.isPanelOpen })),
  openPanel: () => set({ isPanelOpen: true }),
  closePanel: () => set({ isPanelOpen: false }),
  setPanelMode: (mode) => set({ panelMode: mode }),
  setAIConfig: (config) => set({ aiConfig: config }),
  setConfigured: (configured) => set({ isConfigured: configured }),
  setConfigLoading: (loading) => set({ isConfigLoading: loading }),
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  setMessages: (messages) => set({ messages }),
  setStreaming: (streaming) => set({ isStreaming: streaming }),
  setSessionId: (id) => set({ currentSessionId: id }),
  setAnalysis: (analysis) => set({ lastAnalysis: analysis }),
  setAnalyzing: (analyzing) => set({ isAnalyzing: analyzing }),
  clearConversation: () => set({ messages: [], currentSessionId: null }),
}));

export default useDetectiveStore;
