import { str, type Schema, type SchemaIssue } from './schema_parser';

const RFC_UUID_PATTERN =
  '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$';

/** Preserves RFC UUID version and variant checks, including nil and max identifiers. */
export function uuidSchema(): Schema<string> {
  return str({ format: 'uuid', pattern: RFC_UUID_PATTERN });
}

/** Restricts date-time values to UTC, four-digit years, and non-leap seconds. */
export function utcDateTimeSchema(): Schema<string> {
  return str({
    format: 'date-time',
    pattern: '^\\d{4}-\\d{2}-\\d{2}T(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?Z$',
  });
}

/** Preserves UTF-16 minimum lengths for validated string fields. */
export function validateMinimumTextLength(
  value: string,
  minimum: number,
  path: string,
): SchemaIssue[] {
  return value.length >= minimum
    ? []
    : [{ path, code: 'minLength', message: `expected at least ${minimum} UTF-16 code units` }];
}

/** Preserves existing UTF-16 length limits instead of JSON Schema code-point limits. */
export function validateTextLength(value: string, maximum: number, path: string): SchemaIssue[] {
  return value.length <= maximum
    ? []
    : [{ path, code: 'maxLength', message: `expected at most ${maximum} UTF-16 code units` }];
}
