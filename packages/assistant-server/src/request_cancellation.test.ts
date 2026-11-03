import { createModels } from '@earendil-works/pi-ai/models';
import {
  fauxAssistantMessage,
  fauxProvider,
  type FauxResponseFactory,
} from '@earendil-works/pi-ai/providers/faux';
import { Harness } from '@earendil-works/pi-durable';
import type { AssistantRequest } from '@eddo/core-shared';
import { CouchDbStorage, type CouchDatabase, type CouchDocument } from 'pi-durable-couchdb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openDurableRuntime, type DurableRuntime, type DurableRuntimeOptions } from './runtime.js';

const runtimes: DurableRuntime[] = [];
async function closeCancellationRuntimes(): Promise<void> {
  await Promise.all(runtimes.splice(0).map((runtime) => runtime.close()));
}
function database(): CouchDatabase {
  const documents = new Map<string, CouchDocument>();
  let revision = 0;
  return {
    get: async (id) => structuredClone(documents.get(id)),
    put: async (document) => {
      if (documents.get(document._id)?._rev !== document._rev) throw new Error('revision conflict');
      const rev = String(++revision);
      documents.set(document._id, structuredClone({ ...document, _rev: rev }));
      return { rev };
    },
  };
}
function cancellationInput(id = '1'): AssistantRequest {
  return {
    account: { username: 'alice' },
    source: { channel: 'web' },
    requestId: `web:alice:${id}`,
    conversationId: 'shared-conversation',
    text: 'List tasks',
    createdAt: new Date().toISOString(),
    deadline: Date.now() + 300_000,
  };
}
async function cancellationFixture() {
  const journal = database();
  const provider = fauxProvider({ models: [{ id: 'test' }] });
  const models = createModels();
  models.setProvider(provider.provider);
  const options: Omit<DurableRuntimeOptions, 'storage'> = {
    models,
    model: { provider: provider.provider.id, modelId: 'test' },
    username: 'alice',
    instructions: 'Answer task questions.',
    authorize: vi.fn().mockResolvedValue(undefined),
    prepareReply: (_input, answer) => ({ answer, printable: false }),
    deliver: vi
      .fn<DurableRuntimeOptions['deliver']>()
      .mockImplementation(async (task, runtime, context) => {
        await runtime.commit(
          () => ({
            status: 'running',
            checkpoint: { phase: 'project', answer: task.state.checkpoint.answer },
          }),
          context,
        );
      }),
    projectAccepted: vi.fn().mockResolvedValue(undefined),
    project: vi.fn().mockResolvedValue(undefined),
    onReport: vi.fn(),
  };
  const open = async (): Promise<DurableRuntime> => {
    const runtime = await openDurableRuntime({
      ...options,
      storage: await CouchDbStorage.open(journal),
    });
    runtimes.push(runtime);
    return runtime;
  };
  return { provider, options, open };
}

/** Holds one real provider-boundary call until released or its native invocation is cancelled. */
function heldReply() {
  let finish = (): void => {};
  let signal: AbortSignal | undefined;
  const gate = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const response: FauxResponseFactory = async (_context, options) => {
    signal = options?.signal;
    signal?.addEventListener('abort', finish, { once: true });
    if (signal?.aborted) finish();
    try {
      await gate;
      return fauxAssistantMessage('First reply');
    } finally {
      signal?.removeEventListener('abort', finish);
    }
  };
  return { response, release: () => finish(), signal: () => signal };
}

afterEach(async () => {
  vi.restoreAllMocks();
  await closeCancellationRuntimes();
});

