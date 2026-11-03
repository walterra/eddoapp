import { describe, expect, it } from 'vitest';
import {
  conversationSchema,
  messageSchema,
  parseChanges,
  parseSequence,
} from './projection_schemas';

const conversation = {
  _id: 'conversation',
  version: 'assistant_conversation_alpha1',
  username: 'user',
  active: true,
  createdAt: 'time',
  updatedAt: 'time',
  stats: { messageCount: 1, userMessageCount: 1, assistantMessageCount: 0 },
};
const message = {
  _id: 'message',
  version: 'assistant_conversation_message_alpha1',
  conversationId: 'conversation',
  role: 'user',
  content: 'text',
  channel: 'telegram',
  createdAt: 'time',
  sequence: 0,
};

describe('assistant projection validation', () => {
  it('projects nested metadata and stats without mutating documents', () => {
    const input = {
      ...conversation,
      private: true,
      stats: { ...conversation.stats, private: true },
    };
    expect(conversationSchema.parse(input)).toEqual(conversation);
    expect(input.stats.private).toBe(true);
    expect(
      messageSchema.parse({
        ...message,
        channelMetadata: { telegram: { chatId: 1, userId: 2, private: true }, private: true },
      }),
    ).toEqual({ ...message, channelMetadata: { telegram: { chatId: 1, userId: 2 } } });
  });

  it('rejects non-finite numbers and overlong UTF-16 identifiers', () => {
    expect(conversationSchema.safeParse({ ...conversation, _id: '😀'.repeat(129) }).success).toBe(
      false,
    );
    expect(messageSchema.safeParse({ ...message, sequence: Infinity }).success).toBe(false);
    expect(messageSchema.safeParse({ ...message, conversationId: '😀'.repeat(129) }).success).toBe(
      false,
    );
  });

  it('converts validated numeric sequences without accepting numeric strings implicitly', () => {
    expect(parseSequence(0)).toBe('0');
    expect(parseSequence(1.5)).toBe('1.5');
    expect(parseSequence('opaque-sequence')).toBe('opaque-sequence');
    expect(() => parseSequence(-1)).toThrow();
    expect(() => parseSequence(Infinity)).toThrow();
    expect(() => parseSequence('')).toThrow();
    expect(() => parseSequence('😀'.repeat(1025))).toThrow();
  });

  it('validates complete batches before projecting and converting their sequences', () => {
    expect(
      parseChanges({ last_seq: 2, results: [{ id: 'doc', seq: 1, private: true }], private: true }),
    ).toEqual({
      last_seq: '2',
      results: [{ id: 'doc', seq: '1' }],
    });
    expect(() => parseChanges({ last_seq: 2, results: [{ id: 'doc', seq: -1 }] })).toThrow();
    expect(() =>
      parseChanges({ last_seq: 2, results: Array(101).fill({ id: 'doc', seq: 1 }) }),
    ).toThrow();
  });
});
