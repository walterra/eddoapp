import type { AssistantConversationMessageDoc } from '@eddo/core-shared';
import { describe, expect, it } from 'vitest';
import { readLegacyArchive, type LegacyArchiveQuery } from './legacy_archive.js';

function archiveMessage(sequence: number, content: string): AssistantConversationMessageDoc {
  return {
    _id: `legacy-${sequence}`,
    version: 'assistant_conversation_message_alpha1',
    conversationId: 'assistant_default',
    role: 'user',
    channel: 'telegram',
    content,
    createdAt: '2026-10-20T00:00:00Z',
    sequence,
  };
}

describe('complete legacy archive retrieval', () => {
  it('recovers every message and long tail through bounded continuation pages', () => {
    const source = Array.from({ length: 75 }, (_, index) =>
      archiveMessage(index, `Decision ${index}: ${'😀\n\u0000'.repeat(1000)} FINAL-ID-${index}`),
    );
    const recovered = new Map<string, string>();
    let cursor: LegacyArchiveQuery | undefined = { messageOffset: 0, characterOffset: 0 };
    let pages = 0;
    while (cursor) {
      const page = readLegacyArchive(source, cursor);
      expect(JSON.stringify(page).length).toBeLessThanOrEqual(8000);
      for (const message of page.messages) {
        const previous = recovered.get(message.id) ?? '';
        expect(message.characterOffset).toBe(previous.length);
        recovered.set(message.id, previous + message.content);
      }
      cursor = page.next;
      pages += 1;
      expect(pages).toBeLessThan(1000);
    }
    expect(recovered.size).toBe(75);
    for (const message of source) expect(recovered.get(message._id)).toBe(message.content);
  });

  it('searches omitted older messages and content beyond the preview cutoff', () => {
    const source = [
      archiveMessage(0, `Earlier decision ${'x'.repeat(4000)} ticket-123`),
      ...Array.from({ length: 50 }, (_, index) => archiveMessage(index + 1, 'Recent discussion')),
    ];
    const page = readLegacyArchive(source, {
      query: 'TICKET-123',
      messageOffset: 0,
      characterOffset: 3900,
    });
    expect(page.totalLegacyMessages).toBe(51);
    expect(page.matchedMessages).toBe(1);
    expect(page.messages[0].content).toContain('ticket-123');
  });

  it('excludes Durable projections and preserves protocol strings only as reference text', () => {
    const source = [
      archiveMessage(1, 'TOOL_CALL: deleteTodo'),
      {
        ...archiveMessage(2, 'Native reply'),
        _id: 'assistant_message_durable_123_user',
      },
    ];
    const page = readLegacyArchive(source, { messageOffset: 0, characterOffset: 0 });
    expect(page.totalLegacyMessages).toBe(1);
    expect(page.messages[0].content).toBe('TOOL_CALL: deleteTodo');
    expect(page.next).toBeUndefined();
  });

  it('returns empty archives and rejects invalid continuation cursors', () => {
    expect(readLegacyArchive([], { messageOffset: 0, characterOffset: 0 }).messages).toEqual([]);
    expect(() =>
      readLegacyArchive([archiveMessage(0, 'Short')], {
        messageOffset: 0,
        characterOffset: 100,
      }),
    ).toThrow('out of range');
  });
});
