import { describe, expect, it } from 'vitest';
import { createObjectProjection } from './object_projection';
import { arr, createSchemaParser, lit, obj, str, union } from './schema_parser';

describe('object projection', () => {
  it('projects nested objects and array items without mutating input', () => {
    const schema = obj({ entries: arr(obj({ name: str() })) });
    const input = { entries: [{ name: 'entry', private: true }], private: true };
    const projected = createObjectProjection(schema)(input);
    expect(projected).toEqual({ entries: [{ name: 'entry' }] });
    expect(input.entries[0].private).toBe(true);
  });

  it('selects and projects the valid tagged union branch', () => {
    const schema = union([obj({ kind: lit('web') }), obj({ kind: lit('telegram'), chat: str() })]);
    const parse = createSchemaParser(schema, { normalize: createObjectProjection(schema) });
    expect(parse.parse({ kind: 'telegram', chat: 'chat', private: true })).toEqual({
      kind: 'telegram',
      chat: 'chat',
    });
    expect(parse.safeParse({ kind: 'telegram' }).success).toBe(false);
    expect(parse.safeParse({ kind: 'other' }).success).toBe(false);
  });

  it('does not insert missing required fields or accept inherited ones', () => {
    const schema = obj({ name: str() });
    const parser = createSchemaParser(schema, { normalize: createObjectProjection(schema) });
    expect(parser.safeParse(Object.create({ name: 'inherited' })).success).toBe(false);
  });

  it.each([null, undefined, 1, 'string', []])('preserves invalid object input: %j', (value) => {
    expect(createObjectProjection(obj({ name: str() }))(value)).toBe(value);
  });

  it('rejects references instead of applying an incomplete projection', () => {
    expect(() => createObjectProjection({ $ref: '#/$defs/value' })).toThrow('inline schemas');
  });
});
