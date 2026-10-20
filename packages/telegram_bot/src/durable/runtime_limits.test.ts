import { fauxAssistantMessage, fauxToolCall } from '@earendil-works/pi-ai/providers/faux';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openDurableRuntime, type DurableRuntime } from './runtime.js';
import { createRuntimeFixture, createTestInput, deferred } from './test_helpers.js';

vi.mock('../utils/user-lookup.js', () => ({
  lookupUserByTelegramId: vi
    .fn()
    .mockResolvedValue({ username: 'alice', preferences: { mcpApiKey: 'secret' } }),
}));

const runtimes: DurableRuntime[] = [];
afterEach(async () => {
  await Promise.all(runtimes.splice(0).map((runtime) => runtime.close()));
});

async function open(options: Parameters<typeof openDurableRuntime>[0]): Promise<DurableRuntime> {
  const runtime = await openDurableRuntime(options);
  runtimes.push(runtime);
  return runtime;
}

describe('durable execution limits and recovery', () => {
  it('rejects requests routed to a different Telegram identity', async () => {
    const fixture = await createRuntimeFixture();
    const runtime = await open(fixture.options);
    await expect(runtime.execute(createTestInput({ chatId: 456 }))).rejects.toThrow(
      'journal owner',
    );
    expect(fixture.provider.state.callCount).toBe(0);
  });

  it('refuses to resume the journal after account relinking', async () => {
    const fixture = await createRuntimeFixture();
    const first = await open(fixture.options);
    await first.close();
    const options = await fixture.reopen();
    await expect(openDurableRuntime({ ...options, telegramId: 456 })).rejects.toThrow(
      'another Telegram identity',
    );
    expect(fixture.options.send).not.toHaveBeenCalled();
  });
  it('never starts an expired request after recovery', async () => {
    const fixture = await createRuntimeFixture();
    const runtime = await open(fixture.options);
    expect(await runtime.execute(createTestInput({ deadline: Date.now() - 1 }))).toContain(
      'expired',
    );
    expect(fixture.provider.state.callCount).toBe(0);
  });

  it('bounds tool executions and sends a bounded terminal answer', async () => {
    const fixture = await createRuntimeFixture();
    fixture.options.client.tools = [
      { name: 'getTodo', description: 'Get todo', inputSchema: { type: 'object', properties: {} } },
    ];
    fixture.options.client.invoke = vi.fn().mockResolvedValue('todo');
    fixture.provider.setResponses(
      Array.from({ length: 51 }, () =>
        fauxAssistantMessage(fauxToolCall('getTodo', {}), { stopReason: 'toolUse' }),
      ),
    );
    const runtime = await open(fixture.options);
    await runtime.execute(createTestInput());
    expect(fixture.options.client.invoke).toHaveBeenCalledTimes(50);
    expect(fixture.provider.state.callCount).toBe(51);
    expect(fixture.options.send).toHaveBeenCalledOnce();
  });

  it('replays an interrupted read with freshly resolved authorization', async () => {
    const fixture = await createRuntimeFixture();
    fixture.options.client.tools = [
      { name: 'getTodo', description: 'Get todo', inputSchema: { type: 'object', properties: {} } },
    ];
    const gate = deferred();
    fixture.options.client.invoke = vi
      .fn()
      .mockImplementationOnce(async () => {
        await gate.promise;
        return 'old';
      })
      .mockResolvedValue('fresh');
    fixture.provider.setResponses([
      fauxAssistantMessage(fauxToolCall('getTodo', {}), { stopReason: 'toolUse' }),
      fauxAssistantMessage('Fresh result'),
    ]);
    const first = await open(fixture.options);
    const pending = first.execute(createTestInput()).catch(() => undefined);
    await vi.waitFor(() => expect(fixture.options.client.invoke).toHaveBeenCalledOnce());
    const closing = first.close();
    gate.resolve();
    await closing;
    await pending;
    const second = await open(await fixture.reopen());
    expect(await second.execute(createTestInput())).toBe('Fresh result');
    expect(fixture.options.client.invoke).toHaveBeenCalledTimes(2);
    expect(fixture.options.client.invoke).toHaveBeenLastCalledWith(
      'getTodo',
      {},
      { username: 'alice', telegramId: 123, mcpApiKey: 'secret' },
    );
  });

  it('chunks long answers without exposing tool protocol text', async () => {
    const fixture = await createRuntimeFixture();
    const answer = 'a'.repeat(8500);
    fixture.provider.setResponses([fauxAssistantMessage(answer)]);
    const runtime = await open(fixture.options);
    expect(await runtime.execute(createTestInput())).toBe(answer);
    expect(vi.mocked(fixture.options.send).mock.calls.map(([, text]) => text.length)).toEqual([
      4000, 4000, 500,
    ]);
    expect(fixture.options.project).toHaveBeenCalledOnce();
  });
});
