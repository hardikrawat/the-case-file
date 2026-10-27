import React from 'react';
import type { InformationGap } from '@/types/detective';
import { PlusCircle, Tag } from 'lucide-react';

interface InvestigationLeadCardProps {
  gap: InformationGap;
  onAddToBoard: (gap: InformationGap) => void;
}

export function InvestigationLeadCard({ gap, onAddToBoard }: InvestigationLeadCardProps) {
  const getUrgencyColor = (urgency: InformationGap['urgency']) => {
    switch (urgency) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#3b82f6';
      default: return '#94a3b8';
    }
  };

  return (
    <div 
      className="rounded-md border p-4 flex flex-col gap-3 relative overflow-hidden shadow-sm"
      style={{ 
        backgroundColor: 'var(--panel-background)',
        borderColor: 'var(--panel-border)',
        color: 'var(--panel-foreground)'
      }}
    >
      <div 
        className="absolute left-0 top-0 bottom-0 w-1"
        style={{ backgroundColor: getUrgencyColor(gap.urgency) }}
      />
      
      <div className="pl-2">
        <h4 className="font-semibold text-sm mb-1">{gap.description}</h4>
        <p className="text-xs opacity-80 mb-3">{gap.reasoning}</p>
        
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider opacity-60 border px-2 py-0.5 rounded-sm">
            <Tag size={10} />
            <span>{gap.suggestedType}</span>
          </div>
          
          <button
            onClick={() => onAddToBoard(gap)}
            className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-md hover:opacity-80 transition-opacity"
            style={{ 
              backgroundColor: 'var(--sidebar-accent)',
              color: 'var(--sidebar-accent-foreground)'
            }}
          >
            <PlusCircle size={14} />
            Add to Board
          </button>
        </div>
      </div>
    </div>
  );
}