describe('durable request cancellation', () => {
  it('fences an unconfirmed identity against late admission, duplicate cancellation, and restart', async () => {
    const test = await cancellationFixture();
    const first = await test.open();
    const input = cancellationInput();
    const expected = {
      requestId: input.requestId,
      conversationId: input.conversationId,
      status: 'aborted',
    };
    expect(await first.cancelRequest(input.requestId, input.conversationId)).toEqual(expected);
    await first.enqueue(input);
    expect(await first.cancelRequest(input.requestId, input.conversationId)).toEqual(expected);
    await first.close();
    const second = await test.open();
    await second.enqueue(input);
    expect(await second.getRequestStatus(input.requestId)).toEqual(expected);
    expect(await second.getPendingRequests()).toEqual({ requests: [], hasMore: false });
    expect(test.provider.state.callCount).toBe(0);
    expect(test.options.projectAccepted).not.toHaveBeenCalled();
    expect(test.options.deliver).not.toHaveBeenCalled();
  });

  it('withdraws a queued request without aborting another channel active in the same conversation', async () => {
    const test = await cancellationFixture();
    const hold = heldReply();
    test.provider.setResponses([hold.response]);
    test.options.telegramId = 123;
    const runtime = await test.open();
    const first = {
      ...cancellationInput('telegram'),
      source: {
        channel: 'telegram' as const,
        telegram: { userId: 123, chatId: 123, messageId: 1 },
      },
      requestId: 'telegram:123:1',
    };
    const second = cancellationInput('queued');
    await runtime.enqueue(first);
    await runtime.enqueue(second);
    await vi.waitFor(() => expect(test.provider.state.callCount).toBe(1));
    await vi.waitFor(async () =>
      expect((await runtime.getRequestStatus(second.requestId))?.status).toBe('queued'),
    );
    try {
      expect((await runtime.cancelRequest(second.requestId, second.conversationId)).status).toBe(
        'aborted',
      );
      expect(hold.signal()?.aborted).toBe(false);
      await expect(runtime.enqueue({ ...second, text: 'Changed payload' })).rejects.toThrow(
        'different payload',
      );
    } finally {
      hold.release();
    }
    expect(await runtime.execute(first)).toBe('First reply');
    expect(test.provider.state.callCount).toBe(1);
    expect(test.options.deliver).toHaveBeenCalledOnce();
  });

  it('aborts active generation without running its delivery or cancelling the next queued request', async () => {
    const test = await cancellationFixture();
    const hold = heldReply();
    test.provider.setResponses([hold.response, fauxAssistantMessage('Second reply')]);
    const runtime = await test.open();
    const first = cancellationInput();
    const second = cancellationInput('2');
    await runtime.enqueue(first);
    await vi.waitFor(() => expect(test.provider.state.callCount).toBe(1));
    await runtime.enqueue(second);
    try {
      expect((await runtime.cancelRequest(first.requestId, first.conversationId)).status).toBe(
        'aborted',
      );
      expect(hold.signal()?.aborted).toBe(true);
    } finally {
      hold.release();
    }
    expect(await runtime.execute(second)).toBe('Second reply');
    expect(test.provider.state.callCount).toBe(2);
    expect(test.options.deliver).toHaveBeenCalledOnce();
    expect(test.options.project).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: second.requestId }),
      'Second reply',
    );
    expect(await runtime.getRequestStatus(first.requestId)).toMatchObject({ status: 'aborted' });
  });

  it('preserves an already completed outcome without replaying or undoing delivery', async () => {
    const test = await cancellationFixture();
    test.provider.setResponses([fauxAssistantMessage('Done')]);
    const runtime = await test.open();
    const input = cancellationInput();
    await runtime.execute(input);
    expect((await runtime.cancelRequest(input.requestId, input.conversationId)).status).toBe(
      'completed',
    );
    expect(await runtime.execute(input)).toBe('Done');
    expect(test.provider.state.callCount).toBe(1);
    expect(test.options.deliver).toHaveBeenCalledOnce();
  });

  it('marks interrupted cancellation before recovered generation can resume', async () => {
    const test = await cancellationFixture();
    const hold = heldReply();
    test.provider.setResponses([hold.response]);
    const original = Harness.open.bind(Harness);
    const opening = vi.spyOn(Harness, 'open').mockImplementation(async (...args) => {
      const harness = await original(...args);
      vi.spyOn(harness, 'abortTask').mockRejectedValueOnce(new Error('Interrupted cancellation'));
      return harness;
    });
    const first = await test.open();
    opening.mockRestore();
    const input = cancellationInput();
    await first.enqueue(input);
    await vi.waitFor(() => expect(test.provider.state.callCount).toBe(1));
    await expect(first.cancelRequest(input.requestId, input.conversationId)).rejects.toThrow(
      'Interrupted cancellation',
    );
    expect((await first.getRequestStatus(input.requestId))?.status).toBe('working');
    await first.close();
    const second = await test.open();
    await vi.waitFor(async () =>
      expect((await second.getRequestStatus(input.requestId))?.status).toBe('aborted'),
    );
    await second.enqueue(input);
    expect(test.provider.state.callCount).toBe(1);
    expect(test.options.deliver).not.toHaveBeenCalled();
    expect(await second.getPendingRequests()).toEqual({ requests: [], hasMore: false });
  });

  it.each(['web:bob:1', 'telegram:123:1', 'scheduled:alice:1'])(
    'rejects cancellation outside the owner web namespace: %s',
    async (requestId) => {
      const test = await cancellationFixture();
      const runtime = await test.open();
      await expect(runtime.cancelRequest(requestId, 'shared-conversation')).rejects.toThrow(
        'account-scoped',
      );
      expect(await runtime.getRequestStatus(requestId)).toBeNull();
      expect(test.provider.state.callCount).toBe(0);
    },
  );
});
