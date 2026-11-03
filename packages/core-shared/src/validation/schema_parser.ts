import { compile, type Schema, type ValidationError } from '@earendil-works/pi-schema';
import { formats } from '@earendil-works/pi-schema/formats';

export interface SchemaIssue {
  readonly path: string;
  readonly code: string;
  readonly message: string;
}

/** Reports validation failures without retaining rejected input. */
export class SchemaValidationError extends Error {
  readonly name = 'SchemaValidationError';
  readonly issues: readonly SchemaIssue[];

  constructor(issues: readonly SchemaIssue[]) {
    super(JSON.stringify(issues));
    this.issues = issues.map((issue) => ({ ...issue }));
  }
}

export type SchemaParseResult<T> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: SchemaValidationError };

export interface SchemaParser<T> {
  readonly schema: Schema<T>;
  readonly parse: (value: unknown) => T;
  readonly safeParse: (value: unknown) => SchemaParseResult<T>;
}

export interface SchemaParserOptions<T> {
  readonly normalize?: (value: unknown) => unknown;
  readonly validate?: (value: T) => readonly SchemaIssue[];
}

/** Converts JSON Schema failures into stable application diagnostics. */
function toIssue(error: ValidationError): SchemaIssue {
  return { path: error.path, code: error.keyword, message: error.message };
}

/** Compiles strict validation once and applies explicit boundary normalization. */
export function createSchemaParser<T>(
  schema: Schema<T>,
  options: SchemaParserOptions<T> = {},
): SchemaParser<T> {
  const validator = compile(schema, { formats });
  const parse = (input: unknown): T => {
    const value = options.normalize ? options.normalize(input) : input;
    if (!validator.check(value)) {
      const issues = validator.errors(value).map(toIssue);
      throw new SchemaValidationError(
        issues.length > 0
          ? issues
          : [{ path: '', code: 'invalid_value', message: 'invalid value' }],
      );
    }
    const issues = options.validate?.(value) ?? [];
    if (issues.length > 0) throw new SchemaValidationError(issues);
    return value;
  };
  const safeParse = (value: unknown): SchemaParseResult<T> => {
    try {
      return { success: true, data: parse(value) };
    } catch (error) {
      if (!(error instanceof SchemaValidationError)) throw error;
      return { success: false, error };
    }
  };
  return { schema, parse, safeParse };
}

/** Projects own properties without reading inherited fields or mutating input. */
export function projectProperties(value: unknown, keys: readonly string[]): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return value;
  const entries = keys
    .filter((key) => Object.hasOwn(value, key))
    .map((key) => [key, Reflect.get(value, key)]);
  return Object.fromEntries(entries);
}

export {
  arr,
  bool,
  lit,
  map,
  nullable,
  obj,
  oneOf,
  opt,
  str,
  union,
} from '@earendil-works/pi-schema';
export type { Schema, Static } from '@earendil-works/pi-schema';
export { int, num } from './number_schema';
