import {
  receiptDefinition,
  validateReceipt,
} from '@eddo/core-shared/validation/assistant_receipts';
import {
  utcDateTimeSchema,
  uuidSchema,
  validateTextLength,
} from '@eddo/core-shared/validation/compatibility';
import { createProjectedParser } from '@eddo/core-shared/validation/projected_parser';
import {
  arr,
  bool,
  lit,
  nullable,
  num,
  obj,
  oneOf,
  opt,
  str,
} from '@eddo/core-shared/validation/schema_parser';

export {
  receiptSchema,
  sharedRequestsSchema,
} from '@eddo/core-shared/validation/assistant_receipts';

const conversation = obj({
  _id: str(),
  _rev: opt(str()),
  version: lit('assistant_conversation_alpha1'),
  username: str(),
  active: bool(),
  title: opt(str()),
  createdAt: str(),
  updatedAt: str(),
  stats: obj({ messageCount: num(), userMessageCount: num(), assistantMessageCount: num() }),
});
const message = obj({
  _id: str(),
  _rev: opt(str()),
  version: lit('assistant_conversation_message_alpha1'),
  conversationId: str(),
  role: oneOf(['user', 'assistant']),
  content: str(),
  channel: oneOf(['web', 'telegram']),
  createdAt: str(),
  sequence: num(),
});
export const historySchema = createProjectedParser(
  obj({
    conversation: nullable(conversation),
    messages: arr(message),
    nextCursor: nullable(str()),
    changeCursor: str(),
  }),
);
export const pendingSchema = createProjectedParser(
  obj({
    username: str(),
    submissionId: uuidSchema(),
    text: str({ minLength: 1, maxLength: 8000 }),
    createdAt: utcDateTimeSchema(),
    conversationId: nullable(str()),
    projectionIds: obj({
      user: str({ pattern: '^assistant_message_durable_[a-f0-9]{64}_user$' }),
      assistant: str({ pattern: '^assistant_message_durable_[a-f0-9]{64}_assistant$' }),
    }),
    receipt: opt(receiptDefinition),
    cancelRequested: opt(bool()),
  }),
  {
    validate: (value) => [
      ...validateTextLength(value.text, 8000, '/text'),
      ...(value.receipt ? validateReceipt(value.receipt, '/receipt') : []),
    ],
  },
);
