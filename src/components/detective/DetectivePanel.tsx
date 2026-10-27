'use client';

import React, { useState, useEffect } from 'react';
import { Brain, Search, BarChart3, Settings, X, Wand2 } from 'lucide-react';
import useDetectiveStore from '@/store/detectiveStore';
import DetectiveChatTab from './DetectiveChatTab';
import DetectiveAnalysisTab from './DetectiveAnalysisTab';
import DetectiveConfigTab from './DetectiveConfigTab';
import CaseBuilderTab from './CaseBuilderTab';

interface DetectivePanelProps {
  boardId: string;
}

export default function DetectivePanel({ boardId }: DetectivePanelProps) {
  const { isPanelOpen, panelMode, togglePanel, closePanel, setPanelMode, aiConfig } = useDetectiveStore();
  const [showConfig, setShowConfig] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'd') {
        e.preventDefault();
        togglePanel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePanel]);

  if (!isPanelOpen) {
    return (
      <button
        onClick={() => togglePanel()}
        className="fixed bottom-6 right-6 bg-[var(--sidebar-accent)] hover:opacity-80 text-[var(--sidebar-accent-foreground)] px-4 py-2 rounded-full shadow-lg font-medium transition-all z-[60] flex items-center gap-2"
      >
        <Brain className="w-5 h-5" />
        AI Detective
        <kbd className="ml-1 text-[10px] opacity-60 font-mono">⌘⇧D</kbd>
      </button>
    );
  }

  return (
    <div className="fixed top-0 right-0 h-full w-[420px] bg-[var(--panel-background)] border-l border-[var(--panel-border)] shadow-2xl z-[60] flex flex-col transition-transform duration-300 transform translate-x-0">
      <div className="flex items-center justify-between p-4 border-b border-[var(--panel-border)] bg-[var(--panel-background)]">
        <div className="flex items-center gap-2">
          <h2 className="font-bold text-lg tracking-wider text-[var(--panel-foreground)] flex items-center gap-2">
            <Brain className="w-5 h-5" />
            COMMAND CENTER
          </h2>
          {aiConfig && (
            <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-gray-400 border border-[var(--panel-border)]">
              {aiConfig.provider === 'ollama' ? 'Ollama' : aiConfig.provider}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowConfig(!showConfig)} 
            className={`p-1.5 rounded-md transition-colors ${showConfig ? 'bg-[var(--sidebar-accent)] text-[var(--sidebar-accent-foreground)]' : 'text-gray-500 hover:text-[var(--panel-foreground)] hover:bg-black/5 dark:hover:bg-white/5'}`}
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button onClick={closePanel} className="p-1.5 rounded-md text-gray-500 hover:text-[var(--panel-foreground)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex border-b border-[var(--panel-border)] bg-[var(--panel-background)]">
        <button
          onClick={() => {
            setPanelMode('investigate');
            setShowConfig(false);
          }}
          className={`flex-1 py-3 px-2 flex items-center justify-center gap-1.5 text-xs font-medium transition-colors ${
            panelMode === 'investigate' && !showConfig
              ? 'border-b-2 border-amber-500 text-amber-600 dark:text-amber-500'
              : 'text-gray-500 hover:text-[var(--panel-foreground)] border-b-2 border-transparent'
          }`}
        >
          <Search className="w-3.5 h-3.5" /> Investigate
        </button>
        <button
          onClick={() => {
            setPanelMode('intelligence');
            setShowConfig(false);
          }}
          className={`flex-1 py-3 px-2 flex items-center justify-center gap-1.5 text-xs font-medium transition-colors ${
            panelMode === 'intelligence' && !showConfig
              ? 'border-b-2 border-amber-500 text-amber-600 dark:text-amber-500'
              : 'text-gray-500 hover:text-[var(--panel-foreground)] border-b-2 border-transparent'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" /> Intelligence
        </button>
        <button
          onClick={() => {
            setPanelMode('builder');
            setShowConfig(false);
          }}
          className={`flex-1 py-3 px-2 flex items-center justify-center gap-1.5 text-xs font-medium transition-colors relative ${
            panelMode === 'builder' && !showConfig
              ? 'border-b-2 border-amber-500 text-amber-600 dark:text-amber-500'
              : 'text-gray-500 hover:text-[var(--panel-foreground)] border-b-2 border-transparent'
          }`}
        >
          <Wand2 className="w-3.5 h-3.5 text-amber-600" />
          <span>Builder</span>
          <span className="text-[9px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-700 dark:text-amber-300 px-1 py-0.2 rounded font-mono">
            AI
          </span>
        </button>
      </div>

      <div className="flex-1 overflow-hidden relative">
        {showConfig ? (
          <div className="absolute inset-0 bg-[var(--panel-background)] z-10 overflow-y-auto">
            <DetectiveConfigTab />
          </div>
        ) : (
          <>
            {panelMode === 'investigate' && <DetectiveChatTab boardId={boardId} />}
            {panelMode === 'intelligence' && <DetectiveAnalysisTab boardId={boardId} />}
            {panelMode === 'builder' && <CaseBuilderTab boardId={boardId} />}
          </>
        )}
      </div>
    </div>
  );
}
