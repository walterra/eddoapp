import { describe, expect, it } from 'vitest';
import { validateEnv } from './env';

describe('environment configuration compatibility', () => {
  const base = { COUCHDB_URL: 'http://localhost:5984' };

  it('supplies existing defaults and strips unrelated environment variables', () => {
    const result = validateEnv({ ...base, PRIVATE_UNRELATED_KEY: 'ignored' });
    expect(result).toMatchObject({
      ...base,
      NODE_ENV: 'development',
      LOG_LEVEL: 'info',
      COUCHDB_DB_NAME: 'todos-dev',
      DATABASE_PREFIX: 'eddo',
      MCP_SERVER_PORT: 3001,
      PORT: 3000,
      CLAUDE_CODE_SESSION_TIMEOUT: 3600,
      BOT_PERSONA_ID: 'butler',
    });
    expect(result).not.toHaveProperty('PRIVATE_UNRELATED_KEY');
    expect(result).not.toHaveProperty('JWT_SECRET');
  });

  it('preserves explicitly undefined optional fields', () => {
    expect(validateEnv({ ...base, JWT_SECRET: undefined })).toHaveProperty('JWT_SECRET', undefined);
  });

  it.each([
    ['4000', 4000],
    ['', 0],
    [null, 0],
    [true, 1],
    ['1.5', 1.5],
  ])('preserves explicit numeric coercion: %j', (value, expected) => {
    expect(validateEnv({ ...base, PORT: value }).PORT).toBe(expected);
  });

  it.each(['invalid', 'Infinity', Number.NaN, Symbol('secret')])(
    'rejects invalid numeric values',
    (PORT) => {
      expect(() => validateEnv({ ...base, PORT })).toThrow();
    },
  );

  it('defaults undefined numeric settings', () => {
    expect(validateEnv({ ...base, PORT: undefined }).PORT).toBe(3000);
  });

  it.each([{}, null, [], { COUCHDB_URL: 123 }, { ...base, NODE_ENV: 'unknown' }])(
    'rejects invalid configuration: %j',
    (value) => {
      expect(() => validateEnv(value)).toThrow();
    },
  );

  it('preserves the UTF-16 secret minimum without including the secret in errors', () => {
    expect(validateEnv({ ...base, JWT_SECRET: '😀'.repeat(16) }).JWT_SECRET).toBe('😀'.repeat(16));
    expect(() => validateEnv({ ...base, JWT_SECRET: 'secret-marker' })).toThrow('at least 32');
    expect(() => validateEnv({ ...base, JWT_SECRET: 'secret-marker' })).not.toThrow(
      'secret-marker',
    );
  });

  it('does not mutate its input', () => {
    const value = Object.freeze({ ...base, PORT: '4000' });
    expect(validateEnv(value).PORT).toBe(4000);
    expect(value.PORT).toBe('4000');
  });
});
