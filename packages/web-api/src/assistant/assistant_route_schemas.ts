import { uuidSchema, validateTextLength } from '@eddo/core-shared/validation/compatibility';
import {
  coerceNumber,
  createFieldNormalizer,
  trimString,
} from '@eddo/core-shared/validation/field_normalization';
import { createSchemaParser, int, obj, opt, str } from '@eddo/core-shared/validation/schema_parser';

export const requestIdentifierSchema = createSchemaParser(uuidSchema());
export const historySchema = createSchemaParser(
  obj({ limit: int({ minimum: 1, maximum: 50 }), cursor: opt(str({ maxLength: 4096 })) }),
  {
    normalize: createFieldNormalizer({
      fields: ['limit'],
      preserveUnknown: true,
      defaults: { limit: 30 },
      conversions: { limit: coerceNumber },
    }),
    validate: (value) =>
      value.cursor === undefined ? [] : validateTextLength(value.cursor, 4096, '/cursor'),
  },
);
export const submissionSchema = createSchemaParser(
  obj({ requestId: uuidSchema(), text: str({ minLength: 1, maxLength: 8000 }) }),
  {
    normalize: createFieldNormalizer({
      fields: ['text'],
      preserveUnknown: true,
      conversions: { text: trimString },
    }),
    validate: (value) => validateTextLength(value.text, 8000, '/text'),
  },
);
export const streamSchema = createSchemaParser(
  obj({ cursor: opt(str({ maxLength: 4096 })), requestIds: opt(str({ maxLength: 3000 })) }),
  {
    validate: (value) => [
      ...(value.cursor === undefined ? [] : validateTextLength(value.cursor, 4096, '/cursor')),
      ...(value.requestIds === undefined
        ? []
        : validateTextLength(value.requestIds, 3000, '/requestIds')),
    ],
  },
);
