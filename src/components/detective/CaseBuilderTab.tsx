'use client';

import React, { useState, useEffect } from 'react';
import {
  Wand2,
  Sparkles,
  Loader2,
  CheckCircle2,
  FileText,
  RotateCcw,
  Sliders,
  ChevronRight,
  Focus,
} from 'lucide-react';
import useStore from '@/store/useStore';
import useDetectiveStore from '@/store/detectiveStore';
import { useDetective } from '@/hooks/useDetective';
import type { BuilderState } from '@/types/detective';
import { toast } from 'sonner';

interface CaseBuilderTabProps {
  boardId: string;
}

const PRESET_CASES = [
  {
    title: 'Gardner Art Heist',
    icon: '🏛️',
    description: '13 priceless masterpieces stolen by thieves disguised as police officers.',
    statement: `On March 18, 1990, at approximately 1:24 AM, two men disguised in Boston Police uniforms buzzed the security entrance of the Isabella Stewart Gardner Museum. Night security guard Richard Abath violated museum protocol and unlocked the side entrance door to grant them entry. 

Once inside, the bogus police officers subdued Richard Abath and the second guard on duty, blindfolding them and duct-taping them to steam pipes in the museum basement. Over the course of 81 minutes, the thieves stripped and cut 13 works of art from their frames, including Rembrandt's "The Storm on the Sea of Galilee", Vermeer's "The Concert", and sketches by Degas, with an estimated total value exceeding $500 million.

Forensic examination revealed that the motion detectors in the museum's Macknight Room did not record any foot traffic, even though paintings were taken from that exact room. Earlier that evening, Richard Abath had inexplicably opened and closed a security door on the palace road, an anomaly he later claimed was routine. 

FBI investigations focused heavily on local Boston mobster Carmello Merlino, who bragged about brokering the return of the stolen Rembrandts, and Robert Gentile, a mob associate found in possession of a handwritten list of the stolen paintings with black-market prices. However, physical evidence yielded inconclusive DNA traces, no formal charges have ever been filed, and the artworks remain missing.`,
  },
  {
    title: 'Blackwood Manor Homicide',
    icon: '🕯️',
    description: 'Lord Blackwood found deceased in his locked study with conflicting alibis.',
    statement: `At 11:45 PM on November 12, Lord Reginald Blackwood was found dead inside his locked private study at Blackwood Manor. The cause of death was blunt force trauma to the back of the skull, accompanied by cyanide traces found in his half-finished glass of scotch. 

The heavy iron fire poker from the library hearth was missing and later recovered submerged in the estate's garden fountain. The study door was bolted from the inside, but the French terrace window was found unlatched with faint damp mud tracks leading toward the stables.

Three key individuals were present in the manor during the time of death:
1. Arthur Pendelton, the family attorney, who claims he was reviewing estate contracts in the guest wing between 10:30 PM and midnight. However, staff observed him near the cellar stairs around 11:15 PM.
2. Lady Eleanor Blackwood, the victim's estranged wife, who claims she was in her bedchambers. A freshly burned letter was found in her bedroom fireplace containing financial threats from Lord Blackwood regarding a modified will.
3. Julian Vance, the head groundskeeper, who was seen cleaning muddy boots in the carriage house at midnight. Vance claims he was checking the fence line after hearing barking dogs, but tire tracks matching his pickup truck were identified near the front gates.`,
  },
  {
    title: 'Cyber Heist & Extortion',
    icon: '💻',
    description: 'Encrypted trade secrets leaked alongside a 48-hour ransom demand.',
    statement: `On September 14 at 03:12 UTC, telemetry systems at NexaTech Aerospace alerted engineers to massive outbound data transfers from internal file servers. Approximately 4.2 terabytes of confidential propulsion schematics and defense satellite blueprints were exfiltrated to an offshore bulletproof host in Eastern Europe.

A ransom note signed by the threat group 'Chimera-Zero' was deposited on 24 internal domain controllers, demanding 80 Bitcoin ($4.8M) within 48 hours to prevent public auction of the proprietary schematics.

Incident response investigators discovered that access was gained using compromised VPN credentials belonging to senior systems architect David Kroll. Digital forensics revealed Kroll's account logged in from an IP address in Zurich at 02:45 UTC, while Kroll's physical badge registered his entry into the San Jose corporate campus at 02:50 UTC, demonstrating an impossible travel contradiction. Furthermore, internal firewall logs showed that an unapproved staging server inside the R&D lab had been created 72 hours prior using an admin bypass tool known to be circulating on dark web forums.`,
  },
];

