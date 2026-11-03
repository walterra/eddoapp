import { createObjectProjection } from '@eddo/core-shared/validation/object_projection';
import {
  createSchemaParser,
  type Schema,
  type SchemaParserOptions,
} from '@eddo/core-shared/validation/schema_parser';
import {
  toStandardSchema,
  type StandardBoundaryParser,
} from '@eddo/core-shared/validation/standard_schema';

import { toolInputSchema } from './tool_input_schema.js';
import { toolDefaultNormalizer } from './tool_parameter_defaults.js';

/** Publishes and validates tool arguments with explicit projection of undeclared fields. */
export function createToolParameters<T>(
  schema: Schema<T>,
  options: SchemaParserOptions<T> = {},
): StandardBoundaryParser<T> {
  const project = createObjectProjection(schema);
  const defaults = toolDefaultNormalizer(schema);
  return toStandardSchema(
    createSchemaParser(schema, {
      ...options,
      normalize: (value) => defaults(project(options.normalize ? options.normalize(value) : value)),
    }),
    { input: toolInputSchema(schema) },
  );
}
