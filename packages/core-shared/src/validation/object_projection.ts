import { compile, type JsonSchema } from '@earendil-works/pi-schema';
import { formats } from '@earendil-works/pi-schema/formats';

export type InputNormalizer = (value: unknown) => unknown;

/** Identifies schema and input objects without accepting arrays or null. */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Projects declared object properties recursively without coercing or supplying defaults. */
export function createObjectProjection(schema: JsonSchema): InputNormalizer {
  if (!isObject(schema)) return (value) => value;
  if ('$ref' in schema || '$dynamicRef' in schema) {
    throw new Error('Object projection requires inline schemas');
  }
  if (Array.isArray(schema.anyOf)) return projectUnion(schema.anyOf);
  if (isObject(schema.properties)) return projectObject(schema.properties);
  if (isObject(schema.items)) {
    const projectItem = createObjectProjection(schema.items);
    return (value) => (Array.isArray(value) ? value.map(projectItem) : value);
  }
  return (value) => value;
}

/** Selects the first projected union branch that satisfies structural validation. */
function projectUnion(schemas: readonly JsonSchema[]): InputNormalizer {
  const branches = schemas.map((schema) => ({
    normalize: createObjectProjection(schema),
    validator: compile(schema, { formats }),
  }));
  return (value) => {
    for (const branch of branches) {
      const candidate = branch.normalize(value);
      if (branch.validator.check(candidate)) return candidate;
    }
    return value;
  };
}

/** Selects own declared fields and retains explicit undefined values. */
function projectObject(properties: Record<string, unknown>): InputNormalizer {
  const fields = Object.entries(properties).map(([key, schema]) => ({
    key,
    normalize: createObjectProjection(isObject(schema) ? schema : true),
  }));
  return (value) => {
    if (!isObject(value)) return value;
    return Object.fromEntries(
      fields
        .filter(({ key }) => Object.hasOwn(value, key))
        .map(({ key, normalize }) => [key, normalize(value[key])]),
    );
  };
}
