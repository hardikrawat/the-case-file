'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import useStore from '@/store/useStore';
import useDetectiveStore from '@/store/detectiveStore';
import type { DetectiveMessage, AnalysisResult, BuilderState } from '@/types/detective';

export function useDetective(boardId: string) {
  const { nodes, edges, boardTitle } = useStore();
  const store = useDetectiveStore();

  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  
  const messages = store.messages;
  const sessionId = store.currentSessionId;
  const sessionIdRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  const saveSession = useCallback(async (payload: {
    messages?: DetectiveMessage[];
    lastAnalysis?: AnalysisResult | null;
    builderState?: BuilderState | null;
    boardSnapshot?: Record<string, unknown>;
  }) => {
    if (!boardId) return false;
    try {
      const res = await fetch('/api/detective/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          boardId,
          sessionId: sessionIdRef.current || undefined,
          ...payload,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.session?.id) {
          sessionIdRef.current = data.session.id;
          store.setSessionId(data.session.id);
        }
        return true;
      }
    } catch (err) {
      console.error('Failed to save detective session:', err);
    }
    return false;
  }, [boardId, store]);

  // Load session history when boardId changes
  useEffect(() => {
    if (!boardId) return;
    if (store.loadedBoardId === boardId) return; // Already loaded for this board

    let isMounted = true;
    const fetchSessionHistory = async () => {
      setIsLoadingHistory(true);
      try {
        const res = await fetch(`/api/detective/sessions?boardId=${boardId}`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            if (data.sessions && data.sessions.length > 0) {
              const latest = data.sessions[0];
              const loadedMsgs = (latest.messages || []) as DetectiveMessage[];
              store.setSessionId(latest.id);
              store.setMessages(loadedMsgs);
              if (latest.lastAnalysis) {
                store.setAnalysis(latest.lastAnalysis);
              } else {
                store.setAnalysis(null);
              }
              if (latest.builderState) {
                store.setBuilderState(latest.builderState);
              } else {
                store.setBuilderState(null);
              }
            } else {
              store.setSessionId(null);
              store.setMessages([]);
              store.setAnalysis(null);
              store.setBuilderState(null);
            }
            store.setLoadedBoardId(boardId);
          }
        }
      } catch (err) {
        console.error('Failed to load detective session history:', err);
      } finally {
        if (isMounted) {
          setIsLoadingHistory(false);
        }
      }
    };

    fetchSessionHistory();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId]);

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
    store.setMessages(newMessages);
    setInput('');
    setIsStreaming(true);

    const assistantMsgId = `assistant-${Date.now()}`;
    const assistantMsg: DetectiveMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    };

    store.setMessages([...newMessages, assistantMsg]);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/detective/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortControllerRef.current.signal,
        body: JSON.stringify({
          boardId,
          boardTitle,
          nodes,
          edges,
          messages: newMessages
            .filter((m) => m.content && m.content.trim())
            .map((m) => ({
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

          store.setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId ? { ...msg, content: accumulatedContent } : msg
            )
          );
        }

        if (!accumulatedContent.trim()) {
          throw new Error('No response was generated by the AI model. Please check that your model name and API key are valid in the Config tab.');
        }

        const finalAssistantMsg: DetectiveMessage = {
          ...assistantMsg,
          content: accumulatedContent,
        };
        const updatedMessages = [...newMessages, finalAssistantMsg];

        // Persist session to Turso database
        await saveSession({
          messages: updatedMessages,
          boardSnapshot: {
            boardTitle,
            nodeCount: nodes.length,
            edgeCount: edges.length,
          },
        });
      }
    } catch (error) {
      console.error('Streaming chat error:', error);
      const errorMsg: DetectiveMessage = {
        ...assistantMsg,
        content: `Error: ${error instanceof Error ? error.message : 'Unable to connect with the Detective.'}`,
      };
      store.setMessages((prev) =>
        prev.map((msg) => (msg.id === assistantMsgId ? errorMsg : msg))
      );
      store.addMessage(errorMsg);
    } finally {
      setIsStreaming(false);
    }
  }, [messages, isStreaming, boardId, boardTitle, nodes, edges, store, saveSession]);

  const clearChat = useCallback(async () => {
    if (isStreaming) return;
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Clear only messages in client store (preserve lastAnalysis & builderState)
    store.setMessages([]);
    const currentId = sessionIdRef.current;

    try {
      const url = currentId
        ? `/api/detective/sessions?sessionId=${currentId}&clearMessagesOnly=true`
        : `/api/detective/sessions?boardId=${boardId}&clearMessagesOnly=true`;
      await fetch(url, {
        method: 'DELETE',
      });
    } catch (err) {
      console.error('Failed to clear chat in detective session:', err);
    }
  }, [isStreaming, store, boardId]);

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
        signal: AbortSignal.timeout(300000), // 5-minute timeout
        body: JSON.stringify({ boardId, boardTitle, nodes, edges, type }),
      });
      if (res.ok) {
        const data = await res.json();
        store.setAnalysis(data);

        // Also save to database
        await saveSession({
          lastAnalysis: data,
          boardSnapshot: {
            boardTitle,
            nodeCount: nodes.length,
            edgeCount: edges.length,
          },
        });
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
    isLoadingHistory,
    analysis: store.lastAnalysis,
    isAnalyzing: store.isAnalyzing,
    builderState: store.builderState,
    setBuilderState: store.setBuilderState,
    runAnalysis,
    sendMessage,
    setMessages: store.setMessages,
    clearChat,
    saveSession,
  };
}

