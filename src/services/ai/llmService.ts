import { env } from '../../config/environment';
import { UpstreamError } from '../../utils/errors';

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'json_object' | 'text';
}

export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
}

export interface LlmResponse {
  content: string;
  model: string;
  usage: LlmUsage;
  latencyMs: number;
}

const COST_PER_MILLION = {
  input: 0.15,
  output: 0.6,
};

export type AiProvider = 'openai' | 'gemini' | 'huggingface' | 'mock';

export interface LlmConfig {
  provider: AiProvider;
  apiKey: string;
  baseUrl: string;
  defaultModel: string;
  maxTokens: number;
  temperature: number;
  supportsJsonMode: boolean;
}

const PROVIDER_ALIASES: Record<AiProvider, string> = {
  openai: 'OpenAI',
  gemini: 'Google Gemini',
  huggingface: 'Hugging Face',
  mock: 'Offline Mock',
};

interface OpenAiChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  model?: string;
}

const getProvider = (): AiProvider => {
  if (env.AI_PROVIDER === 'openai') return 'openai';
  if (env.AI_PROVIDER === 'gemini') return 'gemini';
  if (env.AI_PROVIDER === 'huggingface') return 'huggingface';
  if (env.AI_PROVIDER === 'mock') return 'mock';
  if (env.GEMINI_API_KEY) return 'gemini';
  if (env.HUGGINGFACE_API_KEY) return 'huggingface';
  if (env.OPENAI_API_KEY) return 'openai';
  return 'mock';
};

export const getLlmConfig = (): LlmConfig | null => {
  const provider = getProvider();
  if (provider === 'mock') {
    return {
      provider,
      apiKey: '',
      baseUrl: '',
      defaultModel: 'mock-model',
      maxTokens: env.LLM_MAX_TOKENS,
      temperature: env.LLM_TEMPERATURE,
      supportsJsonMode: true,
    };
  }
  if (provider === 'gemini') {
    if (!env.GEMINI_API_KEY) return null;
    return {
      provider,
      apiKey: env.GEMINI_API_KEY,
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
      defaultModel: env.GEMINI_MODEL,
      maxTokens: env.LLM_MAX_TOKENS,
      temperature: env.LLM_TEMPERATURE,
      supportsJsonMode: true,
    };
  }
  if (provider === 'huggingface') {
    if (!env.HUGGINGFACE_API_KEY) return null;
    return {
      provider,
      apiKey: env.HUGGINGFACE_API_KEY,
      baseUrl: 'https://router.huggingface.co/v1',
      defaultModel: env.HUGGINGFACE_MODEL,
      maxTokens: env.LLM_MAX_TOKENS,
      temperature: env.LLM_TEMPERATURE,
      supportsJsonMode: false,
    };
  }
  if (provider === 'openai') {
    if (!env.OPENAI_API_KEY) return null;
    return {
      provider,
      apiKey: env.OPENAI_API_KEY,
      baseUrl: env.OPENAI_BASE_URL,
      defaultModel: env.LLM_MODEL,
      maxTokens: env.LLM_MAX_TOKENS,
      temperature: env.LLM_TEMPERATURE,
      supportsJsonMode: true,
    };
  }
  return null;
};

export const getAiProviderName = (): string => PROVIDER_ALIASES[getProvider()];

const buildRequestBody = (config: LlmConfig, messages: LlmMessage[], options: LlmOptions) => {
  const wantsJson = options.responseFormat === 'json_object';
  let bodyMessages = messages;
  if (wantsJson && !config.supportsJsonMode) {
    bodyMessages = [
      ...messages,
      { role: 'user' as const, content: 'Respond with valid JSON only, no markdown.' },
    ];
  }
  return JSON.stringify({
    model: options.model ?? config.defaultModel,
    messages: bodyMessages,
    temperature: options.temperature ?? config.temperature,
    max_tokens: options.maxTokens ?? config.maxTokens,
    ...(wantsJson && config.supportsJsonMode ? { response_format: { type: 'json_object' } } : {}),
  });
};

const parseOpenAiResponse = (
  data: OpenAiChatResponse,
  startedAt: number,
  config: LlmConfig,
  options: LlmOptions
): LlmResponse => {
  const content = data.choices?.[0]?.message?.content ?? '';
  const inputTokens = data.usage?.prompt_tokens ?? 0;
  const outputTokens = data.usage?.completion_tokens ?? 0;
  const totalTokens = data.usage?.total_tokens ?? inputTokens + outputTokens;
  const costUsd =
    (inputTokens / 1_000_000) * COST_PER_MILLION.input + (outputTokens / 1_000_000) * COST_PER_MILLION.output;

  return {
    content,
    model: data.model ?? options.model ?? config.defaultModel,
    usage: { inputTokens, outputTokens, totalTokens, costUsd },
    latencyMs: Date.now() - startedAt,
  };
};

const estimateInputTokens = (messages: LlmMessage[]): number =>
  messages.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0);

