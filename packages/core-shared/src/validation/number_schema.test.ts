import { describe, expect, it } from 'vitest';
import { createSchemaParser, int, num } from './schema_parser';

describe('application numeric schemas', () => {
  it.each([Number.NaN, Infinity, -Infinity, '1', null])(
    'rejects non-finite or non-number values: %j',
    (value) => {
      const result = createSchemaParser(num()).safeParse(value);
      expect(result.success).toBe(false);
      if (result.success) throw new Error('expected failure');
      expect(result.error.issues.length).toBeGreaterThan(0);
    },
  );

  it.each([0, -0, 1.5, -1.5, Number.MAX_VALUE, -Number.MAX_VALUE])(
    'accepts finite numbers: %j',
    (value) => {
      expect(createSchemaParser(num()).parse(value)).toBe(value);
    },
  );

  it.each([Number.MAX_SAFE_INTEGER + 1, -Number.MAX_SAFE_INTEGER - 1, 1.5, Infinity, Number.NaN])(
    'rejects unsafe or fractional integers: %j',
    (value) => {
      expect(createSchemaParser(int()).safeParse(value).success).toBe(false);
    },
  );

  it('preserves tighter caller bounds', () => {
    const parser = createSchemaParser(int({ minimum: 1, maximum: 5 }));
    expect(parser.parse(3)).toBe(3);
    expect(parser.safeParse(0).success).toBe(false);
    expect(parser.safeParse(6).success).toBe(false);
  });

  it('does not widen integer safety when callers supply wider bounds', () => {
    const parser = createSchemaParser(
      int({ minimum: -Number.MAX_VALUE, maximum: Number.MAX_VALUE }),
    );
    expect(parser.safeParse(Number.MAX_SAFE_INTEGER + 1).success).toBe(false);
  });
});
