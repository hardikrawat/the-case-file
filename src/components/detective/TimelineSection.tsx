import React from 'react';
import type { TimelineEvent } from '@/types/detective';

interface TimelineSectionProps {
  timeline: TimelineEvent[];
  onNodeClick?: (nodeId: string) => void;
}

export function TimelineSection({ timeline, onNodeClick }: TimelineSectionProps) {
  if (!timeline || timeline.length === 0) {
    return (
      <div className="p-4 text-center text-sm" style={{ color: 'var(--panel-foreground)' }}>
        No timeline events extracted
      </div>
    );
  }

  const getConfidenceColor = (confidence: TimelineEvent['confidence']) => {
    switch (confidence) {
      case 'confirmed': return 'text-emerald-600 bg-emerald-50 border-emerald-200';
      case 'estimated': return 'text-amber-600 bg-amber-50 border-amber-200';
      case 'speculative': return 'text-rose-600 bg-rose-50 border-rose-200';
      default: return 'text-slate-600 bg-slate-50 border-slate-200';
    }
  };

  return (
    <div className="flex flex-col space-y-4 relative">
      <div 
        className="absolute left-[11px] top-2 bottom-2 w-0.5" 
        style={{ backgroundColor: 'var(--panel-border)' }}
      />
      {timeline.map((event, i) => (
        <div key={i} className="relative pl-8">
          <div 
            className="absolute left-0 top-1.5 w-6 h-6 rounded-full border-2 flex items-center justify-center bg-white"
            style={{ borderColor: 'var(--sidebar-accent)' }}
          >
            <div 
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: 'var(--sidebar-accent)' }}
            />
          </div>
          
          <div 
            className="p-3 rounded-md border text-sm shadow-sm"
            style={{ 
              backgroundColor: 'var(--panel-background)',
              borderColor: 'var(--panel-border)',
              color: 'var(--panel-foreground)'
            }}
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <span className="font-bold">{event.date}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full border uppercase font-medium ${getConfidenceColor(event.confidence)}`}>
                {event.confidence}
              </span>
            </div>
            
            <p className="opacity-90">{event.description}</p>
            
            {event.sourceNodeId && (
              <button
                onClick={() => onNodeClick?.(event.sourceNodeId!)}
                className="mt-2 text-xs font-medium hover:underline flex items-center gap-1"
                style={{ color: 'var(--sidebar-accent)' }}
              >
                View on Board
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
