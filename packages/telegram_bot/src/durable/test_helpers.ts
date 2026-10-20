import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { createModels } from 'pi-ai-durable/models';
import { fauxProvider } from 'pi-ai-durable/providers/faux';
import { CouchDbStorage, type CouchDatabase, type CouchDocument } from 'pi-durable-couchdb';
import { vi } from 'vitest';
import type { DurableRuntimeOptions } from './runtime.js';
import type { DurableRequestInput } from './state.js';

/** Keeps journal documents across Harness instances with revision-checked publication. */
export function createJournalDatabase(): CouchDatabase {
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

export interface RuntimeFixture {
  options: DurableRuntimeOptions;
  provider: ReturnType<typeof fauxProvider>;
  reopen: () => Promise<DurableRuntimeOptions>;
}

/** Creates an isolated real Harness and CouchDB journal adapter without network calls. */
export async function createRuntimeFixture(): Promise<RuntimeFixture> {
  const database = createJournalDatabase();
  const provider = fauxProvider({ models: [{ id: 'test' }] });
  const models = createModels();
  models.setProvider(provider.provider);
  const options: DurableRuntimeOptions = {
    storage: await CouchDbStorage.open(database),
    models,
    client: { client: {} as Client, tools: [], invoke: vi.fn(), close: vi.fn() },
    username: 'alice',
    telegramId: 123,
    model: { provider: provider.provider.id, modelId: 'test' },
    instructions: 'Use tools when needed.',
    authorize: vi.fn().mockResolvedValue(undefined),
    send: vi.fn().mockResolvedValue(undefined),
    project: vi.fn().mockResolvedValue(undefined),
    onReport: vi.fn(),
  };
  return {
    options,
    provider,
    reopen: async () => ({ ...options, storage: await CouchDbStorage.open(database) }),
  };
}

/** Builds an input with stable Telegram update identity. */
export function createTestInput(overrides: Partial<DurableRequestInput> = {}): DurableRequestInput {
  return {
    requestId: 'telegram:bot:1',
    text: 'List tasks',
    conversationId: 'assistant_default',
    chatId: 123,
    telegramId: 123,
    messageId: 1,
    createdAt: new Date().toISOString(),
    deadline: Date.now() + 300_000,
    ...overrides,
  };
}

export interface Deferred {
  promise: Promise<void>;
  resolve: () => void;
}

/** Controls a crash window without timers or real providers. */
export function deferred(): Deferred {
  let resolve = (): void => {};
  const promise = new Promise<void>((finish) => {
    resolve = finish;
  });
  return { promise, resolve };
}
