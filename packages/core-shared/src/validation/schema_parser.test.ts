import { describe, expect, it } from 'vitest';

import {
  createSchemaParser,
  int,
  obj,
  opt,
  projectProperties,
  SchemaValidationError,
  str,
} from './schema_parser';

const parser = createSchemaParser(obj({ name: str({ minLength: 1 }), count: opt(int()) }));

describe('createSchemaParser', () => {
  it('parses valid values without mutating them', () => {
    const value = Object.freeze({ name: 'test', count: 2 });
    expect(parser.parse(value)).toEqual(value);
  });

  it.each([
    { name: '' },
    { name: 'test', count: '2' },
    { name: 'test', count: 1.5 },
    { name: 'test', count: null },
    { name: 'test', extra: true },
    null,
  ])('rejects invalid input without coercion: %j', (value) => {
    expect(parser.safeParse(value).success).toBe(false);
    expect(() => parser.parse(value)).toThrow(SchemaValidationError);
  });

  it('enforces formats explicitly', () => {
    const uuid = createSchemaParser(str({ format: 'uuid' }));
    expect(uuid.safeParse('not-a-uuid').success).toBe(false);
    expect(uuid.safeParse('123e4567-e89b-42d3-a456-426614174000').success).toBe(true);
  });

  it('normalizes before validation', () => {
    const normalized = createSchemaParser(obj({ name: str() }), {
      normalize: (value) => projectProperties(value, ['name']),
    });
    expect(normalized.parse({ name: 'test', extra: true })).toEqual({ name: 'test' });
  });

  it('runs domain validation after structural validation', () => {
    const domain = createSchemaParser(str(), {
      validate: (value) =>
        value === 'allowed' ? [] : [{ path: '', code: 'domain', message: 'not allowed' }],
    });
    expect(domain.parse('allowed')).toBe('allowed');
    expect(domain.safeParse('other').success).toBe(false);
  });

  it('does not disguise programming errors as validation failures', () => {
    const broken = createSchemaParser(str(), {
      normalize: () => {
        throw new Error('normalizer failed');
      },
    });
    expect(() => broken.safeParse('test')).toThrow('normalizer failed');
  });

  it('does not retain rejected values in diagnostics', () => {
    const result = parser.safeParse({ name: 123, password: 'secret-value' });
    expect(result.success).toBe(false);
    if (result.success) throw new Error('expected failure');
    expect(result.error.issues.some((issue) => issue.path === '/name')).toBe(true);
    expect(JSON.stringify(result.error)).not.toContain('secret-value');
    expect(result.error.message).not.toContain('secret-value');
  });
});

describe('projectProperties', () => {
  it('retains own undefined fields and excludes inherited properties', () => {
    const value: unknown = Object.assign(Object.create({ name: 'inherited' }), {
      count: undefined,
    });
    expect(projectProperties(value, ['name', 'count'])).toEqual({ count: undefined });
  });

  it.each([null, undefined, 1, 'text', ['item']])('preserves non-object input: %j', (value) => {
    expect(projectProperties(value, ['name'])).toBe(value);
  });
});
