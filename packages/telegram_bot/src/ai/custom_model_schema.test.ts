import { describe, expect, it } from 'vitest';
import { customModelSchema, customProviderSchema } from './custom_model_schema';

const provider = {
  api: 'openai-completions',
  baseUrl: 'https://example.com/v1',
  models: [{ id: 'model' }],
};

describe('custom model configuration compatibility', () => {
  it('supplies nested defaults and copies mutable values for every parse', () => {
    const first = customModelSchema.parse({ id: 'model' });
    const second = customModelSchema.parse({ id: 'model' });
    expect(first).toEqual({
      id: 'model',
      reasoning: false,
      input: ['text'],
      contextWindow: 32768,
      maxTokens: 4096,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    });
    expect(first.input).not.toBe(second.input);
    expect(first.cost).not.toBe(second.cost);
  });

  it('strips only cost annotations while retaining strict provider, model, and compatibility checks', () => {
    const cost = { input: 1, output: 2, cacheRead: 3, cacheWrite: 4 };
    expect(
      customModelSchema.parse({ id: 'model', cost: { ...cost, annotation: true } }).cost,
    ).toEqual(cost);
    expect(customProviderSchema.safeParse({ ...provider, unknown: true }).success).toBe(false);
    expect(customModelSchema.safeParse({ id: 'model', unknown: true }).success).toBe(false);
    expect(customModelSchema.safeParse({ id: 'model', compat: { unknown: true } }).success).toBe(
      false,
    );
  });

  it.each([
    { id: 'model', reasoning: null },
    { id: 'model', input: null },
    { id: 'model', cost: null },
    { id: 'model', cost: { input: 1 } },
    { id: 'model', contextWindow: 1.5 },
    { id: 'model', maxTokens: Number.MAX_SAFE_INTEGER + 1 },
    { id: 'model', thinkingLevelMap: { unsupported: 'high' } },
  ])('rejects invalid values without coercion', (value) => {
    expect(customModelSchema.safeParse(value).success).toBe(false);
  });

  it('defaults explicit undefined without treating null as absent', () => {
    expect(customModelSchema.parse({ id: 'model', reasoning: undefined }).reasoning).toBe(false);
    expect(
      customModelSchema.parse({ id: 'model', thinkingLevelMap: { low: null, max: 'high' } })
        .thinkingLevelMap,
    ).toEqual({ low: null, max: 'high' });
  });

  it.each([
    'https://user:secret@example.com/v1',
    'https://example.com/v1?key=secret',
    'https://example.com/v1#secret',
    'file:///secret',
    'not a URL',
  ])('rejects unsafe endpoints without including their values in errors', (baseUrl) => {
    const result = customProviderSchema.safeParse({ ...provider, baseUrl });
    expect(result.success).toBe(false);
    if (result.success) throw new Error('expected failure');
    expect(result.error.message).not.toContain(baseUrl);
    expect(result.error.message).not.toContain('secret');
  });

  it('normalizes without mutating input', () => {
    const model = Object.freeze({ id: 'model' });
    const input = Object.freeze({ ...provider, models: Object.freeze([model]) });
    expect(customProviderSchema.parse(input).models[0].maxTokens).toBe(4096);
    expect(model).toEqual({ id: 'model' });
  });
});
