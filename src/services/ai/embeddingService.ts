import { getLlmConfig } from './llmService';
import { logger } from '../../config/logger';

export const EMBEDDING_DIMENSION = 768;

export interface EmbeddingResponse {
  vector: number[];
  model: string;
  dimensions: number;
  latencyMs: number;
}

interface OpenAiEmbeddingResponse {
  data?: Array<{ embedding?: number[]; index?: number }>;
  model?: string;
}

export interface ProviderHasEmbeddings {
  provider: string;
  baseUrl: string;
  apiKey: string;
  defaultModel: string;
}

const EMBEDDING_MODEL_FALLBACK: Record<string, string> = {
  openai: 'text-embedding-ada-002',
  gemini: 'gemini-embedding-001',
  huggingface: 'sentence-transformers/all-MiniLM-L6-v2',
};

export const embeddingService = {
  isConfigured(): boolean {
    const config = getLlmConfig();
    if (!config || config.provider === 'mock') return false;
    return Boolean(config.apiKey);
  },

  getProviderInfo(): ProviderHasEmbeddings | null {
    const config = getLlmConfig();
    if (!config || config.provider === 'mock') return null;
    return {
      provider: config.provider,
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      defaultModel: config.defaultModel,
    };
  },

  async embed(text: string, model?: string): Promise<EmbeddingResponse | null> {
    const info = embeddingService.getProviderInfo();
    if (!info) return null;

    const startedAt = Date.now();
    const targetModel = model ?? EMBEDDING_MODEL_FALLBACK[info.provider];
    const requestBody: Record<string, unknown> = {
      model: targetModel,
      input: text.slice(0, 24_000),
    };
    if (info.provider === 'gemini') {
      requestBody.dimensions = EMBEDDING_DIMENSION;
    }
    try {
      const response = await fetch(`${info.baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${info.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`Embeddings request failed with status ${response.status}: ${body.slice(0, 300)}`);
      }

      const data = (await response.json()) as OpenAiEmbeddingResponse;
      const vector = data.data?.[0]?.embedding;
      if (!vector || vector.length === 0) {
        throw new Error('Embeddings response did not include a vector.');
      }

      return {
        vector,
        model: data.model ?? targetModel,
        dimensions: vector.length,
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      logger.warn({ provider: info.provider, err: error }, 'embedding request failed');
      return null;
    }
  },
};
