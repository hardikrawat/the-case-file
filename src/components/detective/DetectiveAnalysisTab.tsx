'use client';

import React, { useState } from 'react';
import {
  Loader2,
  Zap,
  AlertTriangle,
  Search,
  Lightbulb,
  Link2,
  Clock,
  ChevronDown,
  ChevronRight,
  Target,
  PlusCircle,
  Eye,
  MessageSquare,
} from 'lucide-react';
import { toast } from 'sonner';
import { useDetective } from '@/hooks/useDetective';
import useStore from '@/store/useStore';
import useDetectiveStore from '@/store/detectiveStore';
import SuggestedConnectionCard from './SuggestedConnectionCard';
import CounterQuestionCard from './CounterQuestionCard';
import HypothesisCard from './HypothesisCard';
import { TimelineSection } from './TimelineSection';
import { CaseHealthMeter } from './CaseHealthMeter';
import { InvestigationLeadCard } from './InvestigationLeadCard';
import ExportReportButton from './ExportReportButton';
import type { SuggestedConnection, CounterQuestion, InformationGap } from '@/types/detective';
import { Edge } from 'reactflow';

interface IntelligenceReportTabProps {
  boardId: string;
}

// Collapsible section wrapper
function Section({
  title,
  icon: Icon,
  count,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon: React.ElementType;
  count?: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <section className="border border-[var(--panel-border)] rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2 text-sm font-bold tracking-wider text-[var(--panel-foreground)]">
          <Icon className="w-4 h-4 text-amber-600" />
          {title}
          {count !== undefined && count > 0 && (
            <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">
              {count}
            </span>
          )}
        </div>
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400" />
        )}
      </button>
      {isOpen && (
        <div className="p-3 pt-0 border-t border-[var(--panel-border)]">
          {children}
        </div>
      )}
    </section>
  );
}

