/**
 * Test user registry for integration tests
 */
import {
  type CreateUserRegistryEntry,
  type UpdateUserRegistryEntry,
  type UserRegistryEntry,
  type UserRegistryOperations,
} from '@eddo/core-shared';
import nano from 'nano';

import { type Env } from '../config/env';
import { setupDesignDocuments } from './user-registry-design-docs.js';

interface TestUserRegistryContext {
  db: nano.DocumentScope<UserRegistryEntry>;
  couchConnection: nano.ServerScope;
  env: Env;
  testConfig: { dbName: string };
}

/**
 * Ensure test database exists
 */
async function ensureTestDatabase(context: TestUserRegistryContext): Promise<void> {
  const { couchConnection, testConfig } = context;

  try {
    await couchConnection.db.get(testConfig.dbName);
    console.log(`Test user registry database already exists: ${testConfig.dbName}`);
    return;
  } catch (error: unknown) {
    const isNotFound =
      error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 404;

    if (!isNotFound) {
      throw error;
    }
  }

  // Database doesn't exist, create it
  try {
    await couchConnection.db.create(testConfig.dbName);
    console.log(`Created test user registry database: ${testConfig.dbName}`);
  } catch (createError: unknown) {
    const alreadyExists =
      createError &&
      typeof createError === 'object' &&
      'statusCode' in createError &&
      createError.statusCode === 412;

    if (alreadyExists) {
      console.log(`Test user registry database already exists: ${testConfig.dbName}`);
    } else {
      throw createError;
    }
  }
}

/**
 * Create a test user registry for integration tests
 * Uses a separate test database to avoid polluting production data
 */
export async function createTestUserRegistry(
  couchDbUrl: string,
  env: Env,
  // Import these functions dynamically to avoid circular dependencies
  createFn: (
    context: TestUserRegistryContext,
    entry: CreateUserRegistryEntry,
  ) => Promise<UserRegistryEntry>,
  findByUsernameFn: (
    context: TestUserRegistryContext,
    username: string,
  ) => Promise<UserRegistryEntry | null>,
  findByTelegramIdFn: (
    context: TestUserRegistryContext,
    telegramId: number,
  ) => Promise<UserRegistryEntry | null>,
  findByEmailFn: (
    context: TestUserRegistryContext,
    email: string,
  ) => Promise<UserRegistryEntry | null>,
  updateFn: (
    context: TestUserRegistryContext,
    id: string,
    updates: UpdateUserRegistryEntry,
  ) => Promise<UserRegistryEntry>,
  listFn: (context: TestUserRegistryContext) => Promise<UserRegistryEntry[]>,
  deleteEntryFn: (context: TestUserRegistryContext, id: string) => Promise<void>,
  ensureUserDatabaseFn: (context: TestUserRegistryContext, username: string) => Promise<void>,
  getUserDatabaseFn: (
    context: TestUserRegistryContext,
    username: string,
  ) => nano.DocumentScope<Record<string, unknown>>,
): Promise<UserRegistryOperations> {
  const { getTestUserRegistryConfig } = await import('../config/env.js');
  const testConfig = getTestUserRegistryConfig(env);

  const couchConnection = nano(couchDbUrl);
  const db = couchConnection.db.use<UserRegistryEntry>(testConfig.dbName);

  const context: TestUserRegistryContext = {
    couchConnection,
    db,
    env,
    testConfig,
  };

  return {
    create: (entry: CreateUserRegistryEntry) => createFn(context, entry),
    findByUsername: (username: string) => findByUsernameFn(context, username),
    findByTelegramId: (telegramId: number) => findByTelegramIdFn(context, telegramId),
    findByEmail: (email: string) => findByEmailFn(context, email),
    update: (id: string, updates: UpdateUserRegistryEntry) => updateFn(context, id, updates),
    list: () => listFn(context),
    delete: (id: string) => deleteEntryFn(context, id),
    setupDatabase: async () => {
      await ensureTestDatabase(context);
      await setupDesignDocuments(db);
    },
    ensureUserDatabase: (username: string) => ensureUserDatabaseFn(context, username),
    getUserDatabase: (username: string) => getUserDatabaseFn(context, username),
  };
}

// Re-export for external use
export type { TestUserRegistryContext };
