import { describe, expect, it } from 'vitest';
import { jsonValueSchema } from './json_value';
import { createSchemaParser, obj, opt } from './schema_parser';

describe('JSON value schemas', () => {
  const parser = createSchemaParser(jsonValueSchema);

  it.each([null, true, 0, 'text', [], {}, { items: [1, null, { value: false }] }])(
    'accepts JSON values: %j',
    (value) => {
      expect(parser.parse(value)).toEqual(value);
    },
  );

  it.each([
    undefined,
    Number.NaN,
    Infinity,
    { value: undefined },
    [undefined],
    { value: Infinity },
  ])('rejects non-JSON values', (value) => {
    expect(parser.safeParse(value).success).toBe(false);
  });

  it('resolves recursive references when nested inside another schema', () => {
    const nested = createSchemaParser(obj({ data: opt(jsonValueSchema) }));
    expect(nested.parse({ data: { nested: [null, { value: 2 }] } })).toEqual({
      data: { nested: [null, { value: 2 }] },
    });
    expect(nested.parse({})).toEqual({});
    expect(nested.safeParse({ data: { nested: [Infinity] } }).success).toBe(false);
  });
});
