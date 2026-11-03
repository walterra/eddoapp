import { createObjectProjection } from './object_projection';
import {
  createSchemaParser,
  type Schema,
  type SchemaParser,
  type SchemaParserOptions,
} from './schema_parser';

/** Parses boundaries that intentionally discard undeclared object properties. */
export function createProjectedParser<T>(
  schema: Schema<T>,
  options: SchemaParserOptions<T> = {},
): SchemaParser<T> {
  return createSchemaParser(schema, { normalize: createObjectProjection(schema), ...options });
}
