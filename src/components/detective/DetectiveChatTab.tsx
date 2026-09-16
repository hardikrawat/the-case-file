'use client';

import React, { useRef, useEffect } from 'react';
import { Send, Loader2, Search, HelpCircle, FileSearch } from 'lucide-react';
import { useDetective } from '@/hooks/useDetective';
import useDetectiveStore from '@/store/detectiveStore';

interface DetectiveChatTabProps {
  boardId: string;
}

export default function DetectiveChatTab({ boardId }: DetectiveChatTabProps) {
  const { isConfigured, messages, input, handleInputChange, handleSubmit, isStreaming, sendMessage } = useDetective(boardId);
  const { setPanelMode } = useDetectiveStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  if (!isConfigured) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center space-y-4 text-[var(--panel-foreground)]">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-2">
          <Settings className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-xl font-bold">AI Not Configured</h3>
        <p className="text-sm text-gray-500">
          Please configure your AI provider settings to start investigating with the AI Detective.
        </p>
        <button
          onClick={() => setPanelMode('config')}
          className="mt-4 px-6 py-2 bg-[var(--sidebar-accent)] text-[var(--sidebar-accent-foreground)] rounded-md font-medium hover:opacity-90 transition-opacity"
        >
          Go to Configuration
        </button>
      </div>
    );
  }

  const handleQuickAction = (text: string) => {
    sendMessage(text);
  };

  return (
    <div className="flex flex-col h-full bg-[var(--panel-background)]">
      <div className="flex gap-2 p-3 border-b border-[var(--panel-border)] overflow-x-auto no-scrollbar">
        <button onClick={() => handleQuickAction("Scan the board and summarize the current state.")} className="whitespace-nowrap flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-gray-100 hover:bg-gray-200 text-gray-800 transition-colors">
          <Search className="w-3.5 h-3.5" /> Scan Board
        </button>
        <button onClick={() => handleQuickAction("Find gaps or contradictions in my current evidence.")} className="whitespace-nowrap flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-gray-100 hover:bg-gray-200 text-gray-800 transition-colors">
          <FileSearch className="w-3.5 h-3.5" /> Find Gaps
        </button>
        <button onClick={() => handleQuickAction("What am I missing? Provide 3 counter-questions.")} className="whitespace-nowrap flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-gray-100 hover:bg-gray-200 text-gray-800 transition-colors">
          <HelpCircle className="w-3.5 h-3.5" /> What am I Missing?
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-sm text-gray-500 mt-10">
            I am ready to analyze the evidence. How can I assist you in this investigation?
          </div>
        ) : (
          messages.map((m, idx) => (
            <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-lg p-3 text-sm ${
                  m.role === 'user'
                    ? 'bg-[var(--sidebar-accent)]/20 text-[var(--panel-foreground)] rounded-tr-none'
                    : 'bg-[var(--panel-background)] border border-[var(--panel-border)] text-[var(--panel-foreground)] rounded-tl-none'
                }`}
              >
                {/* Note: tool invocations could be rendered here if 'm.toolInvocations' exists */}
                <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
                
                {m.toolInvocations && m.toolInvocations.map((tool, tIdx) => (
                  <div key={tIdx} className="mt-2 p-2 bg-gray-50 rounded text-xs border border-gray-200 text-gray-600">
                    <span className="font-semibold">{tool.toolName}</span> processing...
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
        {isStreaming && (
          <div className="flex justify-start">
            <div className="bg-[var(--panel-background)] border border-[var(--panel-border)] text-gray-500 rounded-lg rounded-tl-none p-3 text-sm flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Analyzing...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-[var(--panel-border)] bg-[var(--panel-background)]">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <textarea
            value={input}
            onChange={handleInputChange}
            placeholder="Type your instruction or question..."
            className="flex-1 resize-none h-[42px] max-h-32 min-h-[42px] p-2.5 bg-transparent border border-[var(--panel-border)] rounded-md focus:outline-none focus:ring-1 focus:ring-[var(--sidebar-accent)] text-sm text-[var(--panel-foreground)]"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e as unknown as React.FormEvent);
              }
            }}
          />
          <button
            type="submit"
            disabled={!input.trim() || isStreaming}
            className="h-[42px] w-[42px] flex items-center justify-center bg-[var(--sidebar-accent)] text-[var(--sidebar-accent-foreground)] rounded-md hover:opacity-90 disabled:opacity-50 transition-opacity flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

// Ensure Settings icon works in fallback
import { Settings } from 'lucide-react';
