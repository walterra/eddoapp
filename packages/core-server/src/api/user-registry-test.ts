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

/** Functions required to create test user registry */
export interface TestUserRegistryFunctions {
  create: (
    context: TestUserRegistryContext,
    entry: CreateUserRegistryEntry,
  ) => Promise<UserRegistryEntry>;
  findByUsername: (
    context: TestUserRegistryContext,
    username: string,
  ) => Promise<UserRegistryEntry | null>;
  findByTelegramId: (
    context: TestUserRegistryContext,
    telegramId: number,
  ) => Promise<UserRegistryEntry | null>;
  findByEmail: (
    context: TestUserRegistryContext,
    email: string,
  ) => Promise<UserRegistryEntry | null>;
  findByMcpApiKey: (
    context: TestUserRegistryContext,
    apiKey: string,
  ) => Promise<UserRegistryEntry | null>;
  update: (
    context: TestUserRegistryContext,
    id: string,
    updates: UpdateUserRegistryEntry,
  ) => Promise<UserRegistryEntry>;
  list: (context: TestUserRegistryContext) => Promise<UserRegistryEntry[]>;
  delete: (context: TestUserRegistryContext, id: string) => Promise<void>;
  ensureUserDatabase: (context: TestUserRegistryContext, username: string) => Promise<void>;
  getUserDatabase: (
    context: TestUserRegistryContext,
    username: string,
  ) => nano.DocumentScope<Record<string, unknown>>;
}

/**
 * Check if error is a CouchDB "not found" error
 */
function isNotFoundError(error: unknown): boolean {
  return (
    error !== null && typeof error === 'object' && 'statusCode' in error && error.statusCode === 404
  );
}

/**
 * Check if error is a CouchDB "already exists" error
 */
function isAlreadyExistsError(error: unknown): boolean {
  return (
    error !== null && typeof error === 'object' && 'statusCode' in error && error.statusCode === 412
  );
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
    if (!isNotFoundError(error)) {
      throw error;
    }
  }

  try {
    await couchConnection.db.create(testConfig.dbName);
    console.log(`Created test user registry database: ${testConfig.dbName}`);
  } catch (createError: unknown) {
    if (isAlreadyExistsError(createError)) {
      console.log(`Test user registry database already exists: ${testConfig.dbName}`);
    } else {
      throw createError;
    }
  }
}

/**
 * Build user registry operations from context and functions
 */
function buildOperations(
  context: TestUserRegistryContext,
  fns: TestUserRegistryFunctions,
): UserRegistryOperations {
  return {
    create: (entry: CreateUserRegistryEntry) => fns.create(context, entry),
    findByUsername: (username: string) => fns.findByUsername(context, username),
    findByTelegramId: (telegramId: number) => fns.findByTelegramId(context, telegramId),
    findByEmail: (email: string) => fns.findByEmail(context, email),
    findByMcpApiKey: (apiKey: string) => fns.findByMcpApiKey(context, apiKey),
    update: (id: string, updates: UpdateUserRegistryEntry) => fns.update(context, id, updates),
    list: () => fns.list(context),
    delete: (id: string) => fns.delete(context, id),
    setupDatabase: async () => {
      await ensureTestDatabase(context);
      await setupDesignDocuments(context.db);
    },
    ensureUserDatabase: (username: string) => fns.ensureUserDatabase(context, username),
    getUserDatabase: (username: string) => fns.getUserDatabase(context, username),
  };
}

/**
 * Create a test user registry for integration tests
 * Uses a separate test database to avoid polluting production data
 */
export async function createTestUserRegistry(
  couchDbUrl: string,
  env: Env,
  fns: TestUserRegistryFunctions,
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

  return buildOperations(context, fns);
}

// Re-export for external use
export type { TestUserRegistryContext };
