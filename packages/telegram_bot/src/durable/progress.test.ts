import { fauxAssistantMessage, fauxToolCall } from '@earendil-works/pi-ai/providers/faux';
import { describe, expect, it, vi } from 'vitest';
import { openDurableRuntime } from './runtime.js';
import {
  createRuntimeFixture,
  createTestInput,
  deferred,
  type RuntimeFixture,
} from './test_helpers.js';

vi.mock('../utils/user-lookup.js', () => ({
  lookupUserByTelegramId: vi.fn().mockResolvedValue({
    username: 'alice',
    preferences: { mcpApiKey: 'secret', dailyBriefing: true },
  }),
}));

async function fixture(calls = 1): Promise<RuntimeFixture> {
  const result = await createRuntimeFixture();
  result.options.progress = vi.fn().mockResolvedValue(undefined);
  result.options.client.tools = [
    { name: 'getTodo', description: 'Fetch task', inputSchema: { type: 'object', properties: {} } },
  ];
  result.options.client.invoke = vi.fn().mockResolvedValue('Task');
  result.provider.setResponses([
    ...Array.from({ length: calls }, () =>
      fauxAssistantMessage(fauxToolCall('getTodo', {}), { stopReason: 'toolUse' }),
    ),
    fauxAssistantMessage('Done'),
  ]);
  return result;
}

describe('interactive progress delivery', () => {
  it('provides bounded progress without claiming completed mutations or repeating duplicate updates', async () => {
    const test = await fixture(11);
    const runtime = await openDurableRuntime(test.options);
    try {
      expect(await runtime.execute(createTestInput())).toBe('Done');
      expect(await runtime.execute(createTestInput())).toBe('Done');
      expect(test.options.progress).toHaveBeenCalledTimes(2);
      expect(test.options.progress).toHaveBeenNthCalledWith(1, 'Working on your request…');
      expect(test.options.progress).toHaveBeenNthCalledWith(2, 'Still working on your request…');
      expect(test.options.send).toHaveBeenCalledExactlyOnceWith(123, 'Done');
    } finally {
      await runtime.close();
    }
  });

  it('does not add status chatter to scheduled reports', async () => {
    const test = await fixture();
    const runtime = await openDurableRuntime(test.options);
    try {
      await runtime.execute(createTestInput({ report: { type: 'briefing', occurrence: 'today' } }));
      expect(test.options.progress).not.toHaveBeenCalled();
    } finally {
      await runtime.close();
    }
  });

  it('continues tool execution and final delivery when a progress send fails', async () => {
    const test = await fixture();
    vi.mocked(test.options.progress!).mockRejectedValue(new Error('Telegram unavailable'));
    const runtime = await openDurableRuntime(test.options);
    try {
      expect(await runtime.execute(createTestInput())).toBe('Done');
      expect(test.options.client.invoke).toHaveBeenCalledOnce();
      expect(test.options.onReport).toHaveBeenCalledWith(expect.any(Error));
    } finally {
      await runtime.close();
    }
  });

  it('does not repeat the initial notice when a read resumes after restart', async () => {
    const test = await fixture();
    const gate = deferred();
    vi.mocked(test.options.client.invoke).mockImplementationOnce(async () => {
      await gate.promise;
      return 'Task';
    });
    let runtime = await openDurableRuntime(test.options);
    try {
      const pending = runtime.execute(createTestInput()).catch(() => undefined);
      await vi.waitFor(() => expect(test.options.client.invoke).toHaveBeenCalledOnce());
      const closing = runtime.close();
      gate.resolve();
      await closing;
      await pending;
      runtime = await openDurableRuntime(await test.reopen());
      expect(await runtime.execute(createTestInput())).toBe('Done');
      expect(test.options.progress).toHaveBeenCalledOnce();
    } finally {
      gate.resolve();
      await runtime.close();
    }
  });
});
