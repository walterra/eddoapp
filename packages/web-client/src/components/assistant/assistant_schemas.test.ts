import { describe, expect, it } from 'vitest';
import { historySchema, pendingSchema } from './assistant_schemas';

const pending = {
  username: 'user',
  submissionId: '123e4567-e89b-42d3-a456-426614174000',
  text: 'request',
  createdAt: '2024-02-29T12:34:56Z',
  conversationId: null,
  projectionIds: {
    user: 'assistant_message_durable_' + 'a'.repeat(64) + '_user',
    assistant: 'assistant_message_durable_' + 'a'.repeat(64) + '_assistant',
  },
};

describe('browser assistant schemas', () => {
  it('projects pending state without retaining unrelated fields', () => {
    expect(pendingSchema.parse({ ...pending, private: true })).toEqual(pending);
  });

  it.each([
    { ...pending, text: '😀'.repeat(4001) },
    { ...pending, createdAt: '2023-02-29T12:34:56Z' },
    { ...pending, createdAt: '2024-02-29T12:34:56+00:00' },
    {
      ...pending,
      receipt: { requestId: '😀'.repeat(129), conversationId: 'id', status: 'queued' },
    },
    { ...pending, projectionIds: { ...pending.projectionIds, user: 'wrong-id' } },
  ])('rejects malformed persisted pending state', (value) => {
    expect(pendingSchema.safeParse(value).success).toBe(false);
  });

  it('accepts nullable conversations and projects history pages', () => {
    expect(
      historySchema.parse({
        conversation: null,
        messages: [],
        nextCursor: null,
        changeCursor: 'cursor',
        private: true,
      }),
    ).toEqual({ conversation: null, messages: [], nextCursor: null, changeCursor: 'cursor' });
  });
});
