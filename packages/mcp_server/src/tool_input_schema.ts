import type { Schema } from '@eddo/core-shared/validation/schema_parser';

type SchemaEntry = [string, unknown];

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
  if (['anyOf', 'oneOf', 'allOf', 'prefixItems'].includes(key) && Array.isArray(value))
    return value.map(openInput);
  return ['items', 'additionalProperties'].includes(key) ? openInput(value) : value;
}

/** Omits required input fields supplied by explicit normalization defaults. */
function requiredInputs(schema: Record<string, unknown>, required: unknown): unknown {
  if (!Array.isArray(required) || !isObject(schema.properties)) return required;
  const properties = schema.properties;
  return required.filter((key: unknown) => {
    if (typeof key !== 'string') return true;
    const field = properties[key];
    return !isObject(field) || !Object.hasOwn(field, 'default') || field.default === undefined;
  });
}

/** Omits runtime-only bounds and redundant closed-object input assertions. */
function keepKeyword(key: string, value: unknown): boolean {
  if (key === 'additionalProperties' && value === false) return false;
  if (key === 'required' && Array.isArray(value) && value.length === 0) return false;
  if (key === 'minimum' && value === -Number.MAX_VALUE) return false;
  return !(key === 'maximum' && value === Number.MAX_VALUE);
}

/** Identifies string-only enumeration schemas without narrowing other enum types. */
function isStringEnum(value: unknown): boolean {
  return Array.isArray(value) && value.every((item: unknown) => typeof item === 'string');
}

/** Retains historical string-enum and string-record publication shapes. */
function inputEntry(schema: Record<string, unknown>, key: string, value: unknown): SchemaEntry[] {
  const converted = key === 'required' ? requiredInputs(schema, value) : inputKeyword(key, value);
  if (!keepKeyword(key, converted)) return [];
  if (key === 'enum' && !Object.hasOwn(schema, 'type') && isStringEnum(value))
    return [
      ['type', 'string'],
      [key, converted],
    ];
  if (
    key === 'additionalProperties' &&
    !Object.hasOwn(schema, 'properties') &&
    !Object.hasOwn(schema, 'propertyNames') &&
    isObject(value)
  ) {
    return [
      ['propertyNames', { type: 'string' }],
      [key, converted],
    ];
  }
  return [[key, converted]];
}

/** Advertises strip-on-parse objects as open inputs, matching the previous MCP contract. */
function openInput(schema: unknown): unknown {
  if (!isObject(schema)) return schema;
  return Object.fromEntries(
    Object.entries(schema).flatMap(([key, value]) => inputEntry(schema, key, value)),
  );
}

/** Derives the published input contract from the parser's canonical schema. */
export function toolInputSchema<T>(schema: Schema<T>): Record<string, unknown> {
  const input = openInput(schema);
  if (!isObject(input)) throw new Error('Tool input requires an object schema');
  return { $schema: 'https://json-schema.org/draft/2020-12/schema', ...input };
}
