import type { AssistantRequest } from '@eddo/core-shared';
import { utcDateTimeSchema } from '@eddo/core-shared/validation/compatibility';
import { createObjectProjection } from '@eddo/core-shared/validation/object_projection';
import {
  createSchemaParser,
  int,
  lit,
  num,
  obj,
  oneOf,
  opt,
  str,
  union,
} from '@eddo/core-shared/validation/schema_parser';

const telegramMetadata = obj({
  chatId: int({ minimum: 1, maximum: Number.MAX_SAFE_INTEGER }),
  userId: int({ minimum: 1, maximum: Number.MAX_SAFE_INTEGER }),
  messageId: opt(int({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER })),
});
const requestDefinition = obj({
  account: obj({ username: str({ minLength: 1 }) }),
  requestId: str({ minLength: 1 }),
  conversationId: str({ minLength: 1 }),
  text: str({ minLength: 1 }),
  source: union([
    obj({ channel: lit('web') }),
    obj({ channel: lit('telegram'), telegram: telegramMetadata }),
  ]),
  createdAt: utcDateTimeSchema(),
  deadline: num({ exclusiveMinimum: 0 }),
  report: opt(obj({ type: oneOf(['briefing', 'recap']), occurrence: str({ minLength: 1 }) })),
});
const assistantRequestSchema = createSchemaParser(requestDefinition, {
  normalize: createObjectProjection(requestDefinition),
});

/** Validates channel-neutral requests before admission or resumed tool authorization. */
export function parseAssistantRequest(value: unknown): AssistantRequest {
  return assistantRequestSchema.parse(value);
}
