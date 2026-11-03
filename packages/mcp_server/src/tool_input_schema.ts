import type { Schema } from '@eddo/core-shared/validation/schema_parser';

/** Identifies schema objects without interpreting arrays as property maps. */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Converts nested input schemas without modifying annotations or example payloads. */
function inputKeyword(key: string, value: unknown): unknown {
  if (key === 'properties' && isObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([name, schema]) => [name, openInput(schema)]),
    );
  }
  if (['anyOf', 'oneOf', 'allOf', 'prefixItems'].includes(key) && Array.isArray(value)) {
    return value.map(openInput);
  }
  return ['items', 'additionalProperties'].includes(key) ? openInput(value) : value;
}

/** Advertises strip-on-parse objects as open inputs, matching the previous MCP contract. */
function openInput(schema: unknown): unknown {
  if (!isObject(schema)) return schema;
  return Object.fromEntries(
    Object.entries(schema)
      .filter(([key, value]) => !(key === 'additionalProperties' && value === false))
      .filter(([key, value]) => !(key === 'required' && Array.isArray(value) && value.length === 0))
      .map(([key, value]) => [key, inputKeyword(key, value)]),
  );
}

/** Derives the published input contract from the parser's canonical schema. */
export function toolInputSchema<T>(schema: Schema<T>): Record<string, unknown> {
  const input = openInput(schema);
  if (!isObject(input)) throw new Error('Tool input requires an object schema');
  return { $schema: 'https://json-schema.org/draft/2020-12/schema', ...input };
}
