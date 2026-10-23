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

describe('history completion recovery', () => {
  it('resumes interrupted projection without repeating generation or delivery', async () => {
    const fixture = await createRuntimeFixture();
    const gate = deferred();
    fixture.provider.setResponses([fauxAssistantMessage('Saved')]);
    fixture.options.project = vi.fn().mockImplementation(() => gate.promise);
    const first = await openDurableRuntime(fixture.options);
    const execution = first.execute(createTestInput()).catch(() => undefined);
    try {
      await vi.waitFor(() => expect(fixture.options.project).toHaveBeenCalledOnce());
      expect(fixture.options.send).toHaveBeenCalledExactlyOnceWith(123, 'Saved');
    } finally {
      const closing = first.close();
      gate.resolve();
      await closing;
      await execution;
    }
    const options = await fixture.reopen();
    options.project = vi.fn().mockResolvedValue(undefined);
    options.send = vi.fn().mockResolvedValue(undefined);
    const recovered = await openDurableRuntime(options);
    try {
      expect(await recovered.execute(createTestInput())).toBe('Saved');
      expect(options.project).toHaveBeenCalledOnce();
      expect(options.send).not.toHaveBeenCalled();
      expect(fixture.provider.state.callCount).toBe(1);
    } finally {
      await recovered.close();
    }
  });
});
