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
        { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash', provider: 'google', description: 'Latest high-performance Gemini model' }
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

export const getModel = (config: AIProviderConfig) => {
  switch (config.provider) {
    case 'openai': {
      const openai = createOpenAI({
        apiKey: config.apiKey || '',
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
      const google = createGoogleGenerativeAI({
        apiKey: config.apiKey || '',
      });
      return google(config.modelId);
    }
    case 'ollama': {
      // Ollama supports OpenAI compatibility API
      const ollama = createOpenAI({
        baseURL: config.baseUrl || 'http://localhost:11434/v1',
        apiKey: 'ollama', // API key not required but needed by SDK
      });
      return ollama(config.modelId);
    }
    default:
      throw new Error(`Unsupported provider: ${config.provider}`);
  }
};

export const validateConfig = async (config: AIProviderConfig): Promise<{valid: boolean; error?: string}> => {
  try {
    const model = getModel(config);
    
    // Make a minimal test call
    await generateText({
      model,
      prompt: 'Ping. Reply with exactly "Pong".',
    });
    
    return { valid: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error during validation';
    return { valid: false, error: message };
  }
};
