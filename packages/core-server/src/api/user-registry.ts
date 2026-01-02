import {
  type CreateUserRegistryEntry,
  type UpdateUserRegistryEntry,
  type UserContext,
  type UserRegistryEntry,
  type UserRegistryOperations,
  createDefaultUserPreferences,
  isLatestUserRegistryVersion,
  migrateUserRegistryEntry,
} from '@eddo/core-shared';
import nano from 'nano';

import { type Env } from '../config/env';
import {
  getUserDatabaseName,
  getUserRegistryDatabaseConfig,
  sanitizeUsername,
} from '../utils/database-names';
import { setupDesignDocuments } from './user-registry-design-docs.js';

interface UserRegistryContext {
  db: nano.DocumentScope<UserRegistryEntry>;
  couchConnection: nano.ServerScope;
  env: Env;
}

interface UserRegistryExtendedOperations {
  ensureDatabase: () => Promise<void>;
  setupDesignDocuments: () => Promise<void>;
  createUserContext: (entry: UserRegistryEntry) => UserContext;
}

interface UserRegistryInstance extends UserRegistryOperations, UserRegistryExtendedOperations {}

/**
 * Check if error is a 404 not found
 */
function isNotFoundError(error: unknown): boolean {
  return Boolean(
    error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 404,
  );
}

/**
 * Create a user registry instance with all operations
 */
export function createUserRegistry(
  couchUrl: string,
  env: Env,
  dbName?: string,
): UserRegistryInstance {
  const couchConnection = nano(couchUrl);
  const registryDbName = dbName || getUserRegistryDatabaseConfig(env).dbName;
  const db = couchConnection.db.use<UserRegistryEntry>(registryDbName);

  const context: UserRegistryContext = {
    db,
    couchConnection,
    env,
  };

  return {
    findByUsername: (username: string) => findByUsername(context, username),
    findByTelegramId: (telegramId: number) => findByTelegramId(context, telegramId),
    findByEmail: (email: string) => findByEmail(context, email),
    create: (entry: Omit<UserRegistryEntry, '_id' | '_rev'>) => create(context, entry),
    update: (id: string, updates: Partial<UserRegistryEntry>) => update(context, id, updates),
    list: () => list(context),
    delete: (id: string) => deleteEntry(context, id),
    ensureDatabase: () => ensureDatabase(context),
    setupDesignDocuments: () => setupDesignDocuments(db),
    createUserContext: (entry: UserRegistryEntry) => createUserContext(entry),
    ensureUserDatabase: (username: string) => ensureUserDatabase(context, username),
    getUserDatabase: (username: string) => getUserDatabase(context, username),
  };
}

/**
 * Ensure the user registry database exists
 */
async function ensureDatabase(context: UserRegistryContext): Promise<void> {
  const dbName = getUserRegistryDatabaseConfig(context.env).dbName;
  try {
    await context.couchConnection.db.get(dbName);
  } catch (error: unknown) {
    if (isNotFoundError(error)) {
      await context.couchConnection.db.create(dbName);
      console.log(`Created user registry database: ${dbName}`);
    } else {
      throw error;
    }
  }
}

async function findByUsername(
  context: UserRegistryContext,
  username: string,
): Promise<UserRegistryEntry | null> {
  const sanitizedUsername = sanitizeUsername(username);
  const id = `user_${sanitizedUsername}`;

  try {
    const doc = await context.db.get(id);
    return migrateIfNeeded(context, doc as UserRegistryEntry);
  } catch (error: unknown) {
    if (isNotFoundError(error)) {
      return null;
    }
    throw error;
  }
}

async function findByTelegramId(
  context: UserRegistryContext,
  telegramId: number,
): Promise<UserRegistryEntry | null> {
  try {
    const result = await context.db.view('queries', 'by_telegram_id', {
      key: telegramId,
      include_docs: true,
    });

    if (result.rows.length === 0) {
      return null;
    }

    const doc = result.rows[0].doc;
    return doc ? migrateIfNeeded(context, doc as UserRegistryEntry) : null;
  } catch (error: unknown) {
    if (isNotFoundError(error)) {
      return null;
    }
    throw error;
  }
}

