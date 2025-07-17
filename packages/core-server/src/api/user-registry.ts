import {
  type CreateUserRegistryEntry,
  type UpdateUserRegistryEntry,
  type UserContext,
  type UserRegistryEntry,
  type UserRegistryOperations,
} from '@eddo/core-shared';
import {
  isLatestUserRegistryVersion,
  migrateUserRegistryEntry,
} from '@eddo/core-shared';
import nano from 'nano';

import { type Env } from '../config/env';
import {
  getUserApiKey,
  getUserDatabaseName,
  getUserRegistryDatabaseConfig,
  sanitizeUsername,
} from '../utils/database-names';

interface UserRegistryContext {
  db: nano.DocumentScope<UserRegistryEntry>;
  couchConnection: nano.ServerScope;
  env: Env;
}

interface UserRegistryExtendedOperations {
  ensureDatabase: () => Promise<void>;
  setupDesignDocuments: () => Promise<void>;
  createUserContext: (entry: UserRegistryEntry) => UserContext;
  ensureUserDatabase: (username: string) => Promise<void>;
  getUserDatabase: (
    username: string,
  ) => nano.DocumentScope<Record<string, unknown>>;
}

interface UserRegistryInstance
  extends UserRegistryOperations,
    UserRegistryExtendedOperations {}

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
    findByTelegramId: (telegramId: number) =>
      findByTelegramId(context, telegramId),
    findByEmail: (email: string) => findByEmail(context, email),
    create: (entry: Omit<UserRegistryEntry, '_id' | '_rev'>) =>
      create(context, entry),
    update: (id: string, updates: Partial<UserRegistryEntry>) =>
      update(context, id, updates),
    list: () => list(context),
    delete: (id: string) => deleteEntry(context, id),
    ensureDatabase: () => ensureDatabase(context),
    setupDesignDocuments: () => setupDesignDocuments(context),
    createUserContext: (entry: UserRegistryEntry) => createUserContext(entry),
    ensureUserDatabase: (username: string) =>
      ensureUserDatabase(context, username),
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
    if (
      error &&
      typeof error === 'object' &&
      'statusCode' in error &&
      error.statusCode === 404
    ) {
      // Database doesn't exist, create it
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
    return migrateIfNeeded(context, doc);
  } catch (error: unknown) {
    if (
      error &&
      typeof error === 'object' &&
      'statusCode' in error &&
      error.statusCode === 404
    ) {
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
    // Use a view to find by telegram_id
    const result = await context.db.view('queries', 'by_telegram_id', {
      key: telegramId,
      include_docs: true,
    });

    if (result.rows.length === 0) {
      return null;
    }

    const doc = result.rows[0].doc;
    return doc ? migrateIfNeeded(context, doc) : null;
  } catch (error: unknown) {
    if (
      error &&
      typeof error === 'object' &&
      'statusCode' in error &&
      error.statusCode === 404
    ) {
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
    // Use a view to find by email
    const result = await context.db.view('queries', 'by_email', {
      key: email,
      include_docs: true,
    });

    if (result.rows.length === 0) {
      return null;
    }

    const doc = result.rows[0].doc;
    return doc ? migrateIfNeeded(context, doc) : null;
  } catch (error: unknown) {
    if (
      error &&
      typeof error === 'object' &&
      'statusCode' in error &&
      error.statusCode === 404
    ) {
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
    api_key: getUserApiKey(entry.username, 'web'),
    created_at: entry.created_at || now,
    updated_at: now,
    permissions: entry.permissions || ['read', 'write'],
    status: entry.status || 'active',
    version: 'alpha1',
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

  const updated: UserRegistryEntry = {
    ...existing,
    ...updates,
    _id: id,
    _rev: existing._rev,
    updated_at: now,
    version: 'alpha1',
  };

  const result = await context.db.insert(updated);
  return { ...updated, _rev: result.rev };
}

async function list(
  context: UserRegistryContext,
): Promise<UserRegistryEntry[]> {
  const result = await context.db.list({ include_docs: true });
  return result.rows
    .filter((row) => row.doc && !row.id.startsWith('_design/'))
    .map((row) => migrateIfNeeded(context, row.doc!));
}

async function deleteEntry(
  context: UserRegistryContext,
  id: string,
): Promise<void> {
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
    apiKey: entry.api_key,
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
async function ensureUserDatabase(
  context: UserRegistryContext,
  username: string,
): Promise<void> {
  const dbName = getUserDatabaseName(context.env, username);
  try {
    await context.couchConnection.db.get(dbName);
  } catch (error: unknown) {
    if (
      error &&
      typeof error === 'object' &&
      'statusCode' in error &&
      error.statusCode === 404
    ) {
      // Database doesn't exist, create it
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
 * Setup design documents for user registry
 */
async function setupDesignDocuments(
  context: UserRegistryContext,
): Promise<void> {
  const designDoc = {
    _id: '_design/queries',
    views: {
      by_username: {
        map: `function(doc) { 
          if (doc.username) { 
            emit(doc.username, null); 
          } 
        }`,
      },
      by_email: {
        map: `function(doc) { 
          if (doc.email) { 
            emit(doc.email, null); 
          } 
        }`,
      },
      by_telegram_id: {
        map: `function(doc) { 
          if (doc.telegram_id) { 
            emit(doc.telegram_id, null); 
          } 
        }`,
      },
      by_status: {
        map: `function(doc) { 
          if (doc.status) { 
            emit(doc.status, null); 
          } 
        }`,
      },
      active_users: {
        map: `function(doc) { 
          if (doc.status === 'active') { 
            emit(doc.created_at, null); 
          } 
        }`,
      },
    },
  };

  try {
    await context.db.insert(designDoc);
  } catch (error: unknown) {
    if (
      error &&
      typeof error === 'object' &&
      'statusCode' in error &&
      error.statusCode === 409
    ) {
      // Design document already exists, update it
      const existing = await context.db.get('_design/queries');
      await context.db.insert({ ...designDoc, _rev: existing._rev });
    } else {
      throw error;
    }
  }
}

// Legacy export for backward compatibility
export const UserRegistry = createUserRegistry;
