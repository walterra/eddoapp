import { fauxAssistantMessage } from '@earendil-works/pi-ai/providers/faux';
import { describe, expect, it, vi } from 'vitest';
import { openDurableRuntime } from './runtime.js';
import { createRuntimeFixture, createTestInput, deferred } from './test_helpers.js';

vi.mock('../utils/user-lookup.js', () => ({
  lookupUserByTelegramId: vi.fn().mockResolvedValue({
    username: 'alice',
    preferences: { mcpApiKey: 'secret' },
  }),
}));

describe('independent history projection', () => {
  it('delivers and completes while projection fails', async () => {
    const fixture = await createRuntimeFixture();
    fixture.provider.setResponses([fauxAssistantMessage('Saved your task')]);
    fixture.options.project = vi.fn().mockRejectedValue(new Error('Chat database unavailable'));
    const runtime = await openDurableRuntime(fixture.options);
    try {
      expect(await runtime.execute(createTestInput())).toBe('Saved your task');
      expect(fixture.options.send).toHaveBeenCalledExactlyOnceWith(123, 'Saved your task');
      await vi.waitFor(() => expect(fixture.options.project).toHaveBeenCalledOnce());
      expect(fixture.options.onReport).toHaveBeenCalled();
    } finally {
      await runtime.close();
    }
  });

  it('does not wait for an unresolved projection', async () => {
    const fixture = await createRuntimeFixture();
    const pending = deferred();
    fixture.provider.setResponses([fauxAssistantMessage('Answer')]);
    fixture.options.project = vi.fn().mockImplementation(() => pending.promise);
    const runtime = await openDurableRuntime(fixture.options);
    try {
      expect(await runtime.execute(createTestInput())).toBe('Answer');
      expect(fixture.options.send).toHaveBeenCalledExactlyOnceWith(123, 'Answer');
    } finally {
      pending.resolve();
      await runtime.close();
    }
  });
});
