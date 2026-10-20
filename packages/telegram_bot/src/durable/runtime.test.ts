import { createModels } from '@earendil-works/pi-ai/models';
import {
  fauxAssistantMessage,
  fauxProvider,
  fauxToolCall,
} from '@earendil-works/pi-ai/providers/faux';
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

describe('durable Telegram runtime', () => {
  it('applies a changed LLM_MODEL to existing conversations after reopening', async () => {
    const fixture = await createRuntimeFixture();
    fixture.provider.setResponses([fauxAssistantMessage('Original model answer')]);
    const first = await open(fixture.options);
    await first.execute(createTestInput());
    await first.close();
    const replacement = fauxProvider({ provider: 'replacement', models: [{ id: 'new-model' }] });
    replacement.setResponses([
      (context) => {
        expect(JSON.stringify(context.messages)).toContain('Original model answer');
        return fauxAssistantMessage('Replacement model answer');
      },
    ]);
    const models = createModels();
    models.setProvider(replacement.provider);
    const second = await open({
      ...(await fixture.reopen()),
      models,
      model: { provider: 'replacement', modelId: 'new-model' },
    });
    expect(await second.execute(createTestInput({ requestId: 'telegram:bot:new-model' }))).toBe(
      'Replacement model answer',
    );
    expect(replacement.state.callCount).toBe(1);
  });

  it('deduplicates concurrent updates and projects before delivery', async () => {
    const { options, provider } = await createRuntimeFixture();
    provider.setResponses([fauxAssistantMessage('Three tasks')]);
    const runtime = await open(options);
    const input = createTestInput();
    expect(await Promise.all([runtime.execute(input), runtime.execute(input)])).toEqual([
      'Three tasks',
      'Three tasks',
    ]);
    expect(provider.state.callCount).toBe(1);
    expect(options.project).toHaveBeenCalledOnce();
    expect(options.send).toHaveBeenCalledExactlyOnceWith(123, 'Three tasks');
    expect(vi.mocked(options.project).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(options.send).mock.invocationCallOrder[0],
    );
  });

  it('deduplicates a completed update after reopening and /new', async () => {
    const fixture = await createRuntimeFixture();
    fixture.provider.setResponses([fauxAssistantMessage('Original')]);
    const first = await open(fixture.options);
    await first.execute(createTestInput());
    await first.close();
    const second = await open(await fixture.reopen());
    expect(await second.execute(createTestInput({ conversationId: 'new_conversation' }))).toBe(
      'Original',
    );
    expect(fixture.provider.state.callCount).toBe(1);
    expect(fixture.options.send).toHaveBeenCalledOnce();
  });

  it('resumes persisted delivery without rerunning the model', async () => {
    const fixture = await createRuntimeFixture();
    fixture.provider.setResponses([fauxAssistantMessage('Persisted answer')]);
    const gate = deferred();
    fixture.options.send = vi.fn().mockImplementation(() => gate.promise);
    const first = await open(fixture.options);
    const pending = first.execute(createTestInput()).catch(() => undefined);
    await vi.waitFor(() => expect(fixture.options.send).toHaveBeenCalledOnce());
    const closing = first.close();
    gate.resolve();
    await closing;
    await pending;
    const options = await fixture.reopen();
    options.send = vi.fn().mockResolvedValue(undefined);
    const second = await open(options);
    await vi.waitFor(() =>
      expect(options.send).toHaveBeenCalledExactlyOnceWith(123, 'Persisted answer'),
    );
    expect(await second.execute(createTestInput())).toBe('Persisted answer');
    expect(fixture.provider.state.callCount).toBe(1);
  });

  it('does not replay an interrupted mutation after reopening', async () => {
    const fixture = await createRuntimeFixture();
    fixture.options.client.tools = [
      {
        name: 'createTodo',
        description: 'Create a todo',
        inputSchema: { type: 'object', properties: {} },
      },
    ];
    const gate = deferred();
    fixture.options.client.invoke = vi.fn().mockImplementation(async () => {
      await gate.promise;
      return [{ type: 'text', text: 'created' }];
    });
    fixture.provider.setResponses([
      fauxAssistantMessage(fauxToolCall('createTodo', {}), { stopReason: 'toolUse' }),
      fauxAssistantMessage('Inspect task state before retrying'),
    ]);
    const first = await open(fixture.options);
    const pending = first.execute(createTestInput()).catch(() => undefined);
    await vi.waitFor(() => expect(fixture.options.client.invoke).toHaveBeenCalledOnce());
    const closing = first.close();
    gate.resolve();
    await closing;
    await pending;
    const second = await open(await fixture.reopen());
    expect(await second.execute(createTestInput())).toBe('Inspect task state before retrying');
    expect(fixture.options.client.invoke).toHaveBeenCalledOnce();
  });

  it('separates /new conversations while retaining native follow-up history', async () => {
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
    await runtime.execute(createTestInput({ requestId: 'telegram:bot:2' }));
    await runtime.execute(
      createTestInput({ requestId: 'telegram:bot:3', conversationId: 'new_conversation' }),
    );
    expect(lengths).toEqual([1, 2, 1]);
  });

  it('rejects revoked users before sending output', async () => {
    const fixture = await createRuntimeFixture();
    fixture.options.authorize = vi.fn().mockRejectedValue(new Error('revoked'));
    const runtime = await open(fixture.options);
    await expect(runtime.execute(createTestInput())).rejects.toThrow('faulted');
    expect(fixture.provider.state.callCount).toBe(0);
    expect(fixture.options.send).not.toHaveBeenCalled();
  });
});
