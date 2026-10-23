import { fauxAssistantMessage, fauxToolCall } from '@earendil-works/pi-ai/providers/faux';
import type { AssistantConversationMessageDoc } from '@eddo/core-shared';
import { describe, expect, it, vi } from 'vitest';
import { lookupUserByTelegramId } from '../utils/user-lookup.js';
import { formatLegacyHistory } from './legacy_history.js';
import { openDurableRuntime } from './runtime.js';
import { createRuntimeFixture, createTestInput } from './test_helpers.js';

vi.mock('../utils/user-lookup.js', () => ({
  lookupUserByTelegramId: vi.fn().mockResolvedValue({
    username: 'alice',
    preferences: { mcpApiKey: 'secret' },
  }),
}));

function message(sequence: number, content: string): AssistantConversationMessageDoc {
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

describe('native legacy archive tool', () => {
  it('refuses archive reads after identity revocation', async () => {
    const fixture = await createRuntimeFixture();
    fixture.options.legacyArchive = vi.fn();
    vi.mocked(lookupUserByTelegramId).mockResolvedValueOnce(null);
    fixture.provider.setResponses([
      fauxAssistantMessage(fauxToolCall('readLegacyHistory', {}), { stopReason: 'toolUse' }),
      fauxAssistantMessage('Archive access is unavailable.'),
    ]);
    const runtime = await openDurableRuntime(fixture.options);
    try {
      await runtime.execute(createTestInput());
      expect(fixture.options.legacyArchive).not.toHaveBeenCalled();
    } finally {
      await runtime.close();
    }
  });

  it('retrieves omitted decisions and long message tails through authenticated native tools', async () => {
    const fixture = await createRuntimeFixture();
    const messages = [
      message(0, `${'x'.repeat(4000)} DECISION-123`),
      ...Array.from({ length: 50 }, (_, index) => message(index + 1, 'Recent discussion')),
    ];
    fixture.options.legacyHistory = async () => formatLegacyHistory(messages);
    fixture.options.legacyArchive = vi.fn().mockResolvedValue(messages);
    fixture.provider.setResponses([
      (context) => {
        expect(JSON.stringify(context.messages)).not.toContain('DECISION-123');
        return fauxAssistantMessage(
          fauxToolCall('readLegacyHistory', {
            query: 'decision-123',
            characterOffset: 3900,
          }),
          { stopReason: 'toolUse' },
        );
      },
      (context) => {
        expect(JSON.stringify(context.messages)).toContain('DECISION-123');
        return fauxAssistantMessage('The earlier decision is available.');
      },
    ]);
    const runtime = await openDurableRuntime(fixture.options);
    try {
      expect(await runtime.execute(createTestInput())).toBe('The earlier decision is available.');
      expect(fixture.options.legacyArchive).toHaveBeenCalledExactlyOnceWith('assistant_default');
      expect(fixture.options.client.invoke).not.toHaveBeenCalled();
    } finally {
      await runtime.close();
    }
  });

  it('scopes retrieval to the current conversation, including after restart and /new', async () => {
    const fixture = await createRuntimeFixture();
    const archive = vi.fn(async (id: string) =>
      id === 'assistant_default' ? [message(0, 'Old private decision')] : [],
    );
    fixture.options.legacyArchive = archive;
    fixture.provider.setResponses([fauxAssistantMessage('Original reply')]);
    const first = await openDurableRuntime(fixture.options);
    await first.execute(createTestInput());
    await first.close();
    fixture.provider.setResponses([
      fauxAssistantMessage(fauxToolCall('readLegacyHistory', {}), { stopReason: 'toolUse' }),
      (context) => {
        expect(JSON.stringify(context.messages)).not.toContain('Old private decision');
        return fauxAssistantMessage('Fresh archive is empty.');
      },
    ]);
    const runtime = await openDurableRuntime(await fixture.reopen());
    try {
      expect(
        await runtime.execute(
          createTestInput({
            requestId: 'telegram:new',
            conversationId: 'assistant_new',
          }),
        ),
      ).toBe('Fresh archive is empty.');
      expect(archive).toHaveBeenCalledExactlyOnceWith('assistant_new');
    } finally {
      await runtime.close();
    }
  });
});
