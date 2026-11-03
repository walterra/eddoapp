import type { StandardJSONSchemaV1, StandardSchemaV1 } from '@standard-schema/spec';

import type { SchemaParser } from './schema_parser';

export type StandardBoundarySchema<T> = StandardSchemaV1<unknown, T> &
  StandardJSONSchemaV1<unknown, T>;

export type StandardBoundaryParser<T> = StandardBoundarySchema<T> & SchemaParser<T>;

export interface SchemaPublication {
  readonly input?: Record<string, unknown>;
  readonly output?: Record<string, unknown>;
}

/** Decodes JSON Pointer segments without treating numeric object keys as array indices. */
function pointerSegments(pointer: string): string[] {
  return pointer === ''
    ? []
    : pointer
        .slice(1)
        .split('/')
        .map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'));
}

/** Adapts boundary validation and JSON Schema publication for MCP registration. */
export function toStandardSchema<T>(
  parser: SchemaParser<T>,
  publication: SchemaPublication = {},
): StandardBoundaryParser<T> {
  const jsonSchema = (
    options: StandardJSONSchemaV1.Options,
    schema: Record<string, unknown> = parser.schema,
  ): Record<string, unknown> => {
    if (options.target !== 'draft-2020-12') {
      throw new Error(`Unsupported JSON Schema target: ${options.target}`);
    }
    return structuredClone(schema);
  };
  return {
    ...parser,
    '~standard': {
      version: 1,
      vendor: 'eddo/pi-schema',
      validate: (value) => {
        const result = parser.safeParse(value);
        return result.success
          ? { value: result.data }
          : {
              issues: result.error.issues.map((issue) => ({
                path: pointerSegments(issue.path),
                message: issue.message,
              })),
            };
      },
      jsonSchema: {
        input: (options) => jsonSchema(options, publication.input),
        output: (options) => jsonSchema(options, publication.output),
      },
    },
  };
}