async function findByEmail(
  context: UserRegistryContext,
  email: string,
): Promise<UserRegistryEntry | null> {
  try {
    const result = await context.db.view('queries', 'by_email', {
      key: email,
      include_docs: true,
    });

    if (result.rows.length === 0) {
      return null;
    }

    const doc = result.rows[0].doc;
    return doc ? migrateIfNeeded(context, doc as UserRegistryEntry) : null;
  } catch (error: unknown) {
    if (isNotFoundError(error)) {
      return null;
    }
    throw error;
  }
}

async function create(
  context: UserRegistryContext,
  entry: CreateUserRegistryEntry,
): Promise<UserRegistryEntry> {
  const sanitizedUsername = sanitizeUsername(entry.username);
  const now = new Date().toISOString();

  const newEntry: UserRegistryEntry = {
    ...entry,
    _id: `user_${sanitizedUsername}`,
    database_name: getUserDatabaseName(context.env, entry.username),
    created_at: entry.created_at || now,
    updated_at: now,
    permissions: entry.permissions || ['read', 'write'],
    status: entry.status || 'active',
    preferences: createDefaultUserPreferences(),
    version: 'alpha2',
  };

  const result = await context.db.insert(newEntry);
  return { ...newEntry, _rev: result.rev };
}

async function update(
  context: UserRegistryContext,
  id: string,
  updates: UpdateUserRegistryEntry,
): Promise<UserRegistryEntry> {
  const existing = await context.db.get(id);
  const now = new Date().toISOString();

  // Migrate existing entry to latest version before updating
  const migratedExisting = migrateUserRegistryEntry(existing);

  const updated: UserRegistryEntry = {
    ...migratedExisting,
    ...updates,
    _id: id,
    _rev: existing._rev,
    updated_at: now,
    version: 'alpha2',
  };

  const result = await context.db.insert(updated);
  return { ...updated, _rev: result.rev };
}

async function list(context: UserRegistryContext): Promise<UserRegistryEntry[]> {
  const result = await context.db.list({ include_docs: true });
  return result.rows
    .filter((row) => row.doc && !row.id.startsWith('_design/'))
    .map((row) => migrateIfNeeded(context, row.doc! as UserRegistryEntry));
}

async function deleteEntry(context: UserRegistryContext, id: string): Promise<void> {
  const existing = await context.db.get(id);
  await context.db.destroy(id, existing._rev!);
}

/**
 * Create a user context from a registry entry
 */
function createUserContext(entry: UserRegistryEntry): UserContext {
  return {
    userId: entry._id,
    username: entry.username,
    telegramId: entry.telegram_id,
    databaseName: entry.database_name,
    permissions: entry.permissions,
    status: entry.status,
  };
}

/**
 * Migrate entry to latest version if needed
 */
function migrateIfNeeded(
  context: UserRegistryContext,
  entry: UserRegistryEntry,
): UserRegistryEntry {
  if (!isLatestUserRegistryVersion(entry)) {
    const migrated = migrateUserRegistryEntry(entry);
    // Save migrated version back to database in background
    context.db.insert(migrated).catch((error) => {
      console.error('Failed to save migrated user registry entry:', error);
    });
    return migrated;
  }
  return entry;
}

/**
 * Ensure user database exists for a user
 */
async function ensureUserDatabase(context: UserRegistryContext, username: string): Promise<void> {
  const dbName = getUserDatabaseName(context.env, username);
  try {
    await context.couchConnection.db.get(dbName);
  } catch (error: unknown) {
    if (isNotFoundError(error)) {
      await context.couchConnection.db.create(dbName);
      console.log(`Created user database: ${dbName}`);
    } else {
      throw error;
    }
  }
}

/**
 * Get user database instance
 */
function getUserDatabase(
  context: UserRegistryContext,
  username: string,
): nano.DocumentScope<Record<string, unknown>> {
  const dbName = getUserDatabaseName(context.env, username);
  return context.couchConnection.db.use(dbName);
}

/**
 * Create a test user registry for integration tests
 * Uses a separate test database to avoid polluting production data
 */
export async function createTestUserRegistry(
  couchDbUrl: string,
  env: Env,
): Promise<UserRegistryOperations> {
  const { createTestUserRegistry: createTestImpl } = await import('./user-registry-test.js');

  return createTestImpl(couchDbUrl, env, {
    create,
    findByUsername,
    findByTelegramId,
    findByEmail,
    update,
    list,
    delete: deleteEntry,
    ensureUserDatabase,
    getUserDatabase,
  });
}

// Legacy export for backward compatibility
export const UserRegistry = createUserRegistry;
