import { fauxProvider } from '@earendil-works/pi-ai/providers/faux';
import { describe, expect, it } from 'vitest';
import { boundedLlmOptions, modelThinkingLevel, parseLlmSettings } from './llm_options.js';

const model = fauxProvider({
  models: [{ id: 'reasoning', reasoning: true, maxTokens: 8192 }],
}).getModel();

describe('LLM generation controls', () => {
  it('restores the 4096-token and low-reasoning defaults', () => {
    expect(parseLlmSettings({})).toEqual({ maxTokens: 4096, thinkingLevel: 'low' });
  });
  it.each(['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const)(
    'accepts %s reasoning with case/whitespace normalization',
    (level) => {
      expect(
        parseLlmSettings({
          LLM_MAX_TOKENS: ' 2048 ',
          LLM_REASONING_EFFORT: ` ${level.toUpperCase()} `,
        }),
      ).toEqual({ maxTokens: 2048, thinkingLevel: level });
    },
  );
  it.each(['0', '-1', '4k', '4096junk', '1.5', 'Infinity', '9007199254740993', ''])(
    'rejects invalid token limits: %s',
    (value) => {
      expect(() => parseLlmSettings({ LLM_MAX_TOKENS: value })).toThrow();
    },
  );
  it('rejects unsupported reasoning values with no silent fallback', () => {
    expect(() => parseLlmSettings({ LLM_REASONING_EFFORT: 'turbo' })).toThrow();
  });
  it('clamps to configured, model, and per-request token limits', () => {
    const settings = parseLlmSettings({});
    expect(boundedLlmOptions(model, settings).maxTokens).toBe(4096);
    expect(boundedLlmOptions({ ...model, maxTokens: 1024 }, settings).maxTokens).toBe(1024);
    expect(boundedLlmOptions(model, settings, { maxTokens: 512 }).maxTokens).toBe(512);
    expect(boundedLlmOptions(model, settings, { maxTokens: 16000 }).maxTokens).toBe(4096);
  });
  it('preserves explicit off and disables reasoning for unsupported models', () => {
    expect(modelThinkingLevel(model, parseLlmSettings({ LLM_REASONING_EFFORT: 'off' }))).toBe(
      'off',
    );
    expect(modelThinkingLevel({ ...model, reasoning: false }, parseLlmSettings({}))).toBe('off');
    expect(
      boundedLlmOptions({ ...model, reasoning: false }, parseLlmSettings({}), { reasoning: 'high' })
        .reasoning,
    ).toBeUndefined();
  });
});
