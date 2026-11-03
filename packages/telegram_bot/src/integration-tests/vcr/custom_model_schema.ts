import {
  createSchemaParser,
  lit,
  obj,
  projectProperties,
  str,
} from '@eddo/core-shared/validation/schema_parser';
import { normalizeCustomProvider } from '../../ai/custom_model_normalization.js';
import { publicProviderSchema, validateProviderEndpoint } from '../../ai/custom_model_schema.js';

/** Projects the portable envelope while keeping provider fields strict. */
function normalizePortable(value: unknown): unknown {
  const projected = projectProperties(value, ['version', 'provider', 'config']);
  if (typeof projected !== 'object' || projected === null || Array.isArray(projected))
    return projected;
  if (!Object.hasOwn(projected, 'config')) return projected;
  return { ...projected, config: normalizeCustomProvider(Reflect.get(projected, 'config')) };
}

/** Stores only the selected model's public configuration, never authentication. */
export const portableModelSchema = createSchemaParser(
  obj({ version: lit(1), provider: str({ minLength: 1 }), config: publicProviderSchema.schema }),
  {
    normalize: normalizePortable,
    validate: (value) => validateProviderEndpoint(value.config.baseUrl, '/config/baseUrl'),
  },
);
export type PortableModelConfig = ReturnType<typeof portableModelSchema.parse>;
