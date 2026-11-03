import {
  validateAbsoluteUrl,
  validateMinimumTextLength,
} from '@eddo/core-shared/validation/compatibility';
import {
  coerceNumber,
  createFieldNormalizer,
  trimString,
} from '@eddo/core-shared/validation/field_normalization';
import {
  createSchemaParser,
  int,
  obj,
  opt,
  str,
  type SchemaIssue,
} from '@eddo/core-shared/validation/schema_parser';

const telegramFields = {
  TELEGRAM_BOT_TOKEN: opt(str({ minLength: 1 })),
  EDDO_MODELS_FILE: opt(str({ minLength: 1 })),
  ASSISTANT_INTERNAL_TOKEN: opt(str()),
  ASSISTANT_INTERNAL_PORT: int({ minimum: 1, maximum: 65535 }),
  WEB_API_BASE_URL: str(),
  TELEGRAM_LOG_USER_DETAILS: str(),
};
const telegramParser = createSchemaParser(obj(telegramFields), {
  normalize: createFieldNormalizer({
    fields: Object.keys(telegramFields),
    defaults: {
      ASSISTANT_INTERNAL_PORT: 3003,
      WEB_API_BASE_URL: 'http://localhost:3000',
      TELEGRAM_LOG_USER_DETAILS: 'false',
    },
    conversions: { ASSISTANT_INTERNAL_PORT: coerceNumber, EDDO_MODELS_FILE: trimString },
  }),
  validate: validateTelegramFields,
});
interface TelegramInput {
  TELEGRAM_BOT_TOKEN?: string;
  EDDO_MODELS_FILE?: string;
  ASSISTANT_INTERNAL_TOKEN?: string;
  ASSISTANT_INTERNAL_PORT: number;
  WEB_API_BASE_URL: string;
  TELEGRAM_LOG_USER_DETAILS: string;
}
export interface TelegramConfig extends Omit<TelegramInput, 'TELEGRAM_LOG_USER_DETAILS'> {
  TELEGRAM_LOG_USER_DETAILS: boolean;
}

/** Requires an admission credential and validates service endpoints after structural checks. */
function validateTelegramFields(value: TelegramInput): SchemaIssue[] {
  return [
    ...validateAbsoluteUrl(value.WEB_API_BASE_URL, '/WEB_API_BASE_URL'),
    ...(value.ASSISTANT_INTERNAL_TOKEN === undefined
      ? []
      : validateMinimumTextLength(value.ASSISTANT_INTERNAL_TOKEN, 32, '/ASSISTANT_INTERNAL_TOKEN')),
    ...(value.TELEGRAM_BOT_TOKEN || value.ASSISTANT_INTERNAL_TOKEN
      ? []
      : [
          {
            path: '',
            code: 'credential_required',
            message: 'Configure TELEGRAM_BOT_TOKEN or ASSISTANT_INTERNAL_TOKEN',
          },
        ]),
  ];
}

/** Parses environment fields before applying the historical case-insensitive boolean conversion. */
export function parseTelegramConfig(input: unknown): TelegramConfig {
  const value = telegramParser.parse(input);
  return {
    ...value,
    TELEGRAM_LOG_USER_DETAILS: value.TELEGRAM_LOG_USER_DETAILS.toLowerCase() === 'true',
  };
}
