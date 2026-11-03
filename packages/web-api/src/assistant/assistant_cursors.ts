import { validateTextLength } from '@eddo/core-shared/validation/compatibility';
import {
  createSchemaParser,
  lit,
  num,
  obj,
  str,
  tuple,
} from '@eddo/core-shared/validation/schema_parser';
import { AssistantApiError } from './assistant_errors';

const envelope = { version: lit(1), username: str({ minLength: 1 }) };
const changeSchema = createSchemaParser(
  obj({ ...envelope, sequence: str({ minLength: 1, maxLength: 2048 }) }),
  { validate: (value) => validateTextLength(value.sequence, 2048, '/sequence') },
);
const historySchema = createSchemaParser(
  obj({
    ...envelope,
    conversationId: str({ minLength: 1 }),
    key: tuple([num({ minimum: 0 }), str(), str({ minLength: 1 })]),
  }),
);
export type AssistantHistoryKey = ReturnType<typeof historySchema.parse>['key'];

function decode(cursor: string): unknown {
  try {
    if (cursor.length > 4096 || !/^[A-Za-z0-9_-]+$/.test(cursor)) throw new Error('Invalid cursor');
    return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as unknown;
  } catch {
    throw new AssistantApiError(400, 'invalid_request');
  }
}

export function changeCursor(username: string, sequence: string): string {
  return Buffer.from(JSON.stringify({ version: 1, username, sequence })).toString('base64url');
}

/** Binds reconnect cursors to the authenticated account rather than a client-selected database. */
export function readChangeCursor(username: string, cursor: string): string {
  const parsed = changeSchema.safeParse(decode(cursor));
  if (!parsed.success || parsed.data.username !== username)
    throw new AssistantApiError(400, 'invalid_request');
  return parsed.data.sequence;
}

export function historyCursor(
  username: string,
  conversationId: string,
  key: AssistantHistoryKey,
): string {
  return Buffer.from(JSON.stringify({ version: 1, username, conversationId, key })).toString(
    'base64url',
  );
}

/** Rejects pagination cursors reused across accounts or active conversations. */
export function readHistoryCursor(
  username: string,
  conversationId: string,
  cursor: string,
): AssistantHistoryKey {
  const parsed = historySchema.safeParse(decode(cursor));
  if (
    !parsed.success ||
    parsed.data.username !== username ||
    parsed.data.conversationId !== conversationId
  )
    throw new AssistantApiError(400, 'invalid_request');
  return parsed.data.key;
}
