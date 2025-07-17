import {
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

export class UserRegistry implements UserRegistryOperations {
  private db: nano.DocumentScope<UserRegistryEntry>;
  private couchConnection: nano.ServerScope;
  private env: Env;

  constructor(couchUrl: string, env: Env, dbName?: string) {
    this.env = env;
    this.couchConnection = nano(couchUrl);

    const registryDbName = dbName || getUserRegistryDatabaseConfig(env).dbName;
    this.db = this.couchConnection.db.use<UserRegistryEntry>(registryDbName);
  }

  /**
   * Ensure the user registry database exists
   */
  async ensureDatabase(): Promise<void> {
    const dbName = getUserRegistryDatabaseConfig(this.env).dbName;
    try {
      await this.couchConnection.db.get(dbName);
    } catch (error: unknown) {
      if (
        error &&
        typeof error === 'object' &&
        'statusCode' in error &&
        error.statusCode === 404
      ) {
        // Database doesn't exist, create it
        await this.couchConnection.db.create(dbName);
        console.log(`Created user registry database: ${dbName}`);
      } else {
        throw error;
      }
    }
  }

  async findByUsername(username: string): Promise<UserRegistryEntry | null> {
    const sanitizedUsername = sanitizeUsername(username);
    const id = `user_${sanitizedUsername}`;

    try {
      const doc = await this.db.get(id);
      return this.migrateIfNeeded(doc);
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

  async findByTelegramId(
    telegramId: number,
  ): Promise<UserRegistryEntry | null> {
    try {
      // Use a view to find by telegram_id
      const result = await this.db.view('queries', 'by_telegram_id', {
        key: telegramId,
        include_docs: true,
      });

      if (result.rows.length === 0) {
        return null;
      }

      const doc = result.rows[0].doc;
      return doc ? this.migrateIfNeeded(doc) : null;
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

  async findByEmail(email: string): Promise<UserRegistryEntry | null> {
    try {
      // Use a view to find by email
      const result = await this.db.view('queries', 'by_email', {
        key: email,
        include_docs: true,
      });

      if (result.rows.length === 0) {
        return null;
      }

      const doc = result.rows[0].doc;
      return doc ? this.migrateIfNeeded(doc) : null;
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

  async create(
    entry: Omit<UserRegistryEntry, '_id' | '_rev'>,
  ): Promise<UserRegistryEntry> {
    const sanitizedUsername = sanitizeUsername(entry.username);
    const now = new Date().toISOString();

    const newEntry: UserRegistryEntry = {
      ...entry,
      _id: `user_${sanitizedUsername}`,
      database_name: getUserDatabaseName(this.env, entry.username),
      api_key: getUserApiKey(entry.username, 'web'),
      created_at: entry.created_at || now,
      updated_at: now,
      permissions: entry.permissions || ['read', 'write'],
      status: entry.status || 'active',
      version: 'alpha1',
    };

    const result = await this.db.insert(newEntry);
    return { ...newEntry, _rev: result.rev };
  }

  async update(
    id: string,
    updates: Partial<UserRegistryEntry>,
  ): Promise<UserRegistryEntry> {
    const existing = await this.db.get(id);
    const now = new Date().toISOString();

    const updated: UserRegistryEntry = {
      ...existing,
      ...updates,
      _id: id,
      _rev: existing._rev,
      updated_at: now,
      version: 'alpha1',
    };

    const result = await this.db.insert(updated);
    return { ...updated, _rev: result.rev };
  }

  async list(): Promise<UserRegistryEntry[]> {
    const result = await this.db.list({ include_docs: true });
    return result.rows
      .filter((row) => row.doc && !row.id.startsWith('_design/'))
      .map((row) => this.migrateIfNeeded(row.doc!));
  }

  async delete(id: string): Promise<void> {
    const existing = await this.db.get(id);
    await this.db.destroy(id, existing._rev!);
  }

  /**
   * Create a user context from a registry entry
   */
  createUserContext(entry: UserRegistryEntry): UserContext {
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
  private migrateIfNeeded(entry: UserRegistryEntry): UserRegistryEntry {
    if (!isLatestUserRegistryVersion(entry)) {
      const migrated = migrateUserRegistryEntry(entry);
      // Save migrated version back to database in background
      this.db.insert(migrated).catch((error) => {
        console.error('Failed to save migrated user registry entry:', error);
      });
      return migrated;
    }
    return entry;
  }

  /**
   * Ensure user database exists for a user
   */
  async ensureUserDatabase(username: string): Promise<void> {
    const dbName = getUserDatabaseName(this.env, username);
    try {
      await this.couchConnection.db.get(dbName);
    } catch (error: unknown) {
      if (
        error &&
        typeof error === 'object' &&
        'statusCode' in error &&
        error.statusCode === 404
      ) {
        // Database doesn't exist, create it
        await this.couchConnection.db.create(dbName);
        console.log(`Created user database: ${dbName}`);
      } else {
        throw error;
      }
    }
  }

  /**
   * Get user database instance
   */
  getUserDatabase(
    username: string,
  ): nano.DocumentScope<Record<string, unknown>> {
    const dbName = getUserDatabaseName(this.env, username);
    return this.couchConnection.db.use(dbName);
  }

  /**
   * Setup design documents for user registry
   */
  async setupDesignDocuments(): Promise<void> {
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
      await this.db.insert(designDoc);
    } catch (error: unknown) {
      if (
        error &&
        typeof error === 'object' &&
        'statusCode' in error &&
        error.statusCode === 409
      ) {
        // Design document already exists, update it
        const existing = await this.db.get('_design/queries');
        await this.db.insert({ ...designDoc, _rev: existing._rev });
      } else {
        throw error;
      }
    }
  }
}
