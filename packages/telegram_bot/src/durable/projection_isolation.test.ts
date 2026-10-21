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

describe('delivery before history completion', () => {
  it('delivers but keeps completion pending while projection fails', async () => {
    const fixture = await createRuntimeFixture();
    fixture.provider.setResponses([fauxAssistantMessage('Saved your task')]);
    fixture.options.project = vi.fn().mockRejectedValue(new Error('Chat database unavailable'));
    const runtime = await openDurableRuntime(fixture.options);
    let completed = false;
    const execution = runtime
      .execute(createTestInput())
      .then(() => {
        completed = true;
      })
      .catch(() => undefined);
    try {
      await vi.waitFor(() => expect(fixture.options.onReport).toHaveBeenCalled());
      expect(fixture.options.send).toHaveBeenCalledExactlyOnceWith(123, 'Saved your task');
      expect(fixture.options.project).toHaveBeenCalledOnce();
      expect(completed).toBe(false);
    } finally {
      await runtime.close();
      await execution;
    }
  });

  it('sends before projection and completes only after history persists', async () => {
    const fixture = await createRuntimeFixture();
    const pending = deferred();
    fixture.provider.setResponses([fauxAssistantMessage('Answer')]);
    fixture.options.project = vi.fn().mockImplementation(() => pending.promise);
    const runtime = await openDurableRuntime(fixture.options);
    let completed = false;
    const execution = runtime.execute(createTestInput()).then((answer) => {
      completed = true;
      return answer;
    });
    try {
      await vi.waitFor(() => expect(fixture.options.project).toHaveBeenCalledOnce());
      expect(fixture.options.send).toHaveBeenCalledExactlyOnceWith(123, 'Answer');
      expect(completed).toBe(false);
      pending.resolve();
      expect(await execution).toBe('Answer');
      expect(fixture.options.send).toHaveBeenCalledOnce();
    } finally {
      pending.resolve();
      await runtime.close();
    }
  });
});
