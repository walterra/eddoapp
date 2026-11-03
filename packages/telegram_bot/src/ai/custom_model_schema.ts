import {
  createSchemaParser,
  obj,
  opt,
  str,
  type SchemaIssue,
} from '@eddo/core-shared/validation/schema_parser';
import { customModelDefinition, publicProviderFields } from './custom_model_definition.js';
import { normalizeCustomModel, normalizeCustomProvider } from './custom_model_normalization.js';

/** Rejects credentials and non-HTTP endpoints without exposing their values. */
export function validateProviderEndpoint(value: string, path = '/baseUrl'): SchemaIssue[] {
  try {
    const url = new URL(value);
    if (
      ['http:', 'https:'].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
    )
      return [];
  } catch {
    // Malformed URLs share the same safe boundary diagnostic.
  }
  return [
    {
      path,
      code: 'format',
      message: 'Use a credential-free HTTP(S) endpoint without query parameters',
    },
  ];
}

export const customModelSchema = createSchemaParser(customModelDefinition, {
  normalize: normalizeCustomModel,
});
export const customProviderSchema = createSchemaParser(
  obj({ ...publicProviderFields, apiKey: opt(str()) }),
  {
    normalize: normalizeCustomProvider,
    validate: (value) => validateProviderEndpoint(value.baseUrl),
  },
);
export const publicProviderSchema = createSchemaParser(obj(publicProviderFields), {
  normalize: normalizeCustomProvider,
  validate: (value) => validateProviderEndpoint(value.baseUrl),
});
export type CustomProviderConfig = ReturnType<typeof customProviderSchema.parse>;
