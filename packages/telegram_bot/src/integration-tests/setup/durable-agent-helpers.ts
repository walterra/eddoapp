import {
  createAssistantConversationDatabase,
  createTestUserRegistry,
  getUserDatabaseName,
  validateEnv,
} from '@eddo/core-server';
import {
  buildTestUserPreferences,
  buildUserRegistryEntry,
  ensureRegistryApiKey,
  generateTestUserData,
  setupUserDatabase,
  type TestUser,
} from './test-agent-server-helpers.js';

/** Creates an authenticated user only in the runner's disposable CouchDB container. */
export async function createAgentTestUser(apiKey: string): Promise<TestUser> {
  if (!process.env.COUCHDB_URL || process.env.NODE_ENV !== 'test')
    throw new Error(
      'Agent integration tests require a testcontainer COUCHDB_URL and NODE_ENV=test',
    );
  const env = validateEnv(process.env);
  const registry = await createTestUserRegistry(env.COUCHDB_URL, env);
  await registry.setupDatabase?.();
  const setAt = new Date().toISOString();
  const user = generateTestUserData(buildTestUserPreferences(undefined, apiKey, setAt));
  user.database_name = getUserDatabaseName(env, user.username);
  const existing = await registry.findByUsername(user.username);
  const record = existing ?? (await registry.create(buildUserRegistryEntry(user)));
  await ensureRegistryApiKey(registry, record, apiKey, setAt);
  await setupUserDatabase(env.COUCHDB_URL, user.database_name);
  return user;
}

/** Uses the application's real conversation/projection database without importing a legacy history store. */
export async function conversationDatabase(
  user: TestUser,
): Promise<ReturnType<typeof createAssistantConversationDatabase>> {
  const env = validateEnv(process.env);
  const database = createAssistantConversationDatabase(env.COUCHDB_URL, env, user.username);
  await database.ensureDatabase();
  await database.setupDesignDocuments();
  return database;
}
