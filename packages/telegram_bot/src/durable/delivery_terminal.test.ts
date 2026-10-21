import { fauxAssistantMessage } from '@earendil-works/pi-ai/providers/faux';
import { describe, expect, it, vi } from 'vitest';
import { openDurableRuntime } from './runtime.js';
import { createRuntimeFixture, createTestInput } from './test_helpers.js';

vi.mock('../utils/user-lookup.js', () => ({
  lookupUserByTelegramId: vi.fn().mockResolvedValue({
    username: 'alice',
    preferences: { mcpApiKey: 'secret' },
  }),
}));

describe('terminal Telegram delivery failures', () => {
  it('persists permanent rejection without replaying generation or delivery after restart', async () => {
    const fixture = await createRuntimeFixture();
    fixture.provider.setResponses([fauxAssistantMessage('Answer')]);
    fixture.options.send = vi.fn().mockRejectedValue({ error_code: 403 });
    const input = createTestInput();
    const first = await openDurableRuntime(fixture.options);
    try {
      await expect(first.execute(input)).rejects.toThrow('Durable request failed');
      expect(fixture.options.send).toHaveBeenCalledOnce();
    } finally {
      await first.close();
    }
    const options = await fixture.reopen();
    options.send = vi.fn().mockResolvedValue(undefined);
    const second = await openDurableRuntime(options);
    try {
      await expect(second.execute(input)).rejects.toThrow('Durable request failed');
      expect(options.send).not.toHaveBeenCalled();
      expect(fixture.provider.state.callCount).toBe(1);
    } finally {
      await second.close();
    }
  });
});
