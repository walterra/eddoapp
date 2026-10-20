import { createModels } from '@earendil-works/pi-ai/models';
import { builtinModels } from '@earendil-works/pi-ai/providers/all';
import { fauxProvider } from '@earendil-works/pi-ai/providers/faux';
import { describe, expect, it } from 'vitest';
import { resolveConfiguredModel } from './llm-model-resolution.js';

describe('LLM_MODEL resolution', () => {
  it('preserves unqualified Claude model IDs using Anthropic', () => {
    expect(resolveConfiguredModel('claude-sonnet-4-5-20250929', builtinModels())).toEqual({
      provider: 'anthropic',
      modelId: 'claude-sonnet-4-5-20250929',
    });
  });
  it('supports explicit providers and model IDs containing slashes', () => {
    const models = createModels();
    models.setProvider(fauxProvider({ provider: 'test', models: [{ id: 'org/model' }] }).provider);
    expect(resolveConfiguredModel(' test/org/model ', models)).toEqual({
      provider: 'test',
      modelId: 'org/model',
    });
  });
  it('resolves unique unqualified model IDs', () => {
    const models = createModels();
    models.setProvider(fauxProvider({ provider: 'test', models: [{ id: 'unique' }] }).provider);
    expect(resolveConfiguredModel('unique', models)).toEqual({
      provider: 'test',
      modelId: 'unique',
    });
  });
  it('requires a provider when the model is ambiguous', () => {
    const models = createModels();
    for (const provider of ['first', 'second'])
      models.setProvider(fauxProvider({ provider, models: [{ id: 'shared' }] }).provider);
    expect(() => resolveConfiguredModel('shared', models)).toThrow('Ambiguous');
    expect(resolveConfiguredModel('second/shared', models)).toEqual({
      provider: 'second',
      modelId: 'shared',
    });
  });
  it('rejects missing and unknown selections instead of cloning unrelated model metadata', () => {
    const models = createModels();
    models.setProvider(fauxProvider({ provider: 'test', models: [{ id: 'known' }] }).provider);
    expect(() => resolveConfiguredModel('', models)).toThrow('LLM_MODEL');
    expect(() => resolveConfiguredModel('test/unknown', models)).toThrow('Unknown');
    expect(() => resolveConfiguredModel('unknown/model', models)).toThrow('Unknown');
  });
});
