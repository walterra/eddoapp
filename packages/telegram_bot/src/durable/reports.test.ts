import { fauxAssistantMessage, fauxToolCall } from '@earendil-works/pi-ai/providers/faux';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openDurableRuntime, type DurableRuntime } from './runtime.js';
import type { DurableRequestInput } from './state.js';
import { createRuntimeFixture, createTestInput, deferred } from './test_helpers.js';

vi.mock('../utils/user-lookup.js', () => ({
  lookupUserByTelegramId: vi.fn().mockResolvedValue({
    username: 'alice',
    preferences: { mcpApiKey: 'secret', dailyBriefing: true, dailyRecap: true },
  }),
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
function report(overrides: Partial<DurableRequestInput> = {}): DurableRequestInput {
  return createTestInput({
    requestId: 'report:bot:briefing:alice:2026-10-20:07:00',
    text: 'Generate a scheduled briefing using our discussion.',
    report: { type: 'briefing', occurrence: 'alice:2026-10-20:07:00' },
    deadline: Date.now() + 86_400_000,
    ...overrides,
  });
}

function rendered(body: string): string {
  return `DAILY BRIEFING - Tuesday, October 20, 2026\n\n${body}`;
}

describe('reports in the interactive Durable conversation', () => {
  it('shares discussion with reports and report context with subsequent interactive messages', async () => {
    const fixture = await createRuntimeFixture();
    fixture.options.print = vi.fn().mockResolvedValue(undefined);
    fixture.provider.setResponses([
      fauxAssistantMessage('Priority: finish the API migration.'),
      (context) => {
        expect(JSON.stringify(context.messages)).toContain('finish the API migration');
        return fauxAssistantMessage('---BRIEFING-START---\nFocus on the API migration.');
      },
      (context) => {
        expect(JSON.stringify(context.messages)).toContain('Focus on the API migration.');
        return fauxAssistantMessage('The briefing recommended the API migration.');
      },
    ]);
    const runtime = await open(fixture.options);
    await runtime.execute(createTestInput({ text: 'Focus on the API migration this week.' }));
    expect(await runtime.execute(report())).toBe(rendered('Focus on the API migration.'));
    expect(fixture.options.print).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ report: expect.any(Object) }),
      rendered('Focus on the API migration.'),
    );
    await runtime.execute(
      createTestInput({ requestId: 'telegram:bot:2', text: 'What did the briefing recommend?' }),
    );
    expect(vi.mocked(fixture.options.send).mock.calls.map(([, text]) => text)).toEqual([
      'Priority: finish the API migration.',
      rendered('Focus on the API migration.'),
      'The briefing recommended the API migration.',
    ]);
  });

  it('queues behind active interactive work without blocking durable admission', async () => {
    const fixture = await createRuntimeFixture();
    const gate = deferred();
    fixture.provider.setResponses([
      async () => {
        await gate.promise;
        return fauxAssistantMessage('Interactive done');
      },
      fauxAssistantMessage('---BRIEFING-START---\nQueued report'),
    ]);
    const runtime = await open(fixture.options);
    const interactive = runtime.execute(createTestInput());
    await vi.waitFor(() => expect(fixture.provider.state.callCount).toBe(1));
    await runtime.enqueue(report());
    expect(fixture.provider.state.callCount).toBe(1);
    gate.resolve();
    await interactive;
    expect(await runtime.execute(report())).toBe(rendered('Queued report'));
    expect(fixture.provider.state.callCount).toBe(2);
  });

  it('expires a queued input without aborting the active report', async () => {
    const fixture = await createRuntimeFixture();
    const gate = deferred();
    fixture.provider.setResponses([
      async () => {
        await gate.promise;
        return fauxAssistantMessage('---BRIEFING-START---\nActive report survives');
      },
    ]);
    const runtime = await open(fixture.options);
    const active = runtime.execute(report());
    await vi.waitFor(() => expect(fixture.provider.state.callCount).toBe(1));
    const expired = await runtime.execute(
      createTestInput({ requestId: 'telegram:late', deadline: Date.now() + 25 }),
    );
    expect(expired).toContain('queued request expired');
    expect(fixture.provider.state.callCount).toBe(1);
    gate.resolve();
    expect(await active).toBe(rendered('Active report survives'));
  });

  it('treats printer errors as non-fatal without resending Telegram output', async () => {
    const fixture = await createRuntimeFixture();
    fixture.options.print = vi.fn().mockRejectedValue(new Error('printer offline'));
    fixture.provider.setResponses([
      fauxAssistantMessage('---BRIEFING-START---\nReport survives printer failure'),
    ]);
    const runtime = await open(fixture.options);
    await runtime.execute(report());
    await runtime.execute(report());
    expect(fixture.options.print).toHaveBeenCalledOnce();
    expect(fixture.options.send).toHaveBeenCalledOnce();
    expect(fixture.options.onReport).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'printer offline' }),
    );
  });

  it('deduplicates an occurrence after restart and /new, including printing', async () => {
    const fixture = await createRuntimeFixture();
    fixture.options.print = vi.fn().mockResolvedValue(undefined);
    fixture.provider.setResponses([fauxAssistantMessage('---BRIEFING-START---\nOne report')]);
    const first = await open(fixture.options);
    await first.execute(report());
    await first.close();
    const second = await open(await fixture.reopen());
    expect(await second.execute(report({ conversationId: 'new_conversation' }))).toBe(
      rendered('One report'),
    );
    expect(fixture.provider.state.callCount).toBe(1);
    expect(fixture.options.print).toHaveBeenCalledOnce();
    expect(fixture.options.send).toHaveBeenCalledOnce();
  });

  it('does not replay ambiguous printing after restart', async () => {
    const fixture = await createRuntimeFixture();
    const gate = deferred();
    fixture.options.print = vi.fn().mockImplementation(() => gate.promise);
    fixture.provider.setResponses([fauxAssistantMessage('---BRIEFING-START---\nPrinted report')]);
    const first = await open(fixture.options);
    const pending = first.execute(report()).catch(() => undefined);
    await vi.waitFor(() => expect(fixture.options.print).toHaveBeenCalledOnce());
    const closing = first.close();
    gate.resolve();
    await closing;
    await pending;
    const second = await open(await fixture.reopen());
    expect(await second.execute(report())).toBe(rendered('Printed report'));
    expect(fixture.options.print).toHaveBeenCalledOnce();
    expect(fixture.options.send).toHaveBeenCalledOnce();
  });

  it('delivers unmarked reports but skips printing', async () => {
    const fixture = await createRuntimeFixture();
    fixture.options.print = vi.fn();
    fixture.provider.setResponses([fauxAssistantMessage('Report without a marker')]);
    const runtime = await open(fixture.options);
    expect(await runtime.execute(report())).toBe('Report without a marker');
    expect(fixture.options.print).not.toHaveBeenCalled();
  });

  it('fetches current report data through authenticated read tools', async () => {
    const fixture = await createRuntimeFixture();
    fixture.options.client.tools = [
      {
        name: 'getBriefingData',
        description: 'Get current data',
        inputSchema: { type: 'object', properties: {} },
      },
    ];
    fixture.options.client.invoke = vi.fn().mockResolvedValue('Current todo data');
    fixture.provider.setResponses([
      fauxAssistantMessage(fauxToolCall('getBriefingData', {}), { stopReason: 'toolUse' }),
      fauxAssistantMessage('---BRIEFING-START---\nCurrent report'),
    ]);
    const runtime = await open(fixture.options);
    expect(await runtime.execute(report())).toBe(rendered('Current report'));
    expect(fixture.options.client.invoke).toHaveBeenCalledExactlyOnceWith(
      'getBriefingData',
      {},
      { username: 'alice', telegramId: 123, mcpApiKey: 'secret' },
    );
  });

  it('denies mutations requested by a scheduled report', async () => {
    const fixture = await createRuntimeFixture();
    fixture.options.client.tools = [
      {
        name: 'createTodo',
        description: 'Create todo',
        inputSchema: { type: 'object', properties: {} },
      },
    ];
    fixture.provider.setResponses([
      fauxAssistantMessage(fauxToolCall('createTodo', {}), { stopReason: 'toolUse' }),
    ]);
    const runtime = await open(fixture.options);
    await runtime.execute(report());
    expect(fixture.options.client.invoke).not.toHaveBeenCalled();
    expect(fixture.options.send).toHaveBeenCalledOnce();
  });
});
