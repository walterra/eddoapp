import type {
  SchemaIssue,
  SchemaValidationError,
} from '@eddo/core-shared/validation/schema_parser';

export interface ApiValidationIssue {
  readonly code: string;
  readonly path: readonly (string | number)[];
  readonly message: string;
}
const issueCodes: Readonly<Record<string, string>> = {
  type: 'invalid_type',
  required: 'invalid_type',
  minimum: 'too_small',
  exclusiveMinimum: 'too_small',
  minLength: 'too_small',
  minItems: 'too_small',
  maximum: 'too_big',
  exclusiveMaximum: 'too_big',
  maxLength: 'too_big',
  maxItems: 'too_big',
  enum: 'invalid_value',
  const: 'invalid_value',
  pattern: 'invalid_format',
  format: 'invalid_format',
  additionalProperties: 'unrecognized_keys',
};

/** Retains array paths and validation categories without exposing rejected input or validator internals. */
function apiIssue(issue: SchemaIssue): ApiValidationIssue {
  const path =
    issue.path === ''
      ? []
      : issue.path
          .slice(1)
          .split('/')
          .map((segment) => {
            const key = segment.replace(/~1/g, '/').replace(/~0/g, '~');
            return /^(0|[1-9][0-9]*)$/.test(key) && Number.isSafeInteger(Number(key))
              ? Number(key)
              : key;
          });
  return { code: issueCodes[issue.code] ?? 'custom', path, message: issue.message };
}

/** Formats vendor-neutral API details with the existing code/path/message envelope. */
export function validationDetails(error: SchemaValidationError): ApiValidationIssue[] {
  return error.issues.map(apiIssue);
}
