import { fauxProvider } from '@earendil-works/pi-ai/providers/faux';
import { describe, expect, it } from 'vitest';
import { boundedLlmOptions, parseLlmSettings } from './llm-options.js';

const model = fauxProvider({ models: [{ id: 'test', maxTokens: 8192 }] }).getModel();

describe('prompt cache retention parity', () => {
  it('defaults generation and compaction to long retention', () => {
    expect(boundedLlmOptions(model, parseLlmSettings({})).cacheRetention).toBe('long');
  });

  it.each(['none', 'short', 'long'] as const)(
    'preserves explicit %s retention',
    (cacheRetention) => {
      expect(
        boundedLlmOptions(model, parseLlmSettings({}), { cacheRetention }).cacheRetention,
      ).toBe(cacheRetention);
    },
  );
});
