import { env } from '../../../src/config/environment';
import { llmService, getProviderChain } from '../../../src/services/ai/llmService';

/**
 * Verifies the AI provider fallback chain: when the primary provider (OpenAI or
 * Gemini) fails at request time we degrade to a Hugging Face open-source model
 * and, as a last resort, the offline mock — so AI features never hard-fail.
 * `fetch` is mocked; no network is touched.
 */

const ORIGINAL = {
  AI_PROVIDER: env.AI_PROVIDER,
  AI_FALLBACK_PROVIDERS: env.AI_FALLBACK_PROVIDERS,
  GEMINI_API_KEY: env.GEMINI_API_KEY,
  HUGGINGFACE_API_KEY: env.HUGGINGFACE_API_KEY,
  OPENAI_API_KEY: env.OPENAI_API_KEY,
};

const okCompletion = (content: string) => ({
  ok: true,
  json: async () => ({
    choices: [{ message: { content } }],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    model: 'stub',
  }),
});

describe('llmService provider fallback', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    (global as { fetch: unknown }).fetch = fetchMock;
    env.AI_PROVIDER = 'gemini';
    env.GEMINI_API_KEY = 'gemini-key';
    env.HUGGINGFACE_API_KEY = 'hf-key';
    env.OPENAI_API_KEY = '';
    env.AI_FALLBACK_PROVIDERS = 'huggingface';
  });

  afterEach(() => {
    Object.assign(env, ORIGINAL);
    jest.restoreAllMocks();
  });

  describe('getProviderChain', () => {
    it('uses the configured fallbacks and always ends with the offline mock', () => {
      env.AI_FALLBACK_PROVIDERS = '';
      expect(getProviderChain()).toEqual(['gemini', 'huggingface', 'openai', 'mock']);
    });

    it('honours an explicit AI_FALLBACK_PROVIDERS list', () => {
      env.AI_FALLBACK_PROVIDERS = 'huggingface,openai';
      expect(getProviderChain()).toEqual(['gemini', 'huggingface', 'openai', 'mock']);
    });

    it('is just the mock when the primary provider is the mock', () => {
      env.AI_PROVIDER = 'mock';
      expect(getProviderChain()).toEqual(['mock']);
    });
  });

  describe('chat', () => {
    it('falls back to Hugging Face when Gemini throws', async () => {
      fetchMock
        .mockRejectedValueOnce(new Error('gemini network down'))
        .mockResolvedValueOnce(okCompletion('hello from hf'));

      const response = await llmService.chat([{ role: 'user', content: 'hi' }]);

      expect(response.content).toBe('hello from hf');
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls[0][0]).toContain('generativelanguage.googleapis.com');
      expect(fetchMock.mock.calls[1][0]).toContain('router.huggingface.co');
    });

    it('falls back to another provider when the primary returns an error status', async () => {
      fetchMock
        .mockResolvedValueOnce({ ok: false, status: 429, text: async () => 'rate limited' })
        .mockResolvedValueOnce(okCompletion('recovered'));

      const response = await llmService.chat([{ role: 'user', content: 'hi' }]);

      expect(response.content).toBe('recovered');
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('degrades to the offline mock when every real provider fails', async () => {
      fetchMock.mockRejectedValue(new Error('everything is down'));

      const response = await llmService.chat([{ role: 'user', content: 'hi' }]);

      expect(response.model.startsWith('mock:')).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(2); // gemini + huggingface, then mock
    });

    it('skips providers that have no API key configured', async () => {
      env.HUGGINGFACE_API_KEY = '';
      fetchMock.mockRejectedValue(new Error('gemini only'));

      const response = await llmService.chat([{ role: 'user', content: 'hi' }]);

      expect(response.model.startsWith('mock:')).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1); // only gemini was attempted
    });
  });
});
