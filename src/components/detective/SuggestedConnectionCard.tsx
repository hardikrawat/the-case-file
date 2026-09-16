'use client';

import React from 'react';
import { ArrowRight, Check, X } from 'lucide-react';
import type { SuggestedConnection } from '@/types/detective';

interface SuggestedConnectionCardProps {
  connection: SuggestedConnection;
  onApply: () => void;
  onDismiss: () => void;
}

export default function SuggestedConnectionCard({ connection, onApply, onDismiss }: SuggestedConnectionCardProps) {
  const confidenceColor = 
    connection.confidence === 'high' ? 'bg-green-100 text-green-700 border-green-200' :
    connection.confidence === 'medium' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
    'bg-red-100 text-red-700 border-red-200';

  return (
    <div className="p-3 bg-[var(--panel-background)] border border-[var(--panel-border)] rounded-lg shadow-sm space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium text-[var(--panel-foreground)] truncate flex-1">
          <span className="truncate max-w-[120px]">{connection.sourceNodeId}</span>
          <ArrowRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <span className="truncate max-w-[120px]">{connection.targetNodeId}</span>
        </div>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase border ${confidenceColor}`}>
          {connection.confidence}
        </span>
      </div>
      
      <p className="text-xs text-gray-600 leading-relaxed">
        {connection.reasoning}
      </p>

      <div className="flex gap-2 pt-1">
        <button
          onClick={onApply}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-gray-100 hover:bg-green-50 hover:text-green-700 text-gray-700 text-xs font-medium rounded transition-colors"
        >
          <Check className="w-3.5 h-3.5" /> Apply
        </button>
        <button
          onClick={onDismiss}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-gray-100 hover:bg-red-50 hover:text-red-700 text-gray-700 text-xs font-medium rounded transition-colors"
        >
          <X className="w-3.5 h-3.5" /> Dismiss
        </button>
      </div>
    </div>
  );
}
