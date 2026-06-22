import type { Api, Model } from '@earendil-works/pi-ai';
import { afterEach, describe, expect, it } from 'vitest';

import { createLlmOptions, getLlmMaxTokens } from './llm-options.js';

const baseModel: Model<Api> = {
  id: 'test-model',
  name: 'Test Model',
  api: 'openai-responses',
  provider: 'openai',
  baseUrl: 'https://api.openai.com/v1',
  reasoning: true,
  input: ['text'],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 128000,
  maxTokens: 8192,
};

describe('llm-options', () => {
  afterEach(() => {
    delete process.env.LLM_MAX_TOKENS;
    delete process.env.LLM_REASONING_EFFORT;
  });

  it('uses a larger default token budget for reasoning models', () => {
    const options = createLlmOptions(baseModel, 'test-key');

    expect(options).toEqual({
      apiKey: 'test-key',
      maxTokens: 4096,
      cacheRetention: 'long',
      sessionId: undefined,
      reasoning: 'low',
    });
  });

  it('caps configured max tokens at model max tokens', () => {
    process.env.LLM_MAX_TOKENS = '999999';

    expect(getLlmMaxTokens(baseModel)).toBe(8192);
  });

  it('omits reasoning for non-reasoning models', () => {
    const options = createLlmOptions({ ...baseModel, reasoning: false }, 'test-key');

    expect(options.reasoning).toBeUndefined();
  });

  it('uses configured reasoning effort when valid', () => {
    process.env.LLM_REASONING_EFFORT = 'medium';

    expect(createLlmOptions(baseModel, 'test-key').reasoning).toBe('medium');
  });

  it('passes stable session ID for provider caching', () => {
    const options = createLlmOptions(baseModel, 'test-key', 'assistant_conversation_default');

    expect(options.sessionId).toBe('assistant_conversation_default');
    expect(options.cacheRetention).toBe('long');
  });
});
