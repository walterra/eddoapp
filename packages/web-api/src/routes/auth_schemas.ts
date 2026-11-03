import {
  emailSchema,
  validateMinimumTextLength,
  validateTextLength,
} from '@eddo/core-shared/validation/compatibility';
import { createFieldNormalizer } from '@eddo/core-shared/validation/field_normalization';
import { createProjectedParser } from '@eddo/core-shared/validation/projected_parser';
import { bool, num, obj, opt, str } from '@eddo/core-shared/validation/schema_parser';

export const loginSchema = createProjectedParser(
  obj({ username: str({ minLength: 1 }), password: str({ minLength: 1 }), rememberMe: bool() }),
  {
    normalize: createFieldNormalizer({
      fields: ['username', 'password', 'rememberMe'],
      defaults: { rememberMe: false },
    }),
  },
);
export const registerSchema = createProjectedParser(
  obj({
    username: str({ minLength: 1, maxLength: 20 }),
    email: emailSchema(),
    password: str(),
    telegramId: opt(num()),
    rememberMe: bool(),
  }),
  {
    normalize: createFieldNormalizer({
      fields: ['username', 'email', 'password', 'telegramId', 'rememberMe'],
      defaults: { rememberMe: false },
    }),
    validate: (value) => [
      ...validateMinimumTextLength(value.username, 3, '/username'),
      ...validateTextLength(value.username, 20, '/username'),
      ...validateMinimumTextLength(value.password, 8, '/password'),
    ],
  },
);
export const linkTelegramSchema = createProjectedParser(
  obj({ linkCode: str({ minLength: 1 }), telegramId: num() }),
);
