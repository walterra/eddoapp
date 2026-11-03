import { validateTextLength } from '@eddo/core-shared/validation/compatibility';
import { createProjectedParser } from '@eddo/core-shared/validation/projected_parser';
import {
  arr,
  bool,
  createSchemaParser,
  lit,
  num,
  obj,
  oneOf,
  opt,
  str,
  union,
  type SchemaIssue,
} from '@eddo/core-shared/validation/schema_parser';

const id = str({ minLength: 1, maxLength: 256 });
const telegram = obj({ chatId: num(), userId: num(), messageId: opt(num()) });
export const conversationSchema = createProjectedParser(
  obj({
    _id: id,
    _rev: opt(str()),
    version: lit('assistant_conversation_alpha1'),
    username: str(),
    active: bool(),
    title: opt(str()),
    createdAt: str(),
    updatedAt: str(),
    stats: obj({ messageCount: num(), userMessageCount: num(), assistantMessageCount: num() }),
  }),
  { validate: (value) => validateTextLength(value._id, 256, '/_id') },
);
export const messageSchema = createProjectedParser(
  obj({
    _id: id,
    _rev: opt(str()),
    version: lit('assistant_conversation_message_alpha1'),
    conversationId: id,
    role: oneOf(['user', 'assistant']),
    content: str(),
    channel: oneOf(['web', 'telegram']),
    channelMetadata: opt(obj({ telegram: opt(telegram) })),
    createdAt: str(),
    sequence: num({ minimum: 0 }),
  }),
  {
    validate: (value) => [
      ...validateTextLength(value._id, 256, '/_id'),
      ...validateTextLength(value.conversationId, 256, '/conversationId'),
    ],
  },
);
const sequenceDefinition = union([str({ minLength: 1, maxLength: 2048 }), num({ minimum: 0 })]);

/** Preserves UTF-16 bounds on opaque CouchDB sequence strings. */
function sequenceIssues(value: string | number, path: string): SchemaIssue[] {
  return typeof value === 'string' ? validateTextLength(value, 2048, path) : [];
}
const sequenceParser = createSchemaParser(sequenceDefinition, {
  validate: (value) => sequenceIssues(value, ''),
});
const changesParser = createProjectedParser(
  obj({
    last_seq: sequenceDefinition,
    results: arr(obj({ id: str(), seq: sequenceDefinition }), { maxItems: 100 }),
  }),
  {
    validate: (value) => [
      ...sequenceIssues(value.last_seq, '/last_seq'),
      ...value.results.flatMap((item, index) => sequenceIssues(item.seq, `/results/${index}/seq`)),
    ],
  },
);

interface ProjectionChange {
  id: string;
  seq: string;
}
export interface ProjectionChangeBatch {
  last_seq: string;
  results: ProjectionChange[];
}

/** Converts validated CouchDB sequence values to the transport's string representation. */
export function parseSequence(value: unknown): string {
  return String(sequenceParser.parse(value));
}

/** Projects change batches before converting their validated sequence values. */
export function parseChanges(value: unknown): ProjectionChangeBatch {
  const batch = changesParser.parse(value);
  return {
    last_seq: String(batch.last_seq),
    results: batch.results.map((item) => ({ id: item.id, seq: String(item.seq) })),
  };
}