export default function DetectiveAnalysisTab({ boardId }: IntelligenceReportTabProps) {
  const { analysis, isAnalyzing, runAnalysis, sendMessage, saveSession } = useDetective(boardId);
  const { nodes, edges, setEdges, setNodes, takeSnapshot, boardTitle } = useStore();
  const { setAnalysis, setPanelMode, setHighlightedNodes } = useDetectiveStore();
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const handleRunAnalysis = async (type: string) => {
    setAnalysisError(null);
    try {
      await runAnalysis(type);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Analysis failed';
      setAnalysisError(msg);
      toast.error(msg);
    }
  };

  const handleApplyConnection = (c: SuggestedConnection) => {
    takeSnapshot();
    const newEdge: Edge = {
      id: `edge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      source: c.sourceNodeId,
      target: c.targetNodeId,
      type: 'string',
      animated: false,
      data: { label: c.reasoning },
      label: c.sourceLabel && c.targetLabel
        ? `${c.sourceLabel} → ${c.targetLabel}`
        : undefined,
    };
    setEdges([...edges, newEdge]);

    if (analysis) {
      const updatedAnalysis = {
        ...analysis,
        suggestedConnections: analysis.suggestedConnections.map((conn) =>
          conn.id === c.id ? { ...conn, applied: true } : conn
        ),
      };
      setAnalysis(updatedAnalysis);
      saveSession({
        lastAnalysis: updatedAnalysis,
        boardSnapshot: {
          boardTitle,
          nodeCount: nodes.length,
          edgeCount: edges.length + 1,
        },
      });
    }
  };

  const handleDismissConnection = (c: SuggestedConnection) => {
    if (analysis) {
      const updatedAnalysis = {
        ...analysis,
        suggestedConnections: analysis.suggestedConnections.map((conn) =>
          conn.id === c.id ? { ...conn, dismissed: true } : conn
        ),
      };
      setAnalysis(updatedAnalysis);
      saveSession({
        lastAnalysis: updatedAnalysis,
        boardSnapshot: {
          boardTitle,
          nodeCount: nodes.length,
          edgeCount: edges.length,
        },
      });
    }
  };

  const handleAnswerQuestion = (q: CounterQuestion) => {
    setPanelMode('investigate');
    sendMessage(`I want to explore this line of inquiry: ${q.question}\n\nContext: ${q.context}`);
  };

  const handleNodeClick = (nodeId: string) => {
    // Highlight the node on canvas
    setHighlightedNodes(new Set([nodeId]));
    // Auto-clear after 4 seconds
    setTimeout(() => setHighlightedNodes(new Set()), 4000);
  };

  const handleAddLeadToBoard = (gap: InformationGap) => {
    takeSnapshot();
    const viewportCenterX = 400 + Math.random() * 200;
    const viewportCenterY = 300 + Math.random() * 200;

    const newNode = {
      id: `sticky-${Date.now()}`,
      type: 'sticky' as const,
      position: { x: viewportCenterX, y: viewportCenterY },
      data: {
        label: `🔍 ${gap.description}\n\n${gap.reasoning}`,
        color: '#fef3c7',
      },
    };
    setNodes([...nodes, newNode]);
  };

  const handleApplyAllHighConfidence = () => {
    if (!analysis) return;
    const highConfidence = analysis.suggestedConnections.filter(
      (c) => c.confidence === 'high' && !c.applied && !c.dismissed
    );
    if (highConfidence.length === 0) return;

    takeSnapshot();
    const newEdges = highConfidence.map((c) => ({
      id: `edge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      source: c.sourceNodeId,
      target: c.targetNodeId,
      type: 'string' as const,
      animated: false,
      data: { label: c.reasoning },
    }));
    setEdges([...edges, ...newEdges]);
    const updatedAnalysis = {
      ...analysis,
      suggestedConnections: analysis.suggestedConnections.map((conn) =>
        conn.confidence === 'high' && !conn.applied && !conn.dismissed
          ? { ...conn, applied: true }
          : conn
      ),
    };
    setAnalysis(updatedAnalysis);
    saveSession({
      lastAnalysis: updatedAnalysis,
      boardSnapshot: {
        boardTitle,
        nodeCount: nodes.length,
        edgeCount: edges.length + newEdges.length,
      },
    });
  };

  const activeConnections = analysis?.suggestedConnections?.filter(
    (c) => !c.applied && !c.dismissed
  ) || [];
  const highConfidenceCount = activeConnections.filter(
    (c) => c.confidence === 'high'
  ).length;

  return (
    <div className="flex flex-col h-full bg-[var(--panel-background)] overflow-y-auto">
      {/* Sticky Action Bar */}
      <div className="p-3 border-b border-[var(--panel-border)] sticky top-0 bg-[var(--panel-background)] z-10">
        <button
          onClick={() => handleRunAnalysis('full')}
          disabled={isAnalyzing}
          className="w-full py-2.5 bg-[var(--sidebar-accent)] text-[var(--sidebar-accent-foreground)] rounded-md font-medium text-sm flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          {isAnalyzing ? 'Scanning Board...' : 'Run Intelligence Scan'}
        </button>
        <div className="grid grid-cols-2 gap-1.5 mt-2">
          <button onClick={() => handleRunAnalysis('find_gaps')} disabled={isAnalyzing} className="py-1.5 text-xs font-medium rounded border border-[var(--panel-border)] hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors flex items-center justify-center gap-1">
            <Search className="w-3 h-3" /> Find Gaps
          </button>
          <button onClick={() => handleRunAnalysis('generate_timeline')} disabled={isAnalyzing} className="py-1.5 text-xs font-medium rounded border border-[var(--panel-border)] hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors flex items-center justify-center gap-1">
            <Clock className="w-3 h-3" /> Timeline
          </button>
          <button onClick={() => handleRunAnalysis('find_contradictions')} disabled={isAnalyzing} className="py-1.5 text-xs font-medium rounded border border-[var(--panel-border)] hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors flex items-center justify-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Contradictions
          </button>
          <button onClick={() => handleRunAnalysis('full_scan')} disabled={isAnalyzing} className="py-1.5 text-xs font-medium rounded border border-[var(--panel-border)] hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors flex items-center justify-center gap-1">
            <Zap className="w-3 h-3" /> Full Scan
          </button>
        </div>
      </div>

      <div className="p-3 space-y-3">
        {analysisError && (
          <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-md text-sm flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <p>{analysisError}</p>
          </div>
        )}

        {/* Empty state */}
        {!analysis && !isAnalyzing && !analysisError && (
          <div className="text-center mt-10">
            <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4 border border-amber-100">
              <Search className="w-8 h-8 text-amber-300" />
            </div>
            <h3 className="text-[var(--panel-foreground)] font-medium mb-2">No Intelligence Report</h3>
            <p className="text-sm text-gray-500">
              Run an intelligence scan to analyze all evidence, connections, and leads on the board.
            </p>
          </div>
        )}

        {/* Loading state */}
        {isAnalyzing && !analysis && (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--sidebar-accent)]" />
            <p className="text-sm text-gray-500">Generating intelligence report...</p>
          </div>
        )}

        {/* Results */}
        {analysis && (
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Case Health Meter */}
            <Section title="CASE HEALTH" icon={Target} defaultOpen={true}>
              <CaseHealthMeter score={analysis.confidenceScore} />
              <p className="text-sm text-[var(--panel-foreground)] leading-relaxed bg-amber-50/50 p-3 rounded-md border border-amber-100/50 mt-2">
                {analysis.summary}
              </p>
            </Section>

            {/* Export Report */}
            <div className="flex justify-end">
              <ExportReportButton analysis={analysis} boardTitle={boardTitle || 'Untitled Case'} />
            </div>

            {/* Evidence Timeline */}
            {analysis.timeline && analysis.timeline.length > 0 && (
              <Section title="EVIDENCE TIMELINE" icon={Clock} count={analysis.timeline.length}>
                <TimelineSection
                  timeline={analysis.timeline}
                  onNodeClick={handleNodeClick}
                />
              </Section>
            )}

            {/* Hypotheses */}
            {analysis.hypotheses && analysis.hypotheses.length > 0 && (
              <Section title="HYPOTHESES" icon={Lightbulb} count={analysis.hypotheses.length}>
                <div className="space-y-3">
                  {analysis.hypotheses.map((h, i) => (
                    <div key={i} className="group">
                      <HypothesisCard hypothesis={h} />
                      <div className="flex gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            setPanelMode('investigate');
                            sendMessage(`Investigate this hypothesis deeper: "${h.title}" — ${h.summary}`);
                          }}
                          className="flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors"
                        >
                          <MessageSquare className="w-3 h-3" /> Investigate
                        </button>
                        <button
                          onClick={() => {
                            takeSnapshot();
                            const newNode = {
                              id: `sticky-${Date.now()}`,
                              type: 'sticky' as const,
                              position: { x: 400 + Math.random() * 200, y: 300 + Math.random() * 200 },
                              data: {
                                label: `💡 ${h.title}\n\n${h.summary}\n\nConfidence: ${h.confidence}`,
                                color: '#fef3c7',
                              },
                            };
                            setNodes([...nodes, newNode]);
                          }}
                          className="flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
                        >
                          <PlusCircle className="w-3 h-3" /> Pin to Board
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Missing Links / Suggested Connections */}
            {activeConnections.length > 0 && (
              <Section title="MISSING LINKS" icon={Link2} count={activeConnections.length}>
                {highConfidenceCount > 0 && (
                  <button
                    onClick={handleApplyAllHighConfidence}
                    className="w-full mb-3 py-2 text-xs font-medium rounded-md border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Zap className="w-3 h-3" />
                    Apply All High-Confidence ({highConfidenceCount})
                  </button>
                )}
                <div className="space-y-3">
                  {activeConnections.map((c, i) => (
                    <SuggestedConnectionCard
                      key={c.id || i}
                      connection={c}
                      onApply={() => handleApplyConnection(c)}
                      onDismiss={() => handleDismissConnection(c)}
                    />
                  ))}
                </div>
              </Section>
            )}

            {/* Red Flags — Contradictions */}
            {analysis.contradictions && analysis.contradictions.length > 0 && (
              <Section title="RED FLAGS" icon={AlertTriangle} count={analysis.contradictions.length}>
                <div className="space-y-2">
                  {analysis.contradictions.map((c, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 p-3 rounded-md border border-red-200 bg-red-50/50"
                    >
                      <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[var(--panel-foreground)] font-medium">{c.description}</p>
                        <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                          <button
                            onClick={() => handleNodeClick(c.nodeIdA)}
                            className="underline hover:text-red-600 transition-colors"
                          >
                            {c.nodeLabelA || c.nodeIdA}
                          </button>
                          <span className="font-bold text-red-400">vs</span>
                          <button
                            onClick={() => handleNodeClick(c.nodeIdB)}
                            className="underline hover:text-red-600 transition-colors"
                          >
                            {c.nodeLabelB || c.nodeIdB}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Investigation Leads */}
            {analysis.gaps && analysis.gaps.length > 0 && (
              <Section title="INVESTIGATION LEADS" icon={Eye} count={analysis.gaps.length}>
                <div className="space-y-3">
                  {analysis.gaps.map((gap, i) => (
                    <InvestigationLeadCard
                      key={gap.id || i}
                      gap={gap}
                      onAddToBoard={() => handleAddLeadToBoard(gap)}
                    />
                  ))}
                </div>
              </Section>
            )}

            {/* Lines of Inquiry */}
            {analysis.counterQuestions && analysis.counterQuestions.length > 0 && (
              <Section title="LINES OF INQUIRY" icon={MessageSquare} count={analysis.counterQuestions.length} defaultOpen={false}>
                <div className="space-y-3">
                  {analysis.counterQuestions.map((cq, i) => (
                    <CounterQuestionCard key={i} question={cq} onAnswer={() => handleAnswerQuestion(cq)} />
                  ))}
                </div>
              </Section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
