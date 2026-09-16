'use client';

import React from 'react';
import { Brain, Search, Settings, MessageSquare, X } from 'lucide-react';
import useDetectiveStore from '@/store/detectiveStore';
import DetectiveChatTab from './DetectiveChatTab';
import DetectiveAnalysisTab from './DetectiveAnalysisTab';
import DetectiveConfigTab from './DetectiveConfigTab';

interface DetectivePanelProps {
  boardId: string;
}

export default function DetectivePanel({ boardId }: DetectivePanelProps) {
  const { isPanelOpen, panelMode, togglePanel, closePanel, setPanelMode } = useDetectiveStore();

  if (!isPanelOpen) {
    return (
      <button
        onClick={togglePanel}
        className="fixed bottom-6 right-6 bg-[var(--sidebar-accent)] hover:opacity-80 text-[var(--sidebar-accent-foreground)] px-4 py-2 rounded-full shadow-lg font-medium transition-all z-[60] flex items-center gap-2"
      >
        <Brain className="w-5 h-5" />
        AI Detective
      </button>
    );
  }

  return (
    <div className="fixed top-0 right-0 h-full w-[420px] bg-[var(--panel-background)] border-l border-[var(--panel-border)] shadow-2xl z-[60] flex flex-col transition-transform duration-300 transform translate-x-0">
      <div className="flex items-center justify-between p-4 border-b border-[var(--panel-border)] bg-[var(--panel-background)]">
        <h2 className="font-bold text-lg tracking-wider text-[var(--panel-foreground)] flex items-center gap-2">
          <Brain className="w-5 h-5" />
          AI DETECTIVE
        </h2>
        <button onClick={closePanel} className="text-gray-500 hover:text-[var(--panel-foreground)] transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex border-b border-[var(--panel-border)] bg-[var(--panel-background)]">
        <button
          onClick={() => setPanelMode('chat')}
          className={`flex-1 py-3 px-4 flex items-center justify-center gap-2 text-sm font-medium transition-colors ${
            panelMode === 'chat'
              ? 'border-b-2 border-[var(--sidebar-accent)] text-[var(--sidebar-accent)]'
              : 'text-gray-500 hover:text-[var(--panel-foreground)]'
          }`}
        >
          <MessageSquare className="w-4 h-4" /> Chat
        </button>
        <button
          onClick={() => setPanelMode('analysis')}
          className={`flex-1 py-3 px-4 flex items-center justify-center gap-2 text-sm font-medium transition-colors ${
            panelMode === 'analysis'
              ? 'border-b-2 border-[var(--sidebar-accent)] text-[var(--sidebar-accent)]'
              : 'text-gray-500 hover:text-[var(--panel-foreground)]'
          }`}
        >
          <Search className="w-4 h-4" /> Analysis
        </button>
        <button
          onClick={() => setPanelMode('config')}
          className={`flex-1 py-3 px-4 flex items-center justify-center gap-2 text-sm font-medium transition-colors ${
            panelMode === 'config'
              ? 'border-b-2 border-[var(--sidebar-accent)] text-[var(--sidebar-accent)]'
              : 'text-gray-500 hover:text-[var(--panel-foreground)]'
          }`}
        >
          <Settings className="w-4 h-4" /> Config
        </button>
      </div>

      <div className="flex-1 overflow-hidden relative">
        {panelMode === 'chat' && <DetectiveChatTab boardId={boardId} />}
        {panelMode === 'analysis' && <DetectiveAnalysisTab boardId={boardId} />}
        {panelMode === 'config' && <DetectiveConfigTab />}
      </div>
    </div>
  );
}
