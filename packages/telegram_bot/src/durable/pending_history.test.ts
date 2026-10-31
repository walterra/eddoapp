import { fauxAssistantMessage } from '@earendil-works/pi-ai/providers/faux';
import type { DurableRuntime } from '@eddo/assistant-server/runtime';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openDurableRuntime } from './runtime.js';
import { createRuntimeFixture, createTestInput, deferred } from './test_helpers.js';

const runtimes: DurableRuntime[] = [];
afterEach(async () => {
  await Promise.all(runtimes.splice(0).map((runtime) => runtime.close()));
});

describe('durable admission and shared pending recovery', () => {
  it('preserves scheduled history when Telegram fails without bypassing the report printing gate', async () => {
    const fixture = await createRuntimeFixture();
    fixture.provider.setResponses([fauxAssistantMessage('---BRIEFING-START---\nTasks for today')]);
    fixture.options.send = vi.fn().mockRejectedValue({ error_code: 403 });
    const print = vi.fn();
    const runtime = await openDurableRuntime({
      ...fixture.options,
      print,
      projectAccepted: vi.fn().mockResolvedValue(undefined),
    });
    runtimes.push(runtime);
    const input = createTestInput({ report: { type: 'briefing', occurrence: 'today' } });
    await expect(runtime.execute(input)).rejects.toThrow();
    expect(fixture.options.project).toHaveBeenCalledWith(
      input,
      expect.stringContaining('Tasks for today'),
    );
    expect(print).not.toHaveBeenCalled();
    expect(fixture.provider.state.callCount).toBe(1);
    expect((await runtime.getPendingRequests()).requests).toEqual([]);
  });
  it('projects accepted text before generation and removes settled work atomically', async () => {
    const fixture = await createRuntimeFixture();
    const accepted = deferred();
    const projectAccepted = vi.fn().mockImplementation(() => accepted.promise);
    fixture.provider.setResponses([fauxAssistantMessage('Done')]);
    const runtime = await openDurableRuntime({ ...fixture.options, projectAccepted });
    runtimes.push(runtime);
    const input = createTestInput();
    await runtime.enqueue(input);
    await vi.waitFor(() => expect(projectAccepted).toHaveBeenCalledOnce());
    expect(fixture.provider.state.callCount).toBe(0);
    expect((await runtime.getPendingRequests()).requests).toEqual([
      expect.objectContaining({ requestId: input.requestId }),
    ]);
    accepted.resolve();
    expect(await runtime.execute(input)).toBe('Done');
    expect(await runtime.getPendingRequests()).toEqual({ requests: [], hasMore: false });
    expect(fixture.provider.state.callCount).toBe(1);
  });

  it('reopens accepted Telegram delivery without repeating generation or accepted projection', async () => {
    const fixture = await createRuntimeFixture();
    const gate = deferred();
    const projectAccepted = vi.fn().mockResolvedValue(undefined);
    fixture.options.send = vi.fn().mockImplementation(() => gate.promise);
    fixture.provider.setResponses([fauxAssistantMessage('Persisted reply')]);
    const first = await openDurableRuntime({ ...fixture.options, projectAccepted });
    runtimes.push(first);
    const input = createTestInput();
    await first.enqueue(input);
    await vi.waitFor(() => expect(fixture.options.send).toHaveBeenCalledOnce());
    expect(fixture.options.project).toHaveBeenCalledWith(input, 'Persisted reply');
    const closing = first.close();
    gate.resolve();
    await closing;
    const options = await fixture.reopen();
    options.send = vi.fn().mockResolvedValue(undefined);
    const second = await openDurableRuntime({ ...options, projectAccepted });
    runtimes.push(second);
    expect(await second.execute(input)).toBe('Persisted reply');
    expect(projectAccepted).toHaveBeenCalledOnce();
    expect(fixture.provider.state.callCount).toBe(1);
    expect((await second.getPendingRequests()).requests).toEqual([]);
  });

  it('exposes another browser request without Telegram delivery or client-side replay', async () => {
    const fixture = await createRuntimeFixture();
    const gate = deferred();
    fixture.provider.setResponses([
      async () => {
        await gate.promise;
        return fauxAssistantMessage('Web reply');
      },
    ]);
    const runtime = await openDurableRuntime({
      ...fixture.options,
      projectAccepted: vi.fn().mockResolvedValue(undefined),
    });
    runtimes.push(runtime);
    const input = {
      account: { username: 'alice' },
      source: { channel: 'web' as const },
      requestId: 'web:alice:70f72756-993e-4cae-8108-f6b723391ae1',
      text: 'Continue',
      conversationId: 'assistant_default',
      createdAt: new Date().toISOString(),
      deadline: Date.now() + 300_000,
    };
    await runtime.enqueue(input);
    await vi.waitFor(() => expect(fixture.provider.state.callCount).toBe(1));
    expect((await runtime.getPendingRequests()).requests[0].requestId).toBe(input.requestId);
    gate.resolve();
    await runtime.execute(input);
    expect(fixture.options.send).not.toHaveBeenCalled();
  });
});
