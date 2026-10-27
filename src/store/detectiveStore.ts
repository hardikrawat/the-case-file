import { create } from 'zustand';
import type { AIProviderConfig, DetectiveMessage, AnalysisResult, BuilderState } from '@/types/detective';

interface DetectiveState {
  // Panel state
  isPanelOpen: boolean;
  panelMode: 'investigate' | 'intelligence' | 'builder';
  
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
  analysisHistory: import('@/types/detective').AnalysisResult[];
  analysisError: string | null;
  pushAnalysisHistory: (analysis: import('@/types/detective').AnalysisResult) => void;
  setAnalysisError: (error: string | null) => void;

  // Board Builder state
  isGeneratingBoard: boolean;
  generationStep: string;
  lastGeneratedStats: { nodeCount: number; edgeCount: number } | null;
  builderState: BuilderState | null;
  setBuilderState: (builderState: BuilderState | null | ((prev: BuilderState | null) => BuilderState | null)) => void;
  
  // Canvas overlay state
  highlightedNodes: Set<string>;
  ghostEdges: Array<{ source: string; target: string; label?: string }>;
  
  // Actions
  togglePanel: (mode?: 'investigate' | 'intelligence' | 'builder') => void;
  openPanel: (mode?: 'investigate' | 'intelligence' | 'builder') => void;
  closePanel: () => void;
  setPanelMode: (mode: 'investigate' | 'intelligence' | 'builder') => void;
  setAIConfig: (config: AIProviderConfig | null) => void;
  setConfigured: (configured: boolean) => void;
  setConfigLoading: (loading: boolean) => void;
  addMessage: (message: DetectiveMessage) => void;
  setMessages: (messages: DetectiveMessage[] | ((prev: DetectiveMessage[]) => DetectiveMessage[])) => void;
  setStreaming: (streaming: boolean) => void;
  setSessionId: (id: string | null) => void;
  setAnalysis: (analysis: AnalysisResult | null) => void;
  setAnalyzing: (analyzing: boolean) => void;
  setGeneratingBoard: (generating: boolean) => void;
  setGenerationStep: (step: string) => void;
  setGeneratedStats: (stats: { nodeCount: number; edgeCount: number } | null) => void;
  clearConversation: () => void;
  resetDetectiveSession: (newBoardId?: string | null) => void;
  setHighlightedNodes: (ids: Set<string>) => void;
  clearHighlightedNodes: () => void;
  setGhostEdges: (edges: Array<{ source: string; target: string; label?: string }>) => void;
  clearGhostEdges: () => void;
  fitViewTrigger: number;
  triggerFitView: () => void;
  loadedBoardId: string | null;
  setLoadedBoardId: (id: string | null) => void;
}

const useDetectiveStore = create<DetectiveState>()((set) => ({
  isPanelOpen: false,
  panelMode: 'investigate',
  aiConfig: null,
  isConfigured: false,
  isConfigLoading: false,
  messages: [],
  isStreaming: false,
  currentSessionId: null,
  lastAnalysis: null,
  isAnalyzing: false,
  analysisHistory: [],
  analysisError: null,
  isGeneratingBoard: false,
  generationStep: '',
  lastGeneratedStats: null,
  builderState: null,
  highlightedNodes: new Set(),
  ghostEdges: [],

  setBuilderState: (builderState) => set((state) => ({
    builderState: typeof builderState === 'function' ? builderState(state.builderState) : builderState
  })),

  togglePanel: (mode) => set((state) => {
    const nextOpen = !state.isPanelOpen;
    const targetMode = typeof mode === 'string' ? mode : 'investigate';
    return {
      isPanelOpen: nextOpen,
      ...(nextOpen ? { panelMode: targetMode } : {})
    };
  }),
  openPanel: (mode) => {
    const targetMode = typeof mode === 'string' ? mode : 'investigate';
    set({ isPanelOpen: true, panelMode: targetMode });
  },
  closePanel: () => set({ isPanelOpen: false }),
  setPanelMode: (mode) => set({ panelMode: mode }),
  setAIConfig: (config) => set({ aiConfig: config }),
  setConfigured: (configured) => set({ isConfigured: configured }),
  setConfigLoading: (loading) => set({ isConfigLoading: loading }),
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  setMessages: (messages) => set((state) => ({ 
    messages: typeof messages === 'function' ? messages(state.messages) : messages 
  })),
  setStreaming: (streaming) => set({ isStreaming: streaming }),
  setSessionId: (id) => set({ currentSessionId: id }),
  setAnalysis: (analysis) => set((state) => ({
    lastAnalysis: analysis,
    ...(analysis ? { analysisHistory: [analysis, ...state.analysisHistory].slice(0, 20) } : {})
  })),
  pushAnalysisHistory: (analysis) => set((state) => ({
    analysisHistory: [analysis, ...state.analysisHistory].slice(0, 20)
  })),
  setAnalysisError: (error) => set({ analysisError: error }),
  setAnalyzing: (analyzing) => set({ isAnalyzing: analyzing }),
  setGeneratingBoard: (generating) => set({ isGeneratingBoard: generating }),
  setGenerationStep: (step) => set({ generationStep: step }),
  setGeneratedStats: (stats) => set({ lastGeneratedStats: stats }),
  clearConversation: () => set({ messages: [], currentSessionId: null }),
  resetDetectiveSession: (newBoardId = null) => set((state) => {
    if (
      state.loadedBoardId === newBoardId &&
      state.currentSessionId === null &&
      state.messages.length === 0 &&
      state.lastAnalysis === null &&
      state.analysisHistory.length === 0 &&
      state.analysisError === null &&
      state.builderState === null &&
      state.lastGeneratedStats === null &&
      !state.isGeneratingBoard &&
      state.generationStep === '' &&
      state.highlightedNodes.size === 0 &&
      state.ghostEdges.length === 0
    ) {
      return state;
    }
    return {
      currentSessionId: null,
      messages: state.messages.length === 0 ? state.messages : [],
      lastAnalysis: null,
      analysisHistory: state.analysisHistory.length === 0 ? state.analysisHistory : [],
      analysisError: null,
      builderState: null,
      lastGeneratedStats: null,
      isGeneratingBoard: false,
      generationStep: '',
      highlightedNodes: state.highlightedNodes.size === 0 ? state.highlightedNodes : new Set(),
      ghostEdges: state.ghostEdges.length === 0 ? state.ghostEdges : [],
      loadedBoardId: newBoardId,
    };
  }),
  setHighlightedNodes: (ids) => set({ highlightedNodes: ids }),
  clearHighlightedNodes: () => set({ highlightedNodes: new Set() }),
  setGhostEdges: (edges) => set({ ghostEdges: edges }),
  clearGhostEdges: () => set({ ghostEdges: [] }),
  fitViewTrigger: 0,
  triggerFitView: () => set((state) => ({ fitViewTrigger: state.fitViewTrigger + 1 })),
  loadedBoardId: null,
  setLoadedBoardId: (id) => set({ loadedBoardId: id }),
}));

export default useDetectiveStore;
