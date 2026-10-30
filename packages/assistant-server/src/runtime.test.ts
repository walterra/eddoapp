import { createModels } from '@earendil-works/pi-ai/models';
import { fauxAssistantMessage, fauxProvider } from '@earendil-works/pi-ai/providers/faux';
import type { AssistantRequest } from '@eddo/core-shared';
import { CouchDbStorage, type CouchDatabase, type CouchDocument } from 'pi-durable-couchdb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openDurableRuntime, type DurableRuntime, type DurableRuntimeOptions } from './runtime.js';

const runtimes: DurableRuntime[] = [];
afterEach(async () => {
  await Promise.all(runtimes.splice(0).map((runtime) => runtime.close()));
});

/** Retains revision-checked journal state without importing a channel host or database server. */
function createDatabase(): CouchDatabase {
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

function request(): AssistantRequest {
  return {
    account: { username: 'alice' },
    source: { channel: 'web' },
    requestId: 'web:alice:1',
    conversationId: 'shared-conversation',
    text: 'List tasks',
    createdAt: new Date().toISOString(),
    deadline: Date.now() + 300_000,
  };
}

interface RuntimeFixture {
  database: CouchDatabase;
  provider: ReturnType<typeof fauxProvider>;
  options: DurableRuntimeOptions;
}

async function fixture(): Promise<RuntimeFixture> {
  const database = createDatabase();
  const provider = fauxProvider({ models: [{ id: 'test' }] });
  const models = createModels();
  models.setProvider(provider.provider);
  const options: DurableRuntimeOptions = {
    storage: await CouchDbStorage.open(database),
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
    project: vi.fn().mockResolvedValue(undefined),
    onReport: vi.fn(),
  };
  return { database, provider, options };
}

async function open(options: DurableRuntimeOptions): Promise<DurableRuntime> {
  const runtime = await openDurableRuntime(options);
  runtimes.push(runtime);
  return runtime;
}

describe('standalone assistant server runtime', () => {
  it('executes through injected delivery and projection without Telegram or MCP transport', async () => {
    const test = await fixture();
    test.provider.setResponses([fauxAssistantMessage('Task summary')]);
    const runtime = await open(test.options);

    expect(await runtime.execute(request())).toBe('Task summary');
    expect(test.options.deliver).toHaveBeenCalledOnce();
    expect(test.options.project).toHaveBeenCalledWith(
      expect.objectContaining({ source: { channel: 'web' } }),
      'Task summary',
    );
    expect(test.options.authorize).toHaveBeenCalled();
    expect(await runtime.getRequestStatus('web:alice:missing')).toBeNull();
    expect(await runtime.getRequestStatus(request().requestId)).toEqual({
      requestId: request().requestId,
      conversationId: 'shared-conversation',
      status: 'completed',
    });
  });

  it('reopens the same journal and deduplicates without repeating injected effects', async () => {
    const test = await fixture();
    test.provider.setResponses([fauxAssistantMessage('Persisted summary')]);
    const input = request();
    const first = await open(test.options);
    await first.execute(input);
    await first.close();
    const second = await open({
      ...test.options,
      storage: await CouchDbStorage.open(test.database),
    });

    expect(await second.execute(input)).toBe('Persisted summary');
    expect(test.provider.state.callCount).toBe(1);
    expect(test.options.deliver).toHaveBeenCalledOnce();
    expect(test.options.project).toHaveBeenCalledOnce();
    expect(await second.getRequestStatus(input.requestId)).toEqual({
      requestId: input.requestId,
      conversationId: input.conversationId,
      status: 'completed',
    });
  });

  it('reports native queueing behind another channel request without starting another generation', async () => {
    const test = await fixture();
    let release = (): void => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    test.provider.setResponses([
      async () => {
        await gate;
        return fauxAssistantMessage('First');
      },
      fauxAssistantMessage('Second'),
    ]);
    const runtime = await open(test.options);
    const first = request();
    const second = { ...request(), requestId: 'web:alice:2' };
    await runtime.enqueue(first);
    await runtime.enqueue(second);
    try {
      await vi.waitFor(() => expect(test.provider.state.callCount).toBe(1));
      await vi.waitFor(async () =>
        expect((await runtime.getRequestStatus(second.requestId))?.status).toBe('queued'),
      );
      expect(test.provider.state.callCount).toBe(1);
    } finally {
      release();
    }
    expect(await runtime.execute(first)).toBe('First');
    expect(await runtime.execute(second)).toBe('Second');
  });

  it('reads live delivery state without waiting for a terminal outcome', async () => {
    const test = await fixture();
    test.provider.setResponses([fauxAssistantMessage('Summary')]);
    let release = (): void => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const deliver = test.options.deliver;
    test.options.deliver = async (...args) => {
      await gate;
      await deliver(...args);
    };
    const runtime = await open(test.options);
    await runtime.enqueue(request());
    await vi.waitFor(async () =>
      expect((await runtime.getRequestStatus(request().requestId))?.status).toBe('delivering'),
    );
    release();
    expect(await runtime.execute(request())).toBe('Summary');
  });
});
