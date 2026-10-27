import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import { AIProviderConfig, AIProviderType, ModelInfo } from '@/types/detective';

export const getAvailableModels = (provider: AIProviderType): ModelInfo[] => {
  switch (provider) {
    case 'openai':
      return [
        { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', description: 'Most capable OpenAI model' },
        { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', description: 'Fast, cost-effective model' }
      ];
    case 'anthropic':
      return [
        { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet', provider: 'anthropic', description: 'Most intelligent Claude model' },
        { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', provider: 'anthropic', description: 'Fastest Claude model' }
      ];
    case 'google':
      return [
        { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'google', description: 'Fast, reliable, and intelligent model' },
        { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash', provider: 'google', description: 'Latest high-performance Gemini model' },
        { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', provider: 'google', description: 'Next-generation Gemini Flash model' },
        { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro Preview', provider: 'google', description: 'Advanced reasoning model' }
      ];
    case 'ollama':
      return [
        { id: 'llama3', name: 'Llama 3', provider: 'ollama', description: 'Meta Llama 3 8B' },
        { id: 'mistral', name: 'Mistral', provider: 'ollama', description: 'Mistral 7B' }
      ];
    default:
      return [];
  }
};

/**
 * Ensures Ollama base URL ends with '/v1' for OpenAI API compatibility,
 * handling trailing slashes and default ports properly.
 */
export function normalizeOllamaUrl(baseUrl?: string | null): string {
  if (!baseUrl || !baseUrl.trim()) {
    return 'http://localhost:11434/v1';
  }
  let url = baseUrl.trim().replace(/\/+$/, '');
  if (!url.endsWith('/v1')) {
    url = `${url}/v1`;
  }
  return url;
}

export const getModel = (config: AIProviderConfig) => {
  switch (config.provider) {
    case 'openai': {
      const openai = createOpenAI({
        apiKey: config.apiKey || '',
        baseURL: (config.baseUrl && !config.baseUrl.includes('11434')) ? config.baseUrl : undefined,
      });
      return openai(config.modelId);
    }
    case 'anthropic': {
      const anthropic = createAnthropic({
        apiKey: config.apiKey || '',
      });
      return anthropic(config.modelId);
    }
    case 'google': {
      // Google Generative AI connects directly to Google's API endpoint.
      // Must not receive Ollama or custom local base URLs.
      const google = createGoogleGenerativeAI({
        apiKey: config.apiKey || '',
      });
      return google(config.modelId);
    }
    case 'ollama': {
      // Ollama supports OpenAI compatibility API mounted at /v1
      const normalizedBaseUrl = normalizeOllamaUrl(config.baseUrl);
      const ollama = createOpenAI({
        baseURL: normalizedBaseUrl,
        apiKey: config.apiKey || 'ollama', // API key not required but needed by SDK
      });
      return ollama(config.modelId);
    }
    default:
      throw new Error(`Unsupported provider: ${config.provider}`);
  }
};

export const validateConfig = async (config: AIProviderConfig): Promise<{ valid: boolean; error?: string }> => {
  try {
    if (config.provider === 'ollama') {
      const normalizedUrl = normalizeOllamaUrl(config.baseUrl);
      // Fast probe: check Ollama /v1/models
      let modelsList: string[] = [];
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000); // 30-second probe
        const res = await fetch(`${normalizedUrl}/models`, {
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (res.ok) {
          const json = await res.json() as { data?: Array<{ id: string }> };
          if (Array.isArray(json.data)) {
            modelsList = json.data.map(m => m.id);
          }
        }
      } catch (err: unknown) {
        const fetchErr = err as { code?: string; message?: string; name?: string };
        if (
          fetchErr.code === 'ECONNREFUSED' ||
          fetchErr.name === 'AbortError' ||
          (fetchErr.message && fetchErr.message.includes('fetch failed'))
        ) {
          return {
            valid: false,
            error: `Cannot connect to Ollama at ${config.baseUrl || 'http://localhost:11434'}. Make sure Ollama is running ('ollama serve').`,
          };
        }
      }

      // If we retrieved models from Ollama, verify the requested model
      if (modelsList.length > 0) {
        const requested = config.modelId.trim().toLowerCase();
        const found = modelsList.some(m => {
          const mLower = m.toLowerCase();
          return mLower === requested || mLower.startsWith(`${requested}:`) || requested.startsWith(`${mLower}:`);
        });

        if (!found) {
          return {
            valid: false,
            error: `Model "${config.modelId}" is not found in local Ollama. Installed models: ${modelsList.join(', ')}. Run "ollama pull ${config.modelId}" in terminal.`,
          };
        }
        return { valid: true };
      }

      // Fallback probe: minimal generation call (90s timeout for cold model load)
      const model = getModel(config);
      await generateText({
        model,
        prompt: 'Ping',
        abortSignal: AbortSignal.timeout(90000),
      });
      return { valid: true };
    }

    // Cloud providers: check API key presence
    if (!config.apiKey || !config.apiKey.trim()) {
      return {
        valid: false,
        error: `API key is required for ${config.provider}.`,
      };
    }

    const model = getModel(config);
    await generateText({
      model,
      prompt: 'Ping',
      abortSignal: AbortSignal.timeout(90000), // 90-second timeout for cloud API responses
    });

    return { valid: true };
  } catch (error) {
    let message = error instanceof Error ? error.message : 'Unknown error during validation';

    // Translate common error scenarios into actionable advice
    if (message.includes('405') || message.includes('Method Not Allowed')) {
      message = 'Endpoint error (405 Method Not Allowed). Please check your endpoint settings or switch providers.';
    } else if (
      message.includes('generativelanguage.googleapis.com') ||
      message.includes('quota') ||
      message.includes('ResourceExhausted') ||
      message.includes('RESOURCE_EXHAUSTED')
    ) {
      message = 'Google Gemini request limit reached (free tier quota exceeded). Please wait ~30-60 seconds before testing again, or switch to Gemini 3.6 Flash.';
    } else if (message.includes('401') || message.includes('API_KEY_INVALID') || message.includes('Incorrect API key')) {
      message = `Invalid API key for ${config.provider}. Please check your credentials.`;
    } else if (message.includes('ECONNREFUSED') || message.includes('fetch failed')) {
      message = `Connection refused. Please verify that the endpoint is reachable.`;
    } else if (message.includes('404') || message.includes('not found')) {
      message = `Model "${config.modelId}" or endpoint not found on ${config.provider}.`;
    }

    return { valid: false, error: message };
  }
};
