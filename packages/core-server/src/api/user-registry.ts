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
    setupDesignDocuments: () => setupDesignDocuments(context),
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
    if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 404) {
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
    return migrateIfNeeded(context, doc as UserRegistryEntry);
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 404) {
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
    return doc ? migrateIfNeeded(context, doc as UserRegistryEntry) : null;
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 404) {
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
    return doc ? migrateIfNeeded(context, doc as UserRegistryEntry) : null;
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 404) {
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
    if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 404) {
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
async function setupDesignDocuments(context: UserRegistryContext): Promise<void> {
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

  // Try to create/update design document with retry logic for conflicts
  const maxRetries = 10;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await context.db.insert(designDoc);
      console.log('Created design document: _design/queries');
      break; // Success, exit retry loop
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 409) {
        try {
          // Design document exists, try to update it
          const existing = await context.db.get('_design/queries');
          await context.db.insert({ ...designDoc, _rev: existing._rev });
          console.log('Updated design document: _design/queries');
          break; // Success, exit retry loop
        } catch (updateError: unknown) {
          if (
            updateError &&
            typeof updateError === 'object' &&
            'statusCode' in updateError &&
            updateError.statusCode === 409
          ) {
            // Another conflict, retry if attempts remaining
            if (attempt < maxRetries) {
              console.warn(
                `Design document conflict (attempt ${attempt}/${maxRetries}), retrying...`,
              );
              await new Promise((resolve) => setTimeout(resolve, 200 * attempt));
              continue;
            } else {
              console.error('Design document update failed after retries');
              throw updateError;
            }
          } else {
            throw updateError;
          }
        }
      } else {
        throw error;
      }
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
): Promise<UserRegistryOperations> {
  const { getTestUserRegistryConfig } = await import('../config/env.js');
  const testConfig = getTestUserRegistryConfig(env);

  const couchConnection = nano(couchDbUrl);
  const db = couchConnection.db.use<UserRegistryEntry>(testConfig.dbName);

  const context: UserRegistryContext = {
    couchConnection,
    db,
    env,
  };

  // Helper function to ensure test database exists
  async function ensureTestDatabase(): Promise<void> {
    try {
      await couchConnection.db.get(testConfig.dbName);
      console.log(`Test user registry database already exists: ${testConfig.dbName}`);
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 404) {
        // Database doesn't exist, create it
        try {
          await couchConnection.db.create(testConfig.dbName);
          console.log(`Created test user registry database: ${testConfig.dbName}`);
        } catch (createError: unknown) {
          if (
            createError &&
            typeof createError === 'object' &&
            'statusCode' in createError &&
            createError.statusCode === 412
          ) {
            // Database already exists, which is fine
            console.log(`Test user registry database already exists: ${testConfig.dbName}`);
          } else {
            throw createError;
          }
        }
      } else {
        throw error;
      }
    }
  }

  return {
    create: (entry: CreateUserRegistryEntry) => create(context, entry),
    findByUsername: (username: string) => findByUsername(context, username),
    findByTelegramId: (telegramId: number) => findByTelegramId(context, telegramId),
    findByEmail: (email: string) => findByEmail(context, email),
    update: (id: string, updates: UpdateUserRegistryEntry) => update(context, id, updates),
    list: () => list(context),
    delete: (id: string) => deleteEntry(context, id),
    setupDatabase: async () => {
      await ensureTestDatabase();
      await setupDesignDocuments(context);
    },
    ensureUserDatabase: (username: string) => ensureUserDatabase(context, username),
    getUserDatabase: (username: string) => getUserDatabase(context, username),
  };
}

// Legacy export for backward compatibility
export const UserRegistry = createUserRegistry;
