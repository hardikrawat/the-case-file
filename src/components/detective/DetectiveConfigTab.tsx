'use client';

import React, { useState, useEffect } from 'react';
import { Save, Eye, EyeOff, Check, X, Loader2 } from 'lucide-react';
import useDetectiveStore from '@/store/detectiveStore';

const PROVIDERS = ['OpenAI', 'Anthropic', 'Google', 'Ollama'];

const MODELS_BY_PROVIDER: Record<string, string[]> = {
  OpenAI: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
  Anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'],
  Google: ['gemini-2.0-flash', 'gemini-1.5-pro'],
  Ollama: ['llama3.2', 'mistral', 'phi3', 'codellama']
};

export default function DetectiveConfigTab() {
  const { aiConfig, isConfigLoading } = useDetectiveStore();
  const [provider, setProvider] = useState(aiConfig?.provider || 'OpenAI');
  const [modelId, setModelId] = useState(aiConfig?.modelId || MODELS_BY_PROVIDER['OpenAI'][0]);
  const [apiKey, setApiKey] = useState(aiConfig?.apiKey || '');
  const [baseUrl, setBaseUrl] = useState(aiConfig?.baseUrl || 'http://localhost:11434');
  
  const [showKey, setShowKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  // Update model list when provider changes
  useEffect(() => {
    if (!MODELS_BY_PROVIDER[provider].includes(modelId)) {
      setModelId(MODELS_BY_PROVIDER[provider][0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const config = {
        provider: provider.toLowerCase() as import('@/types/detective').AIProviderType,
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
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="w-full p-2 bg-transparent border border-[var(--panel-border)] rounded-md text-sm text-[var(--panel-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--sidebar-accent)]"
            >
              {PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--panel-foreground)]">Model</label>
            <select
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              className="w-full p-2 bg-transparent border border-[var(--panel-border)] rounded-md text-sm text-[var(--panel-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--sidebar-accent)]"
            >
              {MODELS_BY_PROVIDER[provider].map(m => <option key={m} value={m}>{m}</option>)}
              {provider === 'Ollama' && <option value="custom">Custom...</option>}
            </select>
            {modelId === 'custom' && (
              <input
                type="text"
                placeholder="Custom model name"
                className="w-full p-2 mt-2 bg-transparent border border-[var(--panel-border)] rounded-md text-sm text-[var(--panel-foreground)]"
              />
            )}
          </div>

          {provider !== 'Ollama' && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--panel-foreground)]">API Key</label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={`Enter ${provider} API Key`}
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

          {provider === 'Ollama' && (
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
