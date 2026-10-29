import { fauxAssistantMessage, fauxToolCall } from '@earendil-works/pi-ai/providers/faux';
import type { AssistantRequest } from '@eddo/core-shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openAssistantRuntime } from './assistant_runtime.js';
import { openDurableRuntime, type DurableRuntime } from './runtime.js';
import { createRuntimeFixture, createTestInput, deferred } from './test_helpers.js';

const registry = vi.hoisted(() => ({ find: vi.fn() }));
vi.mock('@eddo/core-server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@eddo/core-server')>()),
  createUserRegistry: () => ({ findByUsername: registry.find }),
}));

const runtimes: DurableRuntime[] = [];
afterEach(async () => {
  await Promise.all(runtimes.splice(0).map((runtime) => runtime.close()));
});
beforeEach(() => {
  registry.find.mockReset();
  registry.find.mockResolvedValue({
    username: 'alice',
    status: 'active',
    telegram_id: 123,
    preferences: { mcpApiKey: 'current-key', dailyBriefing: true },
  });
});

function webRequest(id = '1'): AssistantRequest {
  return {
    account: { username: 'alice' },
    requestId: `web:alice:${id}`,
    conversationId: 'assistant_default',
    text: 'List tasks',
    source: { channel: 'web' },
    createdAt: new Date().toISOString(),
    deadline: Date.now() + 300_000,
  };
}

async function open(options: Parameters<typeof openAssistantRuntime>[0]): Promise<DurableRuntime> {
  const runtime = await openAssistantRuntime(options);
  runtimes.push(runtime);
  return runtime;
}

