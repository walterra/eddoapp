import { describe, expect, it } from 'vitest';
import { clientEnvSchema } from './client-env';

describe('client environment compatibility', () => {
  it('supplies development by default and strips unrelated variables', () => {
    expect(clientEnvSchema.parse({ unrelated: true })).toEqual({ NODE_ENV: 'development' });
    expect(clientEnvSchema.parse({ NODE_ENV: undefined })).toEqual({ NODE_ENV: 'development' });
  });

  it.each(['development', 'production', 'test'])('accepts %s', (NODE_ENV) => {
    expect(clientEnvSchema.parse({ NODE_ENV })).toEqual({ NODE_ENV });
  });

  it.each([null, [], 'production', { NODE_ENV: null }, { NODE_ENV: 'invalid' }])(
    'rejects invalid configuration',
    (value) => {
      expect(clientEnvSchema.safeParse(value).success).toBe(false);
    },
  );
});
