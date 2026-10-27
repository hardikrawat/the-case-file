'use client';

import React, { useState, useEffect } from 'react';
import { Save, Eye, EyeOff, Check, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import useDetectiveStore from '@/store/detectiveStore';

import type { AIProviderType } from '@/types/detective';

const PROVIDERS = [
  { id: 'openai', name: 'OpenAI' },
  { id: 'anthropic', name: 'Anthropic' },
  { id: 'google', name: 'Google Gemini' },
  { id: 'ollama', name: 'Ollama (Local)' },
];

const DEFAULT_MODELS_BY_PROVIDER: Record<string, string[]> = {
  openai: ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'gpt-4o', 'gpt-4o-mini'],
  anthropic: ['claude-sonnet-4-20250514', 'claude-3-7-sonnet-20250219', 'claude-3-5-haiku-20241022'],
  google: ['gemini-2.5-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite'],
  ollama: ['qwen3:14b', 'llama3.2', 'llama3.1', 'mistral', 'phi3', 'codellama', 'gemma2'],
};

export default function DetectiveConfigTab() {
  const { aiConfig, isConfigLoading } = useDetectiveStore();
  const initialProvider = (aiConfig?.provider || 'openai').toLowerCase();
  const [provider, setProvider] = useState<string>(initialProvider);
  const [modelId, setModelId] = useState<string>(aiConfig?.modelId || DEFAULT_MODELS_BY_PROVIDER[initialProvider][0]);
  const [customModelInput, setCustomModelInput] = useState<string>('');
  const [apiKey, setApiKey] = useState(aiConfig?.apiKey || '');
  const [baseUrl, setBaseUrl] = useState(aiConfig?.baseUrl || 'http://localhost:11434');
  
  const [showKey, setShowKey] = useState(false);
  const [hasExistingKey, setHasExistingKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [testErrorMessage, setTestErrorMessage] = useState<string | null>(null);
  const [discoveredOllamaModels, setDiscoveredOllamaModels] = useState<string[]>([]);
  const lastLoadedConfigRef = React.useRef<string | null>(null);

  // Fetch installed Ollama models when Ollama is selected or on mount
  useEffect(() => {
    let isMounted = true;
    const fetchOllamaModels = async () => {
      try {
        const queryUrl = (provider.toLowerCase() === 'ollama' && baseUrl?.trim()) ? baseUrl.trim() : 'http://localhost:11434';
        const res = await fetch(`/api/detective/ollama-models?baseUrl=${encodeURIComponent(queryUrl)}`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted && Array.isArray(data.models) && data.models.length > 0) {
            setDiscoveredOllamaModels(data.models);
          }
        }
      } catch {
        // Silently handle if Ollama is not yet running
      }
    };

    fetchOllamaModels();
    return () => {
      isMounted = false;
    };
  }, [provider, baseUrl]);

  const getAvailableModelList = React.useCallback((p: string): string[] => {
    const key = p.toLowerCase();
    if (key === 'ollama') {
      if (discoveredOllamaModels.length > 0) {
        return Array.from(new Set([...discoveredOllamaModels, ...DEFAULT_MODELS_BY_PROVIDER.ollama]));
      }
      return DEFAULT_MODELS_BY_PROVIDER.ollama;
    }
    return DEFAULT_MODELS_BY_PROVIDER[key] || DEFAULT_MODELS_BY_PROVIDER.openai;
  }, [discoveredOllamaModels]);

  // Sync state ONLY when aiConfig loads initially or changes from outside (e.g. database reload)
  useEffect(() => {
    if (!aiConfig) return;

    const configKey = `${aiConfig.provider}:${aiConfig.modelId}:${aiConfig.apiKey || ''}:${aiConfig.baseUrl || ''}`;
    if (lastLoadedConfigRef.current === configKey) {
      return;
    }
    lastLoadedConfigRef.current = configKey;

    const p = (aiConfig.provider || 'openai').toLowerCase();
    setProvider(p);

    const available = DEFAULT_MODELS_BY_PROVIDER[p] || [];
    if (aiConfig.modelId && !available.includes(aiConfig.modelId)) {
      setModelId('custom');
      setCustomModelInput(aiConfig.modelId);
    } else {
      setModelId(aiConfig.modelId || available[0] || '');
      setCustomModelInput('');
    }

    if (aiConfig.apiKey !== undefined) {
      if (aiConfig.apiKey === '********') {
        setHasExistingKey(true);
        setApiKey('');
      } else {
        setHasExistingKey(Boolean(aiConfig.apiKey));
        setApiKey(aiConfig.apiKey || '');
      }
    }
    if (aiConfig.baseUrl !== undefined && aiConfig.baseUrl !== null) {
      setBaseUrl(aiConfig.baseUrl);
    } else if (p === 'ollama') {
      setBaseUrl('http://localhost:11434');
    } else {
      setBaseUrl('');
    }
  }, [aiConfig]);

  // When discovered Ollama models arrive and user is viewing Ollama, pick the installed model if not already set
  useEffect(() => {
    if (provider.toLowerCase() === 'ollama' && discoveredOllamaModels.length > 0) {
      if (modelId !== 'custom' && !discoveredOllamaModels.includes(modelId)) {
        setModelId(discoveredOllamaModels[0]);
      }
    }
  }, [discoveredOllamaModels, provider, modelId]);

  const handleProviderChange = (newProvider: string) => {
    const p = newProvider.toLowerCase();
    setProvider(p);
    setTestResult(null);
    setTestErrorMessage(null);

    const isCurrentSaved = aiConfig?.provider?.toLowerCase() === p;
    if (isCurrentSaved) {
      setHasExistingKey(aiConfig.apiKey === '********' || Boolean(aiConfig.apiKey));
      setApiKey(aiConfig.apiKey === '********' ? '' : (aiConfig.apiKey || ''));
      if (aiConfig.baseUrl) setBaseUrl(aiConfig.baseUrl);
      if (aiConfig.modelId) {
        const models = getAvailableModelList(p);
        if (models.includes(aiConfig.modelId)) {
          setModelId(aiConfig.modelId);
          setCustomModelInput('');
        } else {
          setModelId('custom');
          setCustomModelInput(aiConfig.modelId);
        }
      }
    } else {
      // Switched to a new provider: do NOT carry over previous provider's API key
      setHasExistingKey(false);
      setApiKey('');
      const models = getAvailableModelList(p);
      setModelId(models[0] || '');
      setCustomModelInput('');
      if (p === 'ollama') {
        setBaseUrl('http://localhost:11434');
      } else {
        setBaseUrl('');
      }
    }
  };

  const resolvedModelId = modelId === 'custom' ? customModelInput.trim() : modelId;

  const handleSave = async () => {
    if (!resolvedModelId) {
      toast.error('Please select or specify a model name');
      return;
    }

    setIsSaving(true);
    try {
      const isOllama = provider.toLowerCase() === 'ollama';
      const config = {
        provider: provider.toLowerCase() as AIProviderType,
        modelId: resolvedModelId,
        ...(apiKey !== '' || !hasExistingKey ? { apiKey } : {}),
        baseUrl: isOllama ? (baseUrl || 'http://localhost:11434') : undefined,
      };
      const res = await fetch('/api/detective/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      if (!res.ok) {
        throw new Error('Failed to save configuration');
      }
      const data = await res.json();
      const savedConfig = (data.config || config) as import('@/types/detective').AIProviderConfig;
      lastLoadedConfigRef.current = `${savedConfig.provider}:${savedConfig.modelId}:${savedConfig.apiKey || ''}:${savedConfig.baseUrl || ''}`;
      useDetectiveStore.getState().setAIConfig(savedConfig);
      useDetectiveStore.getState().setConfigured(true);
      toast.success('AI configuration saved successfully');
    } catch (error) {
      console.error(error);
      toast.error('Failed to save configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!resolvedModelId) {
      toast.error('Please select or specify a model name to test');
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    setTestErrorMessage(null);
    try {
      const isOllama = provider.toLowerCase() === 'ollama';
      const config = {
        provider: provider.toLowerCase() as AIProviderType,
        modelId: resolvedModelId,
        ...(apiKey !== '' || !hasExistingKey ? { apiKey } : {}),
        baseUrl: isOllama ? (baseUrl || 'http://localhost:11434') : undefined,
      };
      const res = await fetch('/api/detective/config/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(90000), // 90-second timeout
        body: JSON.stringify(config)
      });
      const data = await res.json();
      if (data.valid) {
        setTestResult('success');
        setTestErrorMessage(null);

        // Auto-save and activate this verified configuration immediately
        try {
          const saveRes = await fetch('/api/detective/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
          });
          if (saveRes.ok) {
            const saveData = await saveRes.json();
            const savedConfig = (saveData.config || config) as import('@/types/detective').AIProviderConfig;
            lastLoadedConfigRef.current = `${savedConfig.provider}:${savedConfig.modelId}:${savedConfig.apiKey || ''}:${savedConfig.baseUrl || ''}`;
            useDetectiveStore.getState().setAIConfig(savedConfig);
            useDetectiveStore.getState().setConfigured(true);
            const providerName = PROVIDERS.find(p => p.id === provider.toLowerCase())?.name || provider;
            toast.success(`Connection verified! ${providerName} is now saved and active.`);
            return;
          }
        } catch {
          // If auto-save fails, still show test passed
        }

        toast.success('AI connection test passed!');
      } else {
        setTestResult('error');
        setTestErrorMessage(data.error || 'Connection failed. Check your settings.');
        toast.error(data.error || 'Connection test failed');
      }
    } catch (err) {
      setTestResult('error');
      const msg = err instanceof Error ? err.message : 'Connection test failed';
      setTestErrorMessage(msg);
      toast.error('Connection test failed');
    } finally {
      setIsTesting(false);
    }
  };

  if (isConfigLoading) {
    return <div className="flex justify-center p-10"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  }

  const currentModels = getAvailableModelList(provider);

  const activeProviderObj = PROVIDERS.find(p => p.id === (aiConfig?.provider || '').toLowerCase());
  const activeEngineLabel = aiConfig
    ? `${activeProviderObj?.name || aiConfig.provider} • ${aiConfig.modelId}`
    : 'Not configured';

  const savedProvider = (aiConfig?.provider || '').toLowerCase();
  const savedModelId = aiConfig?.modelId || '';
  const isOllamaCurrent = provider.toLowerCase() === 'ollama';
  const savedBaseUrl = aiConfig?.baseUrl || '';

  const hasUnsavedChanges = Boolean(
    !aiConfig ||
    provider.toLowerCase() !== savedProvider ||
    resolvedModelId !== savedModelId ||
    (isOllamaCurrent && (baseUrl || 'http://localhost:11434') !== (savedBaseUrl || 'http://localhost:11434')) ||
    (!isOllamaCurrent && apiKey && apiKey !== '********')
  );

  return (
    <div className="flex flex-col h-full bg-[var(--panel-background)] p-6 overflow-y-auto">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-bold text-[var(--panel-foreground)] mb-1">AI Setup</h3>
          <p className="text-sm text-gray-500">Configure the reasoning engine for the Detective.</p>
        </div>

        {/* Active Engine Status Card */}
        <div className="p-3 rounded-lg border border-[var(--panel-border)] bg-black/5 dark:bg-white/5 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Active Engine</span>
            {hasUnsavedChanges ? (
              <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-500 px-1.5 py-0.5 rounded border border-amber-500/25">
                Unsaved Changes
              </span>
            ) : (
              <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/25 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Active
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-[var(--panel-foreground)] flex items-center gap-2">
            {activeEngineLabel}
          </p>
          {hasUnsavedChanges && (
            <p className="text-[11px] text-amber-400/90 pt-0.5">
              Click <strong>Test</strong> (auto-activates) or <strong>Save Config</strong> to apply these settings.
            </p>
          )}
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--panel-foreground)]">Provider</label>
            <select
              value={provider.toLowerCase()}
              onChange={(e) => handleProviderChange(e.target.value)}
              className="w-full p-2 bg-transparent border border-[var(--panel-border)] rounded-md text-sm text-[var(--panel-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--sidebar-accent)]"
            >
              {PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-[var(--panel-foreground)]">Model</label>
              {provider.toLowerCase() === 'ollama' && discoveredOllamaModels.length > 0 && (
                <span className="text-[11px] text-emerald-500 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {discoveredOllamaModels.length} local model{discoveredOllamaModels.length > 1 ? 's' : ''} detected
                </span>
              )}
            </div>
            <select
              value={modelId}
              onChange={(e) => {
                setModelId(e.target.value);
                if (e.target.value !== 'custom') {
                  setCustomModelInput('');
                }
              }}
              className="w-full p-2 bg-transparent border border-[var(--panel-border)] rounded-md text-sm text-[var(--panel-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--sidebar-accent)]"
            >
              {currentModels.map(m => (
                <option key={m} value={m}>
                  {m} {provider.toLowerCase() === 'ollama' && discoveredOllamaModels.includes(m) ? ' (Installed)' : ''}
                </option>
              ))}
              <option value="custom">Custom model name...</option>
            </select>
            {modelId === 'custom' && (
              <input
                type="text"
                value={customModelInput}
                onChange={(e) => setCustomModelInput(e.target.value)}
                placeholder="Enter custom model ID (e.g. qwen3:14b or gemini-2.5-flash)"
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
                  placeholder={hasExistingKey ? 'API key saved. Enter new to override.' : 'Enter API Key'}
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
              <p className="text-[11px] text-gray-400">
                Ollama server address. Automatically routes to OpenAI-compatible <code className="text-xs text-gray-300">/v1</code> endpoint.
              </p>
            </div>
          )}
        </div>

        <div className="pt-4 space-y-3 border-t border-[var(--panel-border)]">
          <div className="flex gap-3">
            <button
              onClick={handleTestConnection}
              disabled={isTesting}
              className="flex-1 py-2 px-4 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-800 dark:text-gray-200 rounded-md font-medium text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
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
            <div className={`p-3 rounded-md text-sm flex items-start gap-2.5 ${
              testResult === 'success'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
            }`}>
              {testResult === 'success' ? (
                <Check className="w-4 h-4 mt-0.5 text-emerald-400 shrink-0" />
              ) : (
                <X className="w-4 h-4 mt-0.5 text-rose-400 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-xs uppercase tracking-wide">
                  {testResult === 'success' ? 'Connection Successful' : 'Connection Failed'}
                </p>
                {testResult === 'error' && (
                  <p className="text-xs mt-1 text-rose-300/90 leading-relaxed break-words">
                    {testErrorMessage || 'Connection failed. Check your settings.'}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
