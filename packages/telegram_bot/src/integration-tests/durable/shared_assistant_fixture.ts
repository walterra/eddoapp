import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { createInternalAssistantHandler } from '@eddo/assistant-server/internal_handler';
import type { DurableRuntime } from '@eddo/assistant-server/runtime';
import {
  createAssistantConversationDatabase,
  createEnv,
  createUserRegistry,
  getChatDatabaseName,
  getUserDatabaseName,
} from '@eddo/core-server';
import {
  createDefaultUserPreferences,
  type UserRegistryEntry,
  type UserRegistryOperations,
} from '@eddo/core-shared';
import nano from 'nano';
import { randomUUID } from 'node:crypto';
import { openCouchDbStorage } from 'pi-durable-couchdb';
import { vi } from 'vitest';
import { sharedAssistantHttpFixture } from '../../../../web-api/src/assistant/integration-tests/shared_assistant_http_fixture';
import {
  openAssistantRuntime,
  type AssistantRuntimeOptions,
} from '../../durable/assistant_runtime.js';
import { createCouchEndpoint, type CouchEndpoint } from '../../durable/couch.js';
import { createHostProjection } from '../../durable/host_projection.js';
import { createWebHostOperations } from '../../durable/host_requests.js';
import { createRuntimeFixture } from '../../durable/test_helpers.js';

type HttpFixture = Awaited<ReturnType<typeof sharedAssistantHttpFixture>>;
interface FixtureAccount {
  registry: UserRegistryOperations;
  user: UserRegistryEntry;
}
export interface SharedAssistantFixture {
  username: string;
  conversationId: string;
  history: ReturnType<typeof createAssistantConversationDatabase>;
  provider: Awaited<ReturnType<typeof createRuntimeFixture>>['provider'];
  options: AssistantRuntimeOptions;
  owner: FixtureAccount;
  app: HttpFixture['app'];
  headers: Record<string, string>;
  current: () => DurableRuntime;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  cleanup: () => Promise<void>;
  interruptProjection: () => void;
}

async function account(username: string, linked: boolean) {
  const env = createEnv();
  const registry = createUserRegistry(env.COUCHDB_URL, env);
  await registry.ensureDatabase();
  const user = await registry.create({
    username,
    email: `${username}@example.test`,
    password_hash: 'no-login',
    database_name: getUserDatabaseName(env, username),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    permissions: ['read', 'write'],
    status: 'active',
    version: 'alpha2',
    preferences: createDefaultUserPreferences(),
    ...(linked ? { telegram_id: 123 } : {}),
  });
  await registry.update(user._id, {
    preferences: { ...user.preferences, mcpApiKey: 'fixture-current-key', dailyBriefing: linked },
  });
  return { registry, user };
}
async function databases(username: string) {
  const env = createEnv();
  const history = createAssistantConversationDatabase(env.COUCHDB_URL, env, username);
  await history.ensureDatabase();
  await history.setupDesignDocuments();
  const conversationId = (await history.getOrCreateActive())._id;
  const journal = `shared_journal_${randomUUID().replaceAll('-', '')}`;
  await nano(env.COUCHDB_URL).db.create(journal);
  return {
    env,
    history,
    conversationId,
    endpoint: createCouchEndpoint(env.COUCHDB_URL, journal),
    cleanup: async (): Promise<void> => {
      await nano(env.COUCHDB_URL).db.destroy(journal);
      await nano(env.COUCHDB_URL).db.destroy(getChatDatabaseName(env, username));
    },
  };
}
function projection(username: string) {
  const writer = createHostProjection(username);
  let failProjection = false;
  const project = vi
    .fn<AssistantRuntimeOptions['project']>()
    .mockImplementation(async (request, answer) => {
      if (request.source.channel === 'web' && failProjection) {
        failProjection = false;
        throw new Error('Injected projection interruption');
      }
      await writer.project(request, answer);
    });
  return {
    project,
    projectAccepted: writer.projectAccepted,
    interruptProjection: () => {
      failProjection = true;
    },
  };
}
function lifecycle(options: AssistantRuntimeOptions, endpoint: CouchEndpoint) {
  let runtime: DurableRuntime | undefined;
  return {
    current: (): DurableRuntime => {
      if (!runtime) throw new Error('Fixture owner is stopped');
      return runtime;
    },
    start: async (): Promise<void> => {
      if (runtime) throw new Error('Fixture forbids concurrent owners');
      runtime = await openAssistantRuntime({
        ...options,
        storage: await openCouchDbStorage(endpoint),
      });
    },
    stop: async (): Promise<void> => {
      await runtime?.close();
      runtime = undefined;
    },
  };
}

type FixtureDatabase = Awaited<ReturnType<typeof databases>>;
type CurrentRuntime = () => DurableRuntime;
function httpFixture(
  database: FixtureDatabase,
  username: string,
  current: CurrentRuntime,
): ReturnType<typeof sharedAssistantHttpFixture> {
  const operations = createWebHostOperations({
    runtime: async (name) => {
      if (name !== username) throw new Error('Foreign owner');
      return current();
    },
    conversationId: async () => (await database.history.getOrCreateActive())._id,
  });
  const token = 'shared-assistant-fixture-internal-token-at-least-32-characters';
  const internal = createInternalAssistantHandler({ ...operations, token });
  return sharedAssistantHttpFixture({
    env: database.env,
    username,
    token,
    fetch: async (url, init) => internal(new Request(url, init)),
  });
}

/** Connects real JWT routes, authorization, projections, and one disposable journal to a scripted model. */
export async function sharedAssistantFixture(linked = true): Promise<SharedAssistantFixture> {
  const username = `shared_${randomUUID().replaceAll('-', '')}`;
  const owner = await account(username, linked);
  const database = await databases(username);
  const model = await createRuntimeFixture();
  await model.options.storage.close(BACKGROUND_CONTEXT);
  const writer = projection(username);
  const options: AssistantRuntimeOptions = {
    ...model.options,
    ...writer,
    username,
    telegramId: linked ? 123 : undefined,
    progress: vi.fn(),
    print: vi.fn().mockResolvedValue(undefined),
  };
  const runtime = lifecycle(options, database.endpoint);
  const http = await httpFixture(database, username, runtime.current);
  return {
    ...http,
    ...runtime,
    username,
    history: database.history,
    conversationId: database.conversationId,
    provider: model.provider,
    options,
    owner,
    interruptProjection: writer.interruptProjection,
    cleanup: async (): Promise<void> => {
      await runtime.stop();
      await owner.registry.delete(owner.user._id);
      await database.cleanup();
    },
  };
}