const mockChat = (messages: LlmMessage[], options: LlmOptions, config: LlmConfig): LlmResponse => {
  const startedAt = Date.now();
  const wantsJson = options.responseFormat === 'json_object';
  const system = messages.find((m) => m.role === 'system')?.content ?? '';
  const userPayload = messages[messages.length - 1]?.content ?? '';

  let content = 'This is an offline mock response. Configure AI_PROVIDER and an API key for real AI output.';

  if (wantsJson) {
    if (system.includes('test generation')) {
      const parsed = safeJsonParse(userPayload) as { count?: number; types?: string[] };
      const count = Math.max(1, Math.min(parsed?.count ?? 3, 10));
      const types: string[] = parsed?.types?.length ? parsed.types.slice(0, 3) : ['FUNCTIONAL', 'HAPPY_PATH'];
      const testCases = Array.from({ length: count }, (_, i) => ({
        title: `Generated test case ${i + 1}`,
        description:
          'Auto-generated by the offline mock provider. Configure a real AI provider for richer coverage.',
        type: types[i % types.length],
        priority: i === 0 ? 'high' : 'medium',
        steps: [
          { action: 'goto', value: '/' },
          { action: 'expectVisible', selector: 'body' },
          ...(count > 1 ? [{ action: 'screenshot' }] : []),
        ],
        expectedResult: 'Page renders without error',
        tags: ['mock', 'auto'],
      }));
      content = JSON.stringify({ testCases });
    } else if (system.includes('explorer')) {
      const parsed = safeJsonParse(userPayload) as {
        baseUrl?: string;
        appMap?: { pages?: unknown[]; workflows?: unknown[] };
      };
      const pages = Array.isArray(parsed?.appMap?.pages) ? parsed.appMap.pages.slice(0, 5) : [];
      content = JSON.stringify({
        summary: `Discovered ${pages.length} page(s). Configure a real AI provider for a deeper workflow analysis.`,
        suggestedWorkflows: pages.slice(0, 3).map((p, i) => ({
          name: `Workflow ${i + 1}`,
          description: 'Key user journey to cover in your test suite.',
          pages: [p],
          steps: [
            { action: 'goto', detail: parsed.baseUrl ?? '/' },
            { action: 'expectVisible', detail: 'body' },
          ],
        })),
      });
    } else if (system.includes('failure analysis')) {
      content = JSON.stringify({
        analysis: {
          rootCause: 'No API key configured — this is an offline mock analysis.',
          category: 'unknown',
          confidence: 0,
          evidence: ['Mock provider: no real failure data analyzed.'],
          suggestedFix: 'Set AI_PROVIDER and a provider API key to enable real failure analysis.',
          relatedSelectors: [],
        },
      });
    } else if (system.includes('bug detection')) {
      content = JSON.stringify({ suspicious: false, candidate: null });
    } else if (system.includes('healing')) {
      content = JSON.stringify({
        repaired: false,
        newSelector: null,
        reason: 'Offline mock provider: no real healing performed.',
        confidence: 0,
      });
    } else if (system.includes('code analysis')) {
      content = JSON.stringify({
        summary: 'Offline mock provider: no real code analysis performed.',
        suspiciousFiles: [],
        suggestedFix: null,
      });
    } else {
      const fallback: Record<string, unknown> = { ok: true, status: 'mock' };
      content = JSON.stringify(fallback);
    }
  }

  return {
    content,
    model: `mock:${config.defaultModel}`,
    usage: {
      inputTokens: estimateInputTokens(messages),
      outputTokens: Math.ceil(content.length / 4),
      totalTokens: 0,
      costUsd: 0,
    },
    latencyMs: Date.now() - startedAt,
  };
};

const safeJsonParse = (input: string): unknown => {
  try {
    return input ? JSON.parse(input) : {};
  } catch {
    return {};
  }
};

export const llmService = {
  isConfigured(): boolean {
    return getProvider() === 'mock' || getLlmConfig() !== null;
  },

  getProviderName(): string {
    return getAiProviderName();
  },

  async chat(messages: LlmMessage[], options: LlmOptions = {}): Promise<LlmResponse> {
    const config = getLlmConfig();
    if (!config) {
      throw new UpstreamError(
        `LLM provider "${getAiProviderName()}" is not configured. Set ${envOutKey()} in your environment or switch AI_PROVIDER.`
      );
    }

    if (config.provider === 'mock') {
      return mockChat(messages, options, config);
    }

    const startedAt = Date.now();
    try {
      const response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: buildRequestBody(config, messages, options),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new UpstreamError(`LLM request failed with status ${response.status}`, body.slice(0, 500));
      }

      const data = (await response.json()) as OpenAiChatResponse;
      return parseOpenAiResponse(data, startedAt, config, options);
    } catch (error) {
      if (error instanceof UpstreamError) throw error;
      throw new UpstreamError('LLM request failed', (error as Error).message);
    }
  },

  async chatJson<T>(messages: LlmMessage[], options: LlmOptions = {}): Promise<{ data: T; usage: LlmUsage }> {
    const response = await llmService.chat(messages, { ...options, responseFormat: 'json_object' });
    try {
      const data = JSON.parse(response.content) as T;
      return { data, usage: response.usage };
    } catch {
      throw new UpstreamError('LLM returned malformed JSON', response.content.slice(0, 500));
    }
  },
};

const envOutKey = (): string => {
  const provider = getProvider();
  if (provider === 'gemini') return 'GEMINI_API_KEY';
  if (provider === 'huggingface') return 'HUGGINGFACE_API_KEY';
  if (provider === 'openai') return 'OPENAI_API_KEY';
  return 'AI_PROVIDER';
};
