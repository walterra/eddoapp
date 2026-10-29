import { describe, expect, it } from 'vitest';
import { normalizeTelegramRequest, requestChannelMetadata } from './request_channel.js';
import { createTestInput } from './test_helpers.js';

describe('assistant request channel boundary', () => {
  it('normalizes legacy Telegram inputs without changing persisted fields', () => {
    const input = createTestInput();
    const original = structuredClone(input);

    const request = normalizeTelegramRequest('alice', input);

    expect(input).toEqual(original);
    expect(request).toEqual({
      account: { username: 'alice' },
      requestId: input.requestId,
      conversationId: input.conversationId,
      text: input.text,
      source: { channel: 'telegram', telegram: { chatId: 123, userId: 123, messageId: 1 } },
      createdAt: input.createdAt,
      deadline: input.deadline,
    });
  });

  it('preserves scheduled occurrence identity and delivery metadata', () => {
    const report = { type: 'briefing' as const, occurrence: '2026-10-29' };
    const input = createTestInput({ report, messageId: 0 });

    const request = normalizeTelegramRequest('alice', input);

    expect(request.report).toEqual(report);
    expect(requestChannelMetadata(request.source)).toEqual({
      telegram: { chatId: 123, userId: 123, messageId: 0 },
    });
  });

  it('does not require or fabricate Telegram metadata for web requests', () => {
    expect(requestChannelMetadata({ channel: 'web' })).toBeUndefined();
  });
});
