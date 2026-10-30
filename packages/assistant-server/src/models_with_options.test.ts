import { createModels } from '@earendil-works/pi-ai/models';
import { fauxAssistantMessage, fauxProvider } from '@earendil-works/pi-ai/providers/faux';
import { describe, expect, it } from 'vitest';
import { modelsWithOptions } from './models_with_options.js';

describe('bounded model collection', () => {
  it('preserves owner-bound model/auth methods and forwards request options without mutation', async () => {
    const provider = fauxProvider({ models: [{ id: 'test', reasoning: true, maxTokens: 8192 }] });
    const source = createModels();
    source.setProvider(provider.provider);
    const models = modelsWithOptions(source, { maxTokens: 4096, thinkingLevel: 'low' });
    expect(models.getModel(provider.provider.id, 'test')).toEqual(
      source.getModel(provider.provider.id, 'test'),
    );
    expect(await models.getAuth(provider.provider.id)).toBeDefined();
    const signal = new AbortController().signal;
    const options = {
      maxTokens: 128,
      reasoning: 'high' as const,
      sessionId: 'persistent-session',
      signal,
      cacheRetention: 'long' as const,
    };
    provider.setResponses([
      (_context, actual) => {
        expect(actual).toMatchObject(options);
        expect(actual?.signal).toBe(signal);
        return fauxAssistantMessage('Done');
      },
    ]);
    const result = await models
      .streamSimple(
        provider.getModel(),
        { messages: [{ role: 'user', content: 'Summarize', timestamp: 1 }] },
        options,
      )
      .result();
    expect(result.stopReason).toBe('stop');
    expect(options.maxTokens).toBe(128);
    expect(options.reasoning).toBe('high');
    provider.appendResponses([
      (_context, actual) => {
        expect(actual?.maxTokens).toBe(4096);
        return fauxAssistantMessage('Bounded completion');
      },
    ]);
    expect((await models.completeSimple(provider.getModel(), { messages: [] })).stopReason).toBe(
      'stop',
    );
  });
});
