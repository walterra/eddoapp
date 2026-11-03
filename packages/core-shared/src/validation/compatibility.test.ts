import { describe, expect, it } from 'vitest';
import { utcDateTimeSchema } from './compatibility';
import { createSchemaParser } from './schema_parser';

describe('UTC timestamp compatibility', () => {
  const parser = createSchemaParser(utcDateTimeSchema());

  it.each([
    '2024-02-29T12:34:56Z',
    '2024-02-29T12:34:56.123456Z',
    '0000-01-01T00:00:00Z',
    '2000-02-29T00:00:00Z',
  ])('accepts UTC timestamps: %s', (value) => {
    expect(parser.parse(value)).toBe(value);
  });

  it.each([
    '2023-02-29T12:34:56Z',
    '1900-02-29T00:00:00Z',
    '2024-01-01T24:00:00Z',
    '2024-01-01T23:59:60Z',
    '2024-01-01t12:34:56z',
    '2024-01-01T12:34Z',
    '2024-01-01T12:34:56+00:00',
    '2024-01-01T12:34:56',
  ])('rejects previously invalid timestamps: %s', (value) => {
    expect(parser.safeParse(value).success).toBe(false);
  });
});
