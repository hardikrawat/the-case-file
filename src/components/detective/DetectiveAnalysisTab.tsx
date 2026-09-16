'use client';

import React from 'react';
import { Loader2, Zap, AlertTriangle, FileQuestion } from 'lucide-react';
import { useDetective } from '@/hooks/useDetective';
import SuggestedConnectionCard from './SuggestedConnectionCard';
import CounterQuestionCard from './CounterQuestionCard';
import HypothesisCard from './HypothesisCard';

interface DetectiveAnalysisTabProps {
  boardId: string;
}

export default function DetectiveAnalysisTab({ boardId }: DetectiveAnalysisTabProps) {
  const { analysis, isAnalyzing, runAnalysis } = useDetective(boardId);

  return (
    <div className="flex flex-col h-full bg-[var(--panel-background)] overflow-y-auto">
      <div className="p-4 border-b border-[var(--panel-border)] sticky top-0 bg-[var(--panel-background)] z-10">
        <button
          onClick={() => runAnalysis('full')}
          disabled={isAnalyzing}
          className="w-full py-2.5 bg-[var(--sidebar-accent)] text-[var(--sidebar-accent-foreground)] rounded-md font-medium text-sm flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          {isAnalyzing ? 'Analyzing Board...' : 'Run Full Analysis'}
        </button>
      </div>

      <div className="p-4">
        {!analysis && !isAnalyzing && (
          <div className="text-center mt-10">
            <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-4 border border-gray-100">
              <Search className="w-8 h-8 text-gray-300" />
            </div>
            <h3 className="text-[var(--panel-foreground)] font-medium mb-2">No Analysis Yet</h3>
            <p className="text-sm text-gray-500">Run a full analysis to let the detective review all nodes, connections, and evidence on the board.</p>
          </div>
        )}

        {isAnalyzing && !analysis && (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--sidebar-accent)]" />
            <p className="text-sm text-gray-500">Reviewing evidence...</p>
          </div>
        )}

        {analysis && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Summary & Confidence */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[var(--panel-foreground)] tracking-wider">SUMMARY</h3>
                <span className={`text-xs font-bold px-2 py-1 rounded-md ${
                  analysis.confidenceScore > 75 ? 'bg-green-100 text-green-700' :
                  analysis.confidenceScore > 40 ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {analysis.confidenceScore}% CONFIDENCE
                </span>
              </div>
              <p className="text-sm text-[var(--panel-foreground)] leading-relaxed bg-gray-50 p-3 rounded-md border border-gray-100">
                {analysis.summary}
              </p>
            </section>

            {/* Hypotheses */}
            {analysis.hypotheses && analysis.hypotheses.length > 0 && (
              <section className="space-y-3">
                <h3 className="text-sm font-bold text-[var(--panel-foreground)] tracking-wider flex items-center gap-2">
                  <Lightbulb className="w-4 h-4" /> HYPOTHESES
                </h3>
                <div className="space-y-3">
                  {analysis.hypotheses.map((h, i) => (
                    <HypothesisCard key={i} hypothesis={h} />
                  ))}
                </div>
              </section>
            )}

            {/* Suggested Connections */}
            {analysis.suggestedConnections && analysis.suggestedConnections.length > 0 && (
              <section className="space-y-3">
                <h3 className="text-sm font-bold text-[var(--panel-foreground)] tracking-wider flex items-center gap-2">
                  <Link2 className="w-4 h-4" /> MISSING LINKS
                </h3>
                <div className="space-y-3">
                  {analysis.suggestedConnections.map((c, i) => (
                    <SuggestedConnectionCard 
                      key={i} 
                      connection={c} 
                      onApply={() => console.log('apply', c)}
                      onDismiss={() => console.log('dismiss', c)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Gaps & Contradictions */}
            {((analysis.gaps?.length ?? 0) > 0 || (analysis.contradictions?.length ?? 0) > 0) && (
              <section className="space-y-4">
                {analysis.gaps && analysis.gaps.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-bold text-[var(--panel-foreground)] tracking-wider flex items-center gap-2">
                      <FileQuestion className="w-4 h-4 text-orange-500" /> INFO GAPS
                    </h3>
                    <ul className="list-disc pl-5 text-sm text-gray-600 space-y-1">
                      {analysis.gaps.map((gap, i) => <li key={i}>{gap.description}</li>)}
                    </ul>
                  </div>
                )}
                {analysis.contradictions && analysis.contradictions.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-bold text-[var(--panel-foreground)] tracking-wider flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-500" /> CONTRADICTIONS
                    </h3>
                    <ul className="list-disc pl-5 text-sm text-gray-600 space-y-1">
                      {analysis.contradictions.map((c, i) => <li key={i}>{c.description}</li>)}
                    </ul>
                  </div>
                )}
              </section>
            )}

            {/* Counter Questions */}
            {analysis.counterQuestions && analysis.counterQuestions.length > 0 && (
              <section className="space-y-3 pb-8">
                <h3 className="text-sm font-bold text-[var(--panel-foreground)] tracking-wider">LINES OF INQUIRY</h3>
                <div className="space-y-3">
                  {analysis.counterQuestions.map((cq, i) => (
                    <CounterQuestionCard key={i} question={cq} onAnswer={() => console.log('focus chat')} />
                  ))}
                </div>
              </section>
            )}

          </div>
        )}
      </div>
    </div>
  );
}

import { Search, Lightbulb, Link2 } from 'lucide-react';
