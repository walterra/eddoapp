import { fauxAssistantMessage } from '@earendil-works/pi-ai/providers/faux';
import { describe, expect, it, vi } from 'vitest';
import { isPendingDurableRequest } from './request_wait.js';
import { openDurableRuntime } from './runtime.js';
import { createRuntimeFixture, createTestInput, deferred } from './test_helpers.js';

vi.mock('../utils/user-lookup.js', () => ({
  lookupUserByTelegramId: vi.fn().mockResolvedValue({
    username: 'alice',
    preferences: { mcpApiKey: 'secret' },
  }),
}));

describe('pending request delivery', () => {
  it('continues delivery after the handler stops waiting without repeating execution', async () => {
    const fixture = await createRuntimeFixture();
    fixture.provider.setResponses([fauxAssistantMessage('Task saved')]);
    const sending = deferred();
    fixture.options.send = vi.fn().mockImplementation(() => sending.promise);
    const runtime = await openDurableRuntime(fixture.options);
    const controller = new AbortController();
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal);
    const input = createTestInput();
    try {
      const result = runtime.execute(input).catch((error: unknown) => error);
      await vi.waitFor(() => expect(fixture.options.send).toHaveBeenCalledOnce());
      controller.abort(new DOMException('Wait expired', 'TimeoutError'));
      expect(isPendingDurableRequest(await result)).toBe(true);
      timeout.mockRestore();
      sending.resolve();
      expect(await runtime.execute(input)).toBe('Task saved');
      expect(fixture.provider.state.callCount).toBe(1);
      expect(fixture.options.send).toHaveBeenCalledOnce();
    } finally {
      timeout.mockRestore();
      sending.resolve();
      await runtime.close();
    }
  });
});
