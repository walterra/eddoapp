import { describe, expect, it } from 'vitest';
import { portableModelSchema } from './custom_model_schema';

const portable = {
  version: 1,
  provider: 'custom',
  config: {
    api: 'openai-completions',
    baseUrl: 'https://example.com/v1',
    models: [{ id: 'model' }],
  },
};

describe('portable model schema compatibility', () => {
  it('projects the envelope and supplies model defaults', () => {
    const result = portableModelSchema.parse({ ...portable, ignored: true });
    expect(result).not.toHaveProperty('ignored');
    expect(result.config.models[0]).toMatchObject({
      reasoning: false,
      maxTokens: 4096,
      input: ['text'],
    });
  });

  it.each(['credential', undefined])('rejects any private apiKey property', (apiKey) => {
    expect(
      portableModelSchema.safeParse({ ...portable, config: { ...portable.config, apiKey } })
        .success,
    ).toBe(false);
  });

  it('retains provider and nested compatibility strictness', () => {
    expect(
      portableModelSchema.safeParse({ ...portable, config: { ...portable.config, unknown: true } })
        .success,
    ).toBe(false);
    expect(
      portableModelSchema.safeParse({
        ...portable,
        config: { ...portable.config, compat: { unknown: true } },
      }).success,
    ).toBe(false);
  });

  it('rejects credential-bearing endpoints without exposing their values', () => {
    const value = {
      ...portable,
      config: { ...portable.config, baseUrl: 'https://user:secret@example.com' },
    };
    const result = portableModelSchema.safeParse(value);
    expect(result.success).toBe(false);
    if (result.success) throw new Error('expected failure');
    expect(result.error.message).not.toContain('secret');
  });
});
