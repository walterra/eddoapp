import { describe, expect, it } from 'vitest';
import { createSchemaParser, obj, oneOf, str } from './schema_parser';
import { toStandardSchema } from './standard_schema';

describe('Standard Schema adapter', () => {
  const parser = createSchemaParser(obj({ 'a/b~c': str() }));
  const standard = toStandardSchema(parser)['~standard'];

  it('publishes the schema used for validation', () => {
    const options = { target: 'draft-2020-12' };
    expect(standard.jsonSchema.input(options)).toEqual(parser.schema);
    expect(standard.jsonSchema.output(options)).toEqual(parser.schema);
    expect(standard.jsonSchema.input(options)).not.toBe(parser.schema);
  });

  it('returns validated values', async () => {
    expect(await standard.validate({ 'a/b~c': 'value' })).toEqual({ value: { 'a/b~c': 'value' } });
  });

  it('decodes escaped JSON Pointer segments in validation errors', async () => {
    const result = await standard.validate({ 'a/b~c': 123 });
    expect(result.issues).toContainEqual({
      path: ['a/b~c'],
      message: expect.any(String),
    });
  });

  it('preserves the existing MCP invalid-option diagnostic', async () => {
    const choices = toStandardSchema(createSchemaParser(oneOf(['overview', 'all'])));
    const result = await choices['~standard'].validate('unsupported');
    expect(result.issues?.[0].message).toContain('Invalid option');
    expect(result.issues?.[0].message).not.toContain('unsupported');
  });

  it('rejects unsupported publication targets', () => {
    expect(() => standard.jsonSchema.input({ target: 'draft-07' })).toThrow('Unsupported');
  });

  it('does not disguise normalization exceptions as invalid input', () => {
    const broken = toStandardSchema(
      createSchemaParser(str(), {
        normalize: () => {
          throw new Error('bug');
        },
      }),
    );
    expect(() => broken['~standard'].validate('input')).toThrow('bug');
  });
});
