'use client';

import React from 'react';
import { MessageCircle, AlertCircle } from 'lucide-react';
import type { CounterQuestion } from '@/types/detective';

interface CounterQuestionCardProps {
  question: CounterQuestion;
  onAnswer: () => void;
}

export default function CounterQuestionCard({ question, onAnswer }: CounterQuestionCardProps) {
  const urgencyColor = 
    question.urgency === 'high' ? 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-100 dark:border-red-800' :
    question.urgency === 'medium' ? 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border-orange-100 dark:border-orange-800' :
    'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-100 dark:border-blue-800';

  return (
    <div className={`p-3 border rounded-lg shadow-sm space-y-2 ${urgencyColor}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold leading-tight">
          {question.question}
        </p>
        <AlertCircle className="w-4 h-4 flex-shrink-0 opacity-70 mt-0.5" />
      </div>
      
      <p className="text-xs opacity-80 leading-relaxed">
        {question.context}
      </p>

      <div className="pt-2">
        <button
          onClick={onAnswer}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-white/60 dark:bg-white/10 hover:bg-white dark:hover:bg-white/20 text-xs font-medium rounded-md transition-colors shadow-sm"
        >
          <MessageCircle className="w-3.5 h-3.5" /> Answer
        </button>
      </div>
    </div>
  );
}
