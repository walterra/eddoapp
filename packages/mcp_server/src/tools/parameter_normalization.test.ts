import {
  createFieldNormalizer,
  trimString,
} from '@eddo/core-shared/validation/field_normalization';
import { arr, bool, obj, oneOf, str } from '@eddo/core-shared/validation/schema_parser';
import { describe, expect, it } from 'vitest';
import { toolField } from '../tool_field';
import { createToolParameters } from '../tool_parameters';

const publication = { target: 'draft-2020-12' };

describe('MCP parameter normalization', () => {
  it('composes custom normalization with canonical projection and defaults', () => {
    const parameters = createToolParameters(
      obj({
        title: str({ minLength: 1 }),
        include: toolField(bool(), { default: false }),
      }),
      {
        normalize: createFieldNormalizer({
          fields: ['title'],
          preserveUnknown: true,
          conversions: { title: trimString },
        }),
      },
    );
    expect(parameters.parse({ title: ' title ', extra: true })).toEqual({
      title: 'title',
      include: false,
    });
    expect(parameters.parse({ title: 'title', include: true }).include).toBe(true);
  });

  it('publishes defaulted inputs as optional while retaining normalized output requirements', () => {
    const parameters = createToolParameters(obj({ tags: toolField(arr(str()), { default: [] }) }));
    const first = parameters.parse({});
    expect(first.tags).not.toBe(parameters.parse({}).tags);
    expect(parameters['~standard'].jsonSchema.input(publication)).not.toHaveProperty('required');
    expect(parameters['~standard'].jsonSchema.output(publication)).toHaveProperty('required', [
      'tags',
    ]);
  });

  it('lets outer annotations override inner annotations without changing leading key order', () => {
    const field = toolField(str({ description: 'inner', default: 'inner' }), {
      default: 'outer',
      description: 'outer',
    });
    expect(Object.keys(field)).toEqual(['default', 'description', 'type']);
    expect(createToolParameters(obj({ title: field })).parse({}).title).toBe('outer');
  });

  it('does not mislabel numeric enumeration schemas as string inputs', () => {
    const parameters = createToolParameters(obj({ kind: oneOf([1, 2]) }));
    expect(parameters.parse({ kind: 1 }).kind).toBe(1);
    expect(parameters['~standard'].jsonSchema.input(publication)).not.toHaveProperty(
      'properties.kind.type',
    );
  });
});