describe('shared assistant runtime', () => {
  it('runs web-only tools with current account credentials and no Telegram effects', async () => {
    const fixture = await createRuntimeFixture();
    fixture.options.client.tools = [
      { name: 'getTodo', description: 'Get task', inputSchema: { type: 'object' } },
    ];
    fixture.options.client.invoke = vi.fn().mockResolvedValue([{ type: 'text', text: 'Task' }]);
    fixture.provider.setResponses([
      fauxAssistantMessage(fauxToolCall('getTodo', {}), { stopReason: 'toolUse' }),
      fauxAssistantMessage('Found task'),
    ]);
    const progress = vi.fn();
    const runtime = await open({ ...fixture.options, telegramId: undefined, progress });

    expect(await runtime.execute(webRequest())).toBe('Found task');
    expect(fixture.options.client.invoke).toHaveBeenCalledWith(
      'getTodo',
      {},
      {
        username: 'alice',
        mcpApiKey: 'current-key',
      },
    );
    expect(fixture.options.send).not.toHaveBeenCalled();
    expect(progress).not.toHaveBeenCalled();
    expect(fixture.options.project).toHaveBeenCalledWith(
      expect.objectContaining({
        account: { username: 'alice' },
        source: { channel: 'web' },
      }),
      'Found task',
    );
  });

  it('revalidates credentials before tool side effects after generation starts', async () => {
    const fixture = await createRuntimeFixture();
    fixture.options.client.tools = [
      { name: 'createTodo', description: 'Create task', inputSchema: { type: 'object' } },
    ];
    fixture.provider.setResponses([
      () => {
        registry.find.mockResolvedValue(null);
        return fauxAssistantMessage(fauxToolCall('createTodo', {}), { stopReason: 'toolUse' });
      },
      fauxAssistantMessage('Authorization denied'),
    ]);
    const runtime = await open({ ...fixture.options, telegramId: undefined });
    await expect(runtime.execute(webRequest())).rejects.toThrow();
    expect(fixture.options.client.invoke).not.toHaveBeenCalled();
    expect(fixture.options.send).not.toHaveBeenCalled();
  });

  it('shares native context across Telegram, web, and Telegram follow-ups', async () => {
    const fixture = await createRuntimeFixture();
    const lengths: number[] = [];
    fixture.provider.setResponses(
      [1, 2, 3].map(() => (context) => {
        lengths.push(context.messages.filter((message) => message.role === 'user').length);
        return fauxAssistantMessage('Done');
      }),
    );
    const runtime = await open(fixture.options);
    await runtime.execute(createTestInput());
    await runtime.execute(webRequest());
    await runtime.execute(createTestInput({ requestId: 'telegram:bot:2' }));
    expect(lengths).toEqual([1, 2, 3]);
    expect(fixture.options.send).toHaveBeenCalledTimes(2);
  });

  it('deduplicates web retries after reopening and rejects changed payloads', async () => {
    const fixture = await createRuntimeFixture();
    fixture.provider.setResponses([fauxAssistantMessage('Persisted answer')]);
    const first = await open({ ...fixture.options, telegramId: undefined });
    expect(await Promise.all([first.execute(webRequest()), first.execute(webRequest())])).toEqual([
      'Persisted answer',
      'Persisted answer',
    ]);
    await first.close();
    const second = await open({ ...(await fixture.reopen()), telegramId: undefined });
    expect(await second.execute(webRequest())).toBe('Persisted answer');
    await expect(second.execute({ ...webRequest(), text: 'Delete tasks' })).rejects.toThrow(
      'different payload',
    );
    expect(fixture.provider.state.callCount).toBe(1);
    expect(fixture.options.send).not.toHaveBeenCalled();
  });

  it('recovers pending legacy delivery through the shared runtime without regenerating', async () => {
    const fixture = await createRuntimeFixture();
    fixture.provider.setResponses([fauxAssistantMessage('Legacy reply')]);
    const gate = deferred();
    fixture.options.send = vi.fn().mockImplementation(() => gate.promise);
    const first = await openDurableRuntime(fixture.options);
    runtimes.push(first);
    const pending = first.execute(createTestInput()).catch(() => undefined);
    await vi.waitFor(() => expect(fixture.options.send).toHaveBeenCalledOnce());
    const closing = first.close();
    gate.resolve();
    await closing;
    await pending;
    const options = await fixture.reopen();
    options.send = vi.fn().mockResolvedValue(undefined);
    const second = await open(options);
    expect(await second.execute(createTestInput())).toBe('Legacy reply');
    expect(options.send).toHaveBeenCalledExactlyOnceWith(123, 'Legacy reply');
    expect(fixture.provider.state.callCount).toBe(1);
  });

  it('rejects a relinked owner on web continuation without model execution', async () => {
    const fixture = await createRuntimeFixture();
    const runtime = await open(fixture.options);
    registry.find.mockResolvedValue({
      username: 'alice',
      status: 'active',
      telegram_id: 456,
      preferences: { mcpApiKey: 'current-key' },
    });
    await expect(runtime.execute(webRequest())).rejects.toThrow('identity changed');
    expect(fixture.provider.state.callCount).toBe(0);
  });

  it('prints a marked web report through its adapter without Telegram delivery', async () => {
    const fixture = await createRuntimeFixture();
    fixture.provider.setResponses([
      fauxAssistantMessage('---BRIEFING-START---\nToday: review tasks'),
    ]);
    const print = vi.fn().mockResolvedValue(undefined);
    const runtime = await open({ ...fixture.options, telegramId: undefined, print });
    expect(await runtime.execute(webRequest())).toBe('Today: review tasks');
    expect(print).toHaveBeenCalledWith(
      expect.objectContaining({ source: { channel: 'web' } }),
      'Today: review tasks',
      'briefing',
    );
    expect(fixture.options.send).not.toHaveBeenCalled();
  });

  it('rejects revoked admission and foreign request identities before model execution', async () => {
    const fixture = await createRuntimeFixture();
    const runtime = await open({ ...fixture.options, telegramId: undefined });
    await expect(runtime.execute({ ...webRequest(), requestId: 'web:bob:1' })).rejects.toThrow(
      'scoped',
    );
    registry.find.mockResolvedValue(null);
    await expect(runtime.execute(webRequest())).rejects.toThrow('inactive');
    expect(fixture.provider.state.callCount).toBe(0);
    expect(fixture.options.send).not.toHaveBeenCalled();
  });
});
