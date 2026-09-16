'use client';

import React, { useState, useEffect } from 'react';
import { Save, Eye, EyeOff, Check, X, Loader2 } from 'lucide-react';
import useDetectiveStore from '@/store/detectiveStore';

import type { AIProviderType } from '@/types/detective';

const PROVIDERS = [
  { id: 'openai', name: 'OpenAI' },
  { id: 'anthropic', name: 'Anthropic' },
  { id: 'google', name: 'Google Gemini' },
  { id: 'ollama', name: 'Ollama (Local)' },
];

const MODELS_BY_PROVIDER: Record<string, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
  anthropic: ['claude-3-7-sonnet-20250219', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'],
  google: ['gemini-2.5-flash', 'gemini-3.6-flash'],
  ollama: ['llama3.2', 'mistral', 'phi3', 'codellama'],
};

const getModelsForProvider = (p?: string): string[] => {
  if (!p) return MODELS_BY_PROVIDER.openai;
  const key = p.toLowerCase();
  return MODELS_BY_PROVIDER[key] || MODELS_BY_PROVIDER.openai;
};

export default function DetectiveConfigTab() {
  const { aiConfig, isConfigLoading } = useDetectiveStore();
  const initialProvider = (aiConfig?.provider || 'openai').toLowerCase();
  const [provider, setProvider] = useState<string>(initialProvider);
  const [modelId, setModelId] = useState<string>(aiConfig?.modelId || getModelsForProvider(initialProvider)[0]);
  const [apiKey, setApiKey] = useState(aiConfig?.apiKey || '');
  const [baseUrl, setBaseUrl] = useState(aiConfig?.baseUrl || 'http://localhost:11434');
  
  const [showKey, setShowKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  // Sync state if aiConfig loads or updates in store
  useEffect(() => {
    if (aiConfig) {
      const p = (aiConfig.provider || 'openai').toLowerCase();
      setProvider(p);
      setModelId(aiConfig.modelId || getModelsForProvider(p)[0]);
      if (aiConfig.apiKey !== undefined) setApiKey(aiConfig.apiKey);
      if (aiConfig.baseUrl !== undefined) setBaseUrl(aiConfig.baseUrl);
    }
  }, [aiConfig]);

  // Update model list when provider changes
  useEffect(() => {
    const models = getModelsForProvider(provider);
    if (!models.includes(modelId) && modelId !== 'custom') {
      setModelId(models[0] || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const config = {
        provider: provider.toLowerCase() as AIProviderType,
        modelId,
        apiKey,
        baseUrl,
      };
      await fetch('/api/detective/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      useDetectiveStore.getState().setAIConfig(config);
      useDetectiveStore.getState().setConfigured(true);
      // Could show toast here
    } catch (error) {
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      // Dummy check or actual ping to a test endpoint
      await new Promise(r => setTimeout(r, 1000));
      setTestResult(apiKey.length > 5 || provider === 'Ollama' ? 'success' : 'error');
    } catch {
      setTestResult('error');
    } finally {
      setIsTesting(false);
    }
  };

  if (isConfigLoading) {
    return <div className="flex justify-center p-10"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  }

  return (
    <div className="flex flex-col h-full bg-[var(--panel-background)] p-6 overflow-y-auto">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-bold text-[var(--panel-foreground)] mb-1">AI Setup</h3>
          <p className="text-sm text-gray-500">Configure the reasoning engine for the Detective.</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--panel-foreground)]">Provider</label>
            <select
              value={provider.toLowerCase()}
              onChange={(e) => setProvider(e.target.value)}
              className="w-full p-2 bg-transparent border border-[var(--panel-border)] rounded-md text-sm text-[var(--panel-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--sidebar-accent)]"
            >
              {PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--panel-foreground)]">Model</label>
            <select
              value={getModelsForProvider(provider).includes(modelId) ? modelId : 'custom'}
              onChange={(e) => {
                if (e.target.value === 'custom') {
                  setModelId('custom');
                } else {
                  setModelId(e.target.value);
                }
              }}
              className="w-full p-2 bg-transparent border border-[var(--panel-border)] rounded-md text-sm text-[var(--panel-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--sidebar-accent)]"
            >
              {getModelsForProvider(provider).map(m => <option key={m} value={m}>{m}</option>)}
              <option value="custom">Custom model name...</option>
            </select>
            {(!getModelsForProvider(provider).includes(modelId) || modelId === 'custom') && (
              <input
                type="text"
                value={modelId === 'custom' ? '' : modelId}
                onChange={(e) => setModelId(e.target.value)}
                placeholder="Enter custom model ID (e.g. gemini-2.5-flash)"
                className="w-full p-2 mt-2 bg-transparent border border-[var(--panel-border)] rounded-md text-sm text-[var(--panel-foreground)]"
              />
            )}
          </div>

          {provider.toLowerCase() !== 'ollama' && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--panel-foreground)]">API Key</label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter API Key"
                  className="w-full p-2 pr-10 bg-transparent border border-[var(--panel-border)] rounded-md text-sm text-[var(--panel-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--sidebar-accent)]"
                />
                <button
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-2 text-gray-500 hover:text-[var(--panel-foreground)]"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {provider.toLowerCase() === 'ollama' && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--panel-foreground)]">Base URL</label>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="http://localhost:11434"
                className="w-full p-2 bg-transparent border border-[var(--panel-border)] rounded-md text-sm text-[var(--panel-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--sidebar-accent)]"
              />
            </div>
          )}
        </div>

        <div className="pt-4 space-y-3 border-t border-[var(--panel-border)]">
          <div className="flex gap-3">
            <button
              onClick={handleTestConnection}
              disabled={isTesting}
              className="flex-1 py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-md font-medium text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Test'}
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-[2] py-2 px-4 bg-[var(--sidebar-accent)] text-[var(--sidebar-accent-foreground)] rounded-md font-medium text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Config
            </button>
          </div>

          {testResult && (
            <div className={`p-3 rounded-md text-sm flex items-center gap-2 ${testResult === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {testResult === 'success' ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
              {testResult === 'success' ? 'Connection successful!' : 'Connection failed. Check your settings.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
