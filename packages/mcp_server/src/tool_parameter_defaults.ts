import { createFieldNormalizer } from '@eddo/core-shared/validation/field_normalization';
import type { InputNormalizer } from '@eddo/core-shared/validation/object_projection';
import type { Schema } from '@eddo/core-shared/validation/schema_parser';

/** Derives missing argument defaults from top-level tool field annotations. */
export function toolDefaultNormalizer<T>(schema: Schema<T>): InputNormalizer {
  const properties = schema.properties;
  if (typeof properties !== 'object' || properties === null || Array.isArray(properties)) {
    throw new Error('Tool parameters require declared object properties');
  }
  const defaults = Object.fromEntries(
    Object.entries(properties).flatMap(([key, field]) => {
      if (typeof field !== 'object' || field === null || !Object.hasOwn(field, 'default'))
        return [];
      return [[key, Reflect.get(field, 'default')]];
    }),
  );
  return createFieldNormalizer({ fields: Object.keys(properties), defaults });
}