const GENERATION_STEPS = [
  'Analyzing statement & forensic narrative...',
  'Extracting suspects, victims, locations & alibis...',
  'Mapping physical evidence & timeline events...',
  'Synthesizing cross-clue connections & contradictions...',
  'Computing spatial clusters & weaving red yarn...',
];

export default function CaseBuilderTab({ boardId }: CaseBuilderTabProps) {
  const { builderState, setBuilderState, saveSession } = useDetective(boardId);
  const [statement, setStatement] = useState(builderState?.statement || '');
  const [mode, setMode] = useState<'replace' | 'append'>(builderState?.mode || 'replace');
  const [density, setDensity] = useState<'balanced' | 'comprehensive'>(builderState?.density || 'balanced');
  const [stepIndex, setStepIndex] = useState(0);

  const { isConfigured, setPanelMode } = useDetectiveStore();
  const {
    isGeneratingBoard,
    setGeneratingBoard,
    lastGeneratedStats,
    setGeneratedStats,
  } = useDetectiveStore();

  const { nodes, edges, takeSnapshot, boardTitle, isPublic, parentId, setBoardMetadata, undo } = useStore();

  // Synchronize with loaded builderState from DB
  useEffect(() => {
    if (builderState) {
      if (builderState.statement && !statement) {
        setStatement(builderState.statement);
      }
      if (builderState.mode) {
        setMode(builderState.mode);
      }
      if (builderState.density) {
        setDensity(builderState.density);
      }
      if (builderState.lastGeneratedStats && !lastGeneratedStats) {
        setGeneratedStats(builderState.lastGeneratedStats);
      }
    }
  }, [builderState]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStatementChange = (val: string) => {
    setStatement(val);
    setBuilderState((prev) => ({
      ...(prev || { statement: '' }),
      statement: val,
    }));
  };

  const handleModeChange = (newMode: 'replace' | 'append') => {
    setMode(newMode);
    setBuilderState((prev) => ({
      ...(prev || { statement: '' }),
      mode: newMode,
    }));
  };

  const handleDensityChange = (newDensity: 'balanced' | 'comprehensive') => {
    setDensity(newDensity);
    setBuilderState((prev) => ({
      ...(prev || { statement: '' }),
      density: newDensity,
    }));
  };

  useEffect(() => {
    if (mode === 'append' && nodes.length === 0) {
      setMode('replace');
    }
  }, [nodes.length, mode]);

  // Cycle through generation steps for smooth feedback
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isGeneratingBoard) {
      setStepIndex(0);
      interval = setInterval(() => {
        setStepIndex((prev) => (prev < GENERATION_STEPS.length - 1 ? prev + 1 : prev));
      }, 1600);
    }
    return () => clearInterval(interval);
  }, [isGeneratingBoard]);

  const handleGenerate = async () => {
    if (!statement.trim() || isGeneratingBoard) return;

    if (statement.trim().length < 20) {
      toast.error('Please enter a more detailed narrative or police statement.');
      return;
    }

    // Confirm before replacing existing board content
    if (mode === 'replace' && nodes.length > 0) {
      const confirmed = window.confirm(
        `This will replace your existing board (${nodes.length} nodes, ${edges.length} connections). This can be undone. Continue?`
      );
      if (!confirmed) return;
    }

    setGeneratingBoard(true);
    setGeneratedStats(null);

    try {
      const response = await fetch('/api/detective/generate-board', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(300000), // 5-minute timeout
        body: JSON.stringify({
          statement,
          boardId,
          mode,
          density,
          existingNodes: mode === 'append' ? nodes : [],
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: 'Failed to generate board' }));
        throw new Error(errData.error || 'Board generation failed');
      }

      const data = await response.json();

      // Take undo snapshot
      takeSnapshot();

      const currentNodes = useStore.getState().nodes;
      const currentEdges = useStore.getState().edges;
      
      const finalNodes = mode === 'replace' ? data.nodes : [...currentNodes, ...data.nodes];
      const finalEdges = mode === 'replace' ? data.edges : [...currentEdges, ...data.edges];

      useStore.getState().setNodes(finalNodes);
      useStore.getState().setEdges(finalEdges);

      // Save directly to board API so changes are immediately persisted in DB
      try {
        const currentVersion = useStore.getState().boardVersion;
        const res = await fetch(`/api/boards/${boardId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: { nodes: finalNodes, edges: finalEdges },
            title: data.caseTitle || boardTitle,
            version: currentVersion,
          }),
        });
        
        if (res.ok) {
          const resData = await res.json();
          useStore.getState().setBoardVersion(resData.version);
        } else {
          console.warn('Failed to immediately auto-save generated board: Server returned', res.status);
        }
      } catch (saveErr) {
        console.warn('Failed to immediately auto-save generated board:', saveErr);
      }

      // Update case title if it's currently untitled
      if (!boardTitle || boardTitle === 'Untitled Case' || boardTitle === 'Untitled') {
        if (data.caseTitle) {
          setBoardMetadata(data.caseTitle, isPublic, parentId);
        }
      }

      // Construct and preserve comprehensive builder state
      const stats = {
        nodeCount: data.nodes.length,
        edgeCount: data.edges.length,
      };

      const newBuilderState: BuilderState = {
        statement,
        mode,
        density,
        lastGeneratedStats: stats,
        lastGeneratedAt: Date.now(),
        caseTitle: data.caseTitle || boardTitle,
        summary: data.summary,
        hypotheses: data.hypotheses,
        history: [
          {
            statement,
            caseTitle: data.caseTitle || boardTitle,
            timestamp: Date.now(),
            nodeCount: data.nodes.length,
            edgeCount: data.edges.length,
            mode,
            density,
          },
          ...(builderState?.history || []),
        ].slice(0, 10),
      };

      setBuilderState(newBuilderState);

      // Populate intelligence analysis in store
      if (data.analysis) {
        useDetectiveStore.getState().setAnalysis(data.analysis);
      }

      // Persist BOTH builderState and intelligence analysis to Turso DB session
      await saveSession({
        lastAnalysis: data.analysis || null,
        builderState: newBuilderState,
        boardSnapshot: {
          boardTitle: data.caseTitle || boardTitle,
          nodeCount: finalNodes.length,
          edgeCount: finalEdges.length,
        },
      });

      // Delay trigger camera fitView to smoothly fly to the new clues after they mount
      // Needs enough time for React Flow's ResizeObserver to measure 20+ nodes
      setTimeout(() => {
        useDetectiveStore.getState().triggerFitView();
      }, 600);

      // Highlight the main clues for 3.5 seconds so user immediately spots them!
      if (data.nodes && data.nodes.length > 0) {
        const clueIds = new Set<string>(data.nodes.slice(0, 3).map((n: { id: string }) => n.id));
        useDetectiveStore.getState().setHighlightedNodes(clueIds);
        setTimeout(() => useDetectiveStore.getState().clearHighlightedNodes(), 3500);
      }

      setGeneratedStats(stats);

      toast.success(
        `Case board constructed! Added ${data.nodes.length} clues and ${data.edges.length} connections.`
      );
    } catch (err) {
      console.error('Case Builder Error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to construct case board.');
    } finally {
      setGeneratingBoard(false);
    }
  };

  const handleLoadPreset = (presetText: string) => {
    handleStatementChange(presetText);
    toast.info('Example statement loaded. Click "Construct Case Board" to build!');
  };

  if (!isConfigured) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center space-y-4 text-[var(--panel-foreground)]">
        <div className="w-14 h-14 rounded-full bg-amber-500/10 flex items-center justify-center mb-1 text-amber-600">
          <Wand2 className="w-7 h-7" />
        </div>
        <h3 className="text-base font-bold">AI Setup Required</h3>
        <p className="text-xs text-gray-500 max-w-xs">
          Please configure your AI Provider & API Key in the Settings gear above before using the Agentic Case Builder.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[var(--panel-background)] overflow-y-auto p-4 space-y-5">
      {/* Intro Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-600" />
          <h3 className="text-sm font-bold tracking-wider text-[var(--panel-foreground)]">
            AGENTIC CASE BUILDER
          </h3>
        </div>
        <p className="text-xs text-gray-500 leading-relaxed">
          Paste any incident narrative, witness transcript, or police report. The detective will extract clues, suspects, alibis, and timeline events, and construct a full murder-board.
        </p>
      </div>

      {/* Preset Examples Carousel / Chips */}
      <div className="space-y-2">
        <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
          Quick Test Examples
        </label>
        <div className="grid grid-cols-1 gap-1.5">
          {PRESET_CASES.map((preset, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleLoadPreset(preset.statement)}
              disabled={isGeneratingBoard}
              className="flex items-center gap-2.5 p-2 rounded-lg border border-[var(--panel-border)] bg-black/[0.01] dark:bg-white/[0.01] hover:bg-amber-500/10 hover:border-amber-500/30 text-left transition-colors group"
            >
              <span className="text-base">{preset.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-[var(--panel-foreground)] group-hover:text-amber-700 dark:group-hover:text-amber-300 truncate">
                  {preset.title}
                </div>
                <div className="text-[11px] text-gray-500 truncate">
                  {preset.description}
                </div>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-amber-600 transition-colors" />
            </button>
          ))}
        </div>
      </div>

      {/* Active Dossier / Saved Case Snapshot */}
      {builderState?.summary && (
        <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 space-y-1.5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <span className="font-bold text-[10px] uppercase tracking-wider text-amber-700 dark:text-amber-400">
              Preserved Case Dossier
            </span>
            {builderState.lastGeneratedAt && (
              <span className="text-[10px] text-gray-400 font-mono">
                {new Date(builderState.lastGeneratedAt).toLocaleDateString()} {new Date(builderState.lastGeneratedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
          {builderState.caseTitle && (
            <div className="font-bold text-xs text-[var(--panel-foreground)]">
              {builderState.caseTitle}
            </div>
          )}
          <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-[11px]">
            {builderState.summary}
          </p>
          {builderState.statement && statement !== builderState.statement && (
            <button
              onClick={() => handleStatementChange(builderState.statement)}
              className="text-[10px] text-amber-600 hover:underline pt-0.5"
            >
              Restore original narrative into editor
            </button>
          )}
        </div>
      )}

      {/* Statement Input */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-amber-600" />
            Case Statement or Report
          </label>
          {statement && (
            <button
              onClick={() => handleStatementChange('')}
              disabled={isGeneratingBoard}
              className="text-[11px] text-gray-400 hover:text-red-500 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
        <textarea
          value={statement}
          onChange={(e) => handleStatementChange(e.target.value)}
          disabled={isGeneratingBoard}
          rows={7}
          placeholder="Paste crime narrative, witness interview, police dispatch log, or case summary here..."
          className="w-full p-3 rounded-lg border border-[var(--panel-border)] bg-transparent text-sm leading-relaxed text-[var(--panel-foreground)] placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-[var(--sidebar-accent)] resize-y min-h-[140px]"
        />
        <div className="flex justify-between items-center text-[11px] text-gray-400 px-0.5">
          <span>Min 20 characters</span>
          <span>{statement.length} characters</span>
        </div>
      </div>

      {/* Options: Mode & Density */}
      <div className="p-3 rounded-lg border border-[var(--panel-border)] bg-black/[0.01] dark:bg-white/[0.01] space-y-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--panel-foreground)]">
          <Sliders className="w-3.5 h-3.5 text-amber-600" /> Generation Settings
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Canvas Mode</span>
            <div className="flex rounded-md border border-[var(--panel-border)] overflow-hidden">
              <button
                type="button"
                onClick={() => handleModeChange('replace')}
                disabled={isGeneratingBoard}
                className={`flex-1 py-1.5 text-[11px] font-medium transition-colors ${
                  mode === 'replace'
                    ? 'bg-[var(--sidebar-accent)] text-[var(--sidebar-accent-foreground)]'
                    : 'text-gray-500 hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                Replace
              </button>
              <button
                type="button"
                onClick={() => handleModeChange('append')}
                disabled={isGeneratingBoard || nodes.length === 0}
                title={nodes.length === 0 ? 'No existing nodes to append to' : 'Add new evidence to the existing board'}
                className={`flex-1 py-1.5 text-[11px] font-medium transition-colors ${
                  mode === 'append'
                    ? 'bg-[var(--sidebar-accent)] text-[var(--sidebar-accent-foreground)]'
                    : 'text-gray-500 hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                Append
              </button>
            </div>
          </div>

          <div>
            <span className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Detail Level</span>
            <div className="flex rounded-md border border-[var(--panel-border)] overflow-hidden">
              <button
                type="button"
                onClick={() => handleDensityChange('balanced')}
                disabled={isGeneratingBoard}
                className={`flex-1 py-1.5 text-[11px] font-medium transition-colors ${
                  density === 'balanced'
                    ? 'bg-[var(--sidebar-accent)] text-[var(--sidebar-accent-foreground)]'
                    : 'text-gray-500 hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                Balanced
              </button>
              <button
                type="button"
                onClick={() => handleDensityChange('comprehensive')}
                disabled={isGeneratingBoard}
                className={`flex-1 py-1.5 text-[11px] font-medium transition-colors ${
                  density === 'comprehensive'
                    ? 'bg-[var(--sidebar-accent)] text-[var(--sidebar-accent-foreground)]'
                    : 'text-gray-500 hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                Detailed
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Action Button */}
      <div>
        <button
          onClick={handleGenerate}
          disabled={!statement.trim() || isGeneratingBoard}
          className="w-full py-3 px-4 rounded-lg bg-[var(--sidebar-accent)] text-[var(--sidebar-accent-foreground)] font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 shadow-md transition-all active:scale-[0.99]"
        >
          {isGeneratingBoard ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Building Case Board...</span>
            </>
          ) : (
            <>
              <Wand2 className="w-4 h-4" />
              <span>Construct Case Board</span>
            </>
          )}
        </button>
      </div>

      {/* Live Progress Feedback */}
      {isGeneratingBoard && (
        <div className="p-3.5 rounded-lg border border-amber-500/30 bg-amber-500/10 space-y-2 animate-in fade-in duration-300">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
            <span>Detective Agent at Work</span>
          </div>
          <div className="text-xs text-[var(--panel-foreground)] pl-5 font-mono">
            {GENERATION_STEPS[stepIndex]}
          </div>
        </div>
      )}

      {/* Post-Generation Success Box */}
      {lastGeneratedStats && !isGeneratingBoard && (
        <div className="p-3.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 space-y-2.5 animate-in fade-in duration-300">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Board Constructed Successfully!</span>
          </div>
          <p className="text-xs text-[var(--panel-foreground)] leading-relaxed">
            Populated <strong>{lastGeneratedStats.nodeCount} clues</strong> and woven <strong>{lastGeneratedStats.edgeCount} red yarn connections</strong>.
          </p>
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => useDetectiveStore.getState().triggerFitView()}
              className="py-1.5 px-2.5 rounded text-xs font-medium border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 transition-colors flex items-center justify-center gap-1"
              title="Frame camera to all clues"
            >
              <Focus className="w-3.5 h-3.5" />
              <span>Center Camera</span>
            </button>
            <button
              onClick={() => {
                undo();
                setGeneratedStats(null);
                toast.info('Board reverted to previous state.');
              }}
              className="py-1.5 px-2.5 rounded text-xs font-medium border border-red-500/40 text-red-600 dark:text-red-400 hover:bg-red-500/10 transition-colors flex items-center justify-center gap-1"
              title="Revert to the board state before generation"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Undo</span>
            </button>
            <button
              onClick={() => setPanelMode('intelligence')}
              className="flex-1 py-1.5 px-2 rounded text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1"
            >
              <span>View Intelligence Report</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
