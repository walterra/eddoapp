/**
 * Audit database factory for per-user audit log storage.
 * Each user has their own audit database: eddo_audit_<username>
 */
import { type AuditLogAlpha1 } from '@eddo/core-shared';
import nano from 'nano';

import { type Env } from '../config/env';
import { getAuditDatabaseName, sanitizeUsername } from '../utils/database-names';

/** Audit database instance with typed operations */
export interface AuditDatabase {
  /** Insert a new audit log entry */
  insert: (entry: Omit<AuditLogAlpha1, '_rev'>) => Promise<AuditLogAlpha1>;
  /** Get audit entries with pagination (newest first) */
  list: (options?: AuditListOptions) => Promise<AuditListResult>;
  /** Get the underlying nano database instance */
  raw: () => nano.DocumentScope<AuditLogAlpha1>;
}

/** Options for listing audit entries */
export interface AuditListOptions {
  /** Maximum number of entries to return (default: 50) */
  limit?: number;
  /** Start key for pagination (exclusive, use last _id from previous page) */
  startAfter?: string;
}

/** Result of listing audit entries */
export interface AuditListResult {
  /** Audit log entries */
  entries: AuditLogAlpha1[];
  /** Whether there are more entries */
  hasMore: boolean;
}

/** Context for audit database operations */
interface AuditDatabaseContext {
  db: nano.DocumentScope<AuditLogAlpha1>;
  couchConnection: nano.ServerScope;
  env: Env;
  username: string;
}

/**
 * Check if error is a 404 not found
 */
function isNotFoundError(error: unknown): boolean {
  return Boolean(
    error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 404,
  );
}

/**
 * Ensure the audit database exists for a user
 * @param couchUrl - CouchDB connection URL
 * @param env - Environment configuration
 * @param username - Username to create audit database for
 */
export async function ensureAuditDatabase(
  couchUrl: string,
  env: Env,
  username: string,
): Promise<void> {
  const couchConnection = nano(couchUrl);
  const dbName = getAuditDatabaseName(env, username);

  try {
    await couchConnection.db.get(dbName);
  } catch (error: unknown) {
    if (isNotFoundError(error)) {
      await couchConnection.db.create(dbName);
      console.log(`Created audit database: ${dbName}`);
    } else {
      throw error;
    }
  }
}

/**
 * Create an audit database instance for a user
 * @param couchUrl - CouchDB connection URL
 * @param env - Environment configuration
 * @param username - Username to get audit database for
 * @returns Audit database instance with typed operations
 */
export function createAuditDatabase(couchUrl: string, env: Env, username: string): AuditDatabase {
  const sanitizedUsername = sanitizeUsername(username);
  const couchConnection = nano(couchUrl);
  const dbName = getAuditDatabaseName(env, sanitizedUsername);
  const db = couchConnection.db.use<AuditLogAlpha1>(dbName);

  const context: AuditDatabaseContext = {
    db,
    couchConnection,
    env,
    username: sanitizedUsername,
  };

  return {
    insert: (entry) => insertEntry(context, entry),
    list: (options) => listEntries(context, options),
    raw: () => db,
  };
}

/**
 * Insert a new audit log entry
 */
async function insertEntry(
  context: AuditDatabaseContext,
  entry: Omit<AuditLogAlpha1, '_rev'>,
): Promise<AuditLogAlpha1> {
  const result = await context.db.insert(entry);
  return { ...entry, _rev: result.rev };
}

/**
 * List audit entries with pagination (newest first)
 */
async function listEntries(
  context: AuditDatabaseContext,
  options: AuditListOptions = {},
): Promise<AuditListResult> {
  const { limit = 50, startAfter } = options;

  // Use _all_docs with descending order to get newest first
  // CouchDB sorts by _id, and our IDs are ISO timestamps
  const queryOptions: nano.DocumentListParams = {
    descending: true,
    limit: limit + 1, // Fetch one extra to check if there are more
    include_docs: true,
  };

  if (startAfter) {
    // For descending order, use startkey (exclusive via skip would be complex)
    // Instead, we use endkey with the startAfter value
    queryOptions.startkey = startAfter;
    queryOptions.skip = 1; // Skip the startAfter key itself
  }

  const result = await context.db.list(queryOptions);

  const entries = result.rows
    .filter((row) => row.doc && !row.id.startsWith('_design/'))
    .slice(0, limit)
    .map((row) => row.doc as AuditLogAlpha1);

  const hasMore = result.rows.length > limit;

  return { entries, hasMore };
}

/**
 * Get an audit database instance for a user (alias for createAuditDatabase)
 */
export function getAuditDatabase(couchUrl: string, env: Env, username: string): AuditDatabase {
  return createAuditDatabase(couchUrl, env, username);
}
