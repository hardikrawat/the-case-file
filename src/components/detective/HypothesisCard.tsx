'use client';

import React from 'react';
import { Lightbulb, CheckCircle2, XCircle, Search } from 'lucide-react';
import type { Hypothesis } from '@/types/detective';

interface HypothesisCardProps {
  hypothesis: Hypothesis;
}

export default function HypothesisCard({ hypothesis }: HypothesisCardProps) {
  const confidenceColor = 
    hypothesis.confidence === 'strong' ? 'bg-green-100 text-green-700 border-green-200' :
    hypothesis.confidence === 'supported' ? 'bg-blue-100 text-blue-700 border-blue-200' :
    hypothesis.confidence === 'plausible' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
    'bg-red-100 text-red-700 border-red-200';

  return (
    <div className="p-4 bg-[var(--panel-background)] border border-[var(--panel-border)] rounded-lg shadow-sm space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h4 className="text-sm font-bold text-[var(--panel-foreground)] flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-yellow-500" />
            {hypothesis.title}
          </h4>
          <p className="text-xs text-gray-600">{hypothesis.summary}</p>
        </div>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase border flex-shrink-0 ${confidenceColor}`}>
          {hypothesis.confidence}
        </span>
      </div>

      <div className="space-y-3 pt-2 border-t border-[var(--panel-border)]">
        {hypothesis.supportingEvidence?.length > 0 && (
          <div>
            <h5 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-green-500" /> Supporting
            </h5>
            <ul className="text-xs text-gray-600 list-disc pl-4 space-y-0.5">
              {hypothesis.supportingEvidence.map((ev, i) => <li key={i}>{ev}</li>)}
            </ul>
          </div>
        )}

        {hypothesis.contradictingEvidence?.length > 0 && (
          <div>
            <h5 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
              <XCircle className="w-3 h-3 text-red-500" /> Contradicting
            </h5>
            <ul className="text-xs text-gray-600 list-disc pl-4 space-y-0.5">
              {hypothesis.contradictingEvidence.map((ev, i) => <li key={i}>{ev}</li>)}
            </ul>
          </div>
        )}

        {hypothesis.missingEvidence?.length > 0 && (
          <div>
            <h5 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Search className="w-3 h-3 text-blue-500" /> Missing Proof
            </h5>
            <ul className="text-xs text-gray-600 list-disc pl-4 space-y-0.5">
              {hypothesis.missingEvidence.map((ev, i) => <li key={i}>{ev}</li>)}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
