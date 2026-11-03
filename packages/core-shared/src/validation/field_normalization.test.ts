import { describe, expect, it } from 'vitest';
import { coerceNumber, createFieldNormalizer, trimString } from './field_normalization';

describe('field normalization', () => {
  const normalize = createFieldNormalizer({
    fields: ['name', 'port', 'token'],
    defaults: { name: 'default', port: 3000 },
    conversions: { port: coerceNumber, token: trimString },
  });

  it('projects unknown fields and supplies missing defaults', () => {
    expect(normalize({ extra: 'ignored' })).toEqual({ name: 'default', port: 3000 });
  });

  it('applies defaults to undefined but not null or empty values', () => {
    expect(normalize({ name: undefined, port: undefined })).toEqual({
      name: 'default',
      port: 3000,
    });
    expect(normalize({ name: null, port: '' })).toEqual({ name: null, port: 0 });
  });

  it('converts only explicitly selected fields without mutating input', () => {
    const value = Object.freeze({ name: ' name ', port: '4000', token: ' token ' });
    expect(normalize(value)).toEqual({ name: ' name ', port: 4000, token: 'token' });
    expect(value.token).toBe(' token ');
  });

  it('copies mutable default values for each parse', () => {
    const defaults = { tags: ['default'] };
    const project = createFieldNormalizer({ fields: ['tags'], defaults });
    const first = project({});
    const second = project({});
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    if (!first || typeof first !== 'object' || !('tags' in first)) throw new Error('missing tags');
    expect(first.tags).not.toBe(defaults.tags);
  });

  it('ignores inherited source properties', () => {
    expect(normalize(Object.create({ name: 'inherited' }))).toEqual({
      name: 'default',
      port: 3000,
    });
  });

  it.each([null, undefined, 3, 'value', ['array']])(
    'preserves malformed root input: %j',
    (value) => {
      expect(normalize(value)).toBe(value);
    },
  );

  it('retains unknown fields for boundaries that reject them after normalization', () => {
    const normalizeStrict = createFieldNormalizer({
      fields: ['port'],
      defaults: { port: 3000 },
      conversions: { port: coerceNumber },
      preserveUnknown: true,
    });
    expect(normalizeStrict({ port: '4000', unknown: true })).toEqual({ port: 4000, unknown: true });
    expect(normalizeStrict({ unknown: true })).toEqual({ port: 3000, unknown: true });
  });

  it('preserves failed conversion as a non-finite value for structural rejection', () => {
    expect(coerceNumber(Symbol('private'))).toBeNaN();
    expect(coerceNumber('invalid')).toBeNaN();
    expect(trimString(123)).toBe(123);
  });
});
