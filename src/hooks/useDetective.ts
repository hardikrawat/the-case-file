'use client';

import { useState, useEffect, useCallback } from 'react';
import useStore from '@/store/useStore';
import useDetectiveStore from '@/store/detectiveStore';
import type { DetectiveMessage } from '@/types/detective';

export function useDetective(boardId: string) {
  const { nodes, edges, boardTitle } = useStore();
  const store = useDetectiveStore();

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<DetectiveMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  // Sync with store messages if available
  useEffect(() => {
    if (store.messages.length > 0 && messages.length === 0) {
      setMessages(store.messages);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.messages]);

  useEffect(() => {
    const fetchConfig = async () => {
      store.setConfigLoading(true);
      try {
        const res = await fetch('/api/detective/config');
        if (res.ok) {
          const data = await res.json();
          if (data.config) {
            store.setAIConfig(data.config);
            store.setConfigured(true);
          } else {
            store.setConfigured(false);
          }
        } else {
          store.setConfigured(false);
        }
      } catch (err) {
        console.error('Failed to fetch AI config:', err);
        store.setConfigured(false);
      } finally {
        store.setConfigLoading(false);
      }
    };
    fetchConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;

    const userMsg: DetectiveMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    store.addMessage(userMsg);
    setInput('');
    setIsStreaming(true);

    const assistantMsgId = `assistant-${Date.now()}`;
    const assistantMsg: DetectiveMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    };

    setMessages([...newMessages, assistantMsg]);

    try {
      const response = await fetch('/api/detective/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          boardId,
          boardTitle,
          nodes,
          edges,
          messages: newMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: 'Failed to communicate with detective' }));
        throw new Error(errData.error || 'Chat request failed');
      }

      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulatedContent = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          accumulatedContent += chunk;

          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId ? { ...msg, content: accumulatedContent } : msg
            )
          );
        }

        const finalAssistantMsg: DetectiveMessage = {
          ...assistantMsg,
          content: accumulatedContent,
        };
        store.addMessage(finalAssistantMsg);
      }
    } catch (error) {
      console.error('Streaming chat error:', error);
      const errorMsg: DetectiveMessage = {
        ...assistantMsg,
        content: `Error: ${error instanceof Error ? error.message : 'Unable to connect with the Detective.'}`,
      };
      setMessages((prev) =>
        prev.map((msg) => (msg.id === assistantMsgId ? errorMsg : msg))
      );
      store.addMessage(errorMsg);
    } finally {
      setIsStreaming(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, isStreaming, boardId, boardTitle, nodes, edges]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (input.trim()) {
      sendMessage(input);
    }
  };

  const runAnalysis = async (type: string = 'full_scan') => {
    store.setAnalyzing(true);
    try {
      const res = await fetch('/api/detective/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boardId, boardTitle, nodes, edges, type }),
      });
      if (res.ok) {
        const data = await res.json();
        store.setAnalysis(data);
      }
    } catch (err) {
      console.error('Failed to run analysis:', err);
    } finally {
      store.setAnalyzing(false);
    }
  };

  return {
    isConfigured: store.isConfigured,
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isStreaming,
    analysis: store.lastAnalysis,
    isAnalyzing: store.isAnalyzing,
    runAnalysis,
    sendMessage,
    setMessages,
  };
}

