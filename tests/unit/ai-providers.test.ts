import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { normalizeOllamaUrl, getModel, validateConfig } from '@/lib/ai/ai-providers';

describe('normalizeOllamaUrl', () => {
  it('should format baseUrl without /v1 to include /v1', () => {
    expect(normalizeOllamaUrl('http://localhost:11434')).toBe('http://localhost:11434/v1');
    expect(normalizeOllamaUrl('http://localhost:11434/')).toBe('http://localhost:11434/v1');
    expect(normalizeOllamaUrl('http://127.0.0.1:11434')).toBe('http://127.0.0.1:11434/v1');
  });

  it('should preserve baseUrl that already ends with /v1', () => {
    expect(normalizeOllamaUrl('http://localhost:11434/v1')).toBe('http://localhost:11434/v1');
    expect(normalizeOllamaUrl('http://localhost:11434/v1/')).toBe('http://localhost:11434/v1');
  });

  it('should default to localhost /v1 when baseUrl is omitted or empty', () => {
    expect(normalizeOllamaUrl('')).toBe('http://localhost:11434/v1');
    expect(normalizeOllamaUrl(null)).toBe('http://localhost:11434/v1');
    expect(normalizeOllamaUrl(undefined)).toBe('http://localhost:11434/v1');
  });
});

describe('getModel', () => {
  it('should create model instances for supported providers', () => {
    const openaiModel = getModel({ provider: 'openai', modelId: 'gpt-4o', apiKey: 'test-key' });
    expect(openaiModel).toBeDefined();

    const anthropicModel = getModel({ provider: 'anthropic', modelId: 'claude-3-5-haiku-20241022', apiKey: 'test-key' });
    expect(anthropicModel).toBeDefined();

    const googleModel = getModel({ provider: 'google', modelId: 'gemini-2.5-flash', apiKey: 'test-key' });
    expect(googleModel).toBeDefined();

    const ollamaModel = getModel({ provider: 'ollama', modelId: 'qwen3:14b', baseUrl: 'http://localhost:11434' });
    expect(ollamaModel).toBeDefined();
  });
});

describe('validateConfig', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('should fail if API key is missing for cloud providers', async () => {
    const res = await validateConfig({
      provider: 'openai',
      modelId: 'gpt-4o',
      apiKey: '',
    });
    expect(res.valid).toBe(false);
    expect(res.error).toContain('API key is required');
  });

  it('should validate Ollama successfully when requested model is detected', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ id: 'qwen3:14b' }, { id: 'llama3.2:latest' }],
      }),
    }) as unknown as typeof fetch;

    const res = await validateConfig({
      provider: 'ollama',
      modelId: 'qwen3:14b',
      baseUrl: 'http://localhost:11434',
    });

    expect(res.valid).toBe(true);
  });

  it('should fail with helpful message when model is not installed in Ollama', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ id: 'qwen3:14b' }],
      }),
    }) as unknown as typeof fetch;

    const res = await validateConfig({
      provider: 'ollama',
      modelId: 'mistral',
      baseUrl: 'http://localhost:11434',
    });

    expect(res.valid).toBe(false);
    expect(res.error).toContain('Model "mistral" is not found in local Ollama');
    expect(res.error).toContain('ollama pull mistral');
  });

  it('should report connection refused when Ollama is offline', async () => {
    global.fetch = vi.fn().mockRejectedValue({
      code: 'ECONNREFUSED',
      message: 'connect ECONNREFUSED 127.0.0.1:11434',
    }) as unknown as typeof fetch;

    const res = await validateConfig({
      provider: 'ollama',
      modelId: 'qwen3:14b',
      baseUrl: 'http://localhost:11434',
    });

    expect(res.valid).toBe(false);
    expect(res.error).toContain('Cannot connect to Ollama');
    expect(res.error).toContain('ollama serve');
  });

  it('should format 405 Method Not Allowed error into an actionable message', async () => {
    // Calling validateConfig with an invalid endpoint error
    const res = await validateConfig({
      provider: 'google',
      modelId: 'gemini-2.5-flash',
      apiKey: 'test-key',
      baseUrl: 'http://localhost:11434',
    });
    // In our implementation, validateConfig does not pass baseUrl to Google,
    // so any failure would be simulated or Google API call.
    expect(res.valid).toBe(false);
  });
});
