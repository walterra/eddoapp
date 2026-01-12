/**
 * Audit database factory for per-user audit log storage.
 * Each user has their own audit database: eddo_audit_<username>
 */
import { type AuditLogAlpha1, type AuditSource } from '@eddo/core-shared';
import nano from 'nano';

import { type Env } from '../config/env';
import { getAuditDatabaseName, sanitizeUsername } from '../utils/database-names';

/** All audit sources for bucketed queries */
export const AUDIT_SOURCES: readonly AuditSource[] = [
  'web',
  'mcp',
  'telegram',
  'github-sync',
  'rss-sync',
  'email-sync',
] as const;

/** Entries grouped by source */
export type AuditEntriesBySource = Record<AuditSource, AuditLogAlpha1[]>;

/** Audit database instance with typed operations */
export interface AuditDatabase {
  /** Insert a new audit log entry */
  insert: (entry: Omit<AuditLogAlpha1, '_rev'>) => Promise<AuditLogAlpha1>;
  /** Get audit entries with pagination (newest first) */
  list: (options?: AuditListOptions) => Promise<AuditListResult>;
  /** Get audit entries by their IDs (document _id values) */
  getByIds: (ids: string[]) => Promise<AuditLogAlpha1[]>;
  /** Get entries grouped by source (20 per source, newest first) */
  listBySource: (options?: AuditListBySourceOptions) => Promise<AuditEntriesBySource>;
  /** Get the underlying nano database instance */
  raw: () => nano.DocumentScope<AuditLogAlpha1>;
}

/** Options for listing audit entries */
export interface AuditListOptions {
  /** Maximum number of entries to return (default: 50) */
  limit?: number;
  /** Start key for pagination (exclusive, use last _id from previous page) */
  startAfter?: string;
  /** Filter to only include entries for these entity IDs */
  entityIds?: string[];
}

/** Options for listing audit entries by source */
export interface AuditListBySourceOptions {
  /** Maximum number of entries per source (default: 20) */
  limitPerSource?: number;
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

/** Design document for audit database views */
const AUDIT_DESIGN_DOC = {
  _id: '_design/queries',
  views: {
    by_source: {
      map: `function(doc) {
        if (doc.source && doc.timestamp) {
          emit([doc.source, doc.timestamp], null);
        }
      }`,
    },
  },
};

/**
 * Check if error is a 404 not found
 */
function isNotFoundError(error: unknown): boolean {
  return Boolean(
    error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 404,
  );
}

/**
 * Check if error is a 409 conflict
 */
function isConflictError(error: unknown): boolean {
  return Boolean(
    error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 409,
  );
}

/**
 * Update existing design document with current definition
 */
async function updateAuditDesignDoc(db: nano.DocumentScope<AuditLogAlpha1>): Promise<void> {
  try {
    const existing = await db.get('_design/queries');
    await db.insert({ ...AUDIT_DESIGN_DOC, _rev: existing._rev });
  } catch (updateError: unknown) {
    // Ignore conflicts during update (concurrent setup)
    if (!isConflictError(updateError)) {
      throw updateError;
    }
  }
}

/**
 * Setup design documents for audit database
 */
async function setupAuditDesignDoc(db: nano.DocumentScope<AuditLogAlpha1>): Promise<void> {
  try {
    await db.insert(AUDIT_DESIGN_DOC);
  } catch (error: unknown) {
    if (isConflictError(error)) {
      await updateAuditDesignDoc(db);
    } else {
      throw error;
    }
  }
}

/**
 * Ensure the audit database exists for a user and has required indexes
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

  let dbCreated = false;
  try {
    await couchConnection.db.get(dbName);
  } catch (error: unknown) {
    if (isNotFoundError(error)) {
      await couchConnection.db.create(dbName);
      console.log(`Created audit database: ${dbName}`);
      dbCreated = true;
    } else {
      throw error;
    }
  }

  const db = couchConnection.db.use<AuditLogAlpha1>(dbName);

  // Setup design documents (for new and existing databases to support migrations)
  await setupAuditDesignDoc(db);

  // Ensure entityId index exists (for filtering by todo ID)
  if (dbCreated) {
    try {
      await db.createIndex({
        index: {
          fields: ['entityId', '_id'],
        },
        name: 'entityId-id-index',
        ddoc: 'entityId-index',
      });
      console.log(`Created entityId index for audit database: ${dbName}`);
    } catch (indexError) {
      // Index might already exist, that's fine
      console.log(`Index creation skipped for ${dbName}:`, indexError);
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
    getByIds: (ids) => getEntriesByIds(context, ids),
    listBySource: (options) => listEntriesBySource(context, options),
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
  const { limit = 50, startAfter, entityIds } = options;

  // If filtering by entityIds, use a different approach
  if (entityIds && entityIds.length > 0) {
    return listEntriesByEntityIds(context, { limit, startAfter, entityIds });
  }

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
 * List audit entries filtered by entity IDs (newest first)
 * Uses Mango query with entityId filter
 */
async function listEntriesByEntityIds(
  context: AuditDatabaseContext,
  options: Required<Pick<AuditListOptions, 'entityIds'>> & Omit<AuditListOptions, 'entityIds'>,
): Promise<AuditListResult> {
  const { limit = 50, entityIds } = options;

  // Ensure the index exists (lazy creation for existing databases)
  await ensureEntityIdIndex(context);

  // Use Mango query to filter by entityId
  const selector: nano.MangoSelector = {
    entityId: { $in: entityIds },
  };

  // Fetch more than limit to ensure we get enough after filtering
  // and to check if there are more results
  const query: nano.MangoQuery = {
    selector,
    limit: limit + 1,
    sort: [{ _id: 'desc' }],
    use_index: 'entityId-index',
  };

  const result = await context.db.find(query);

  const entries = result.docs.slice(0, limit);
  const hasMore = result.docs.length > limit;

  return { entries, hasMore };
}

/** Cache to track which databases have had their index ensured */
const indexEnsuredCache = new Set<string>();

/**
 * Ensure the entityId index exists (lazy creation for existing databases)
 */
async function ensureEntityIdIndex(context: AuditDatabaseContext): Promise<void> {
  const cacheKey = `${context.username}`;
  if (indexEnsuredCache.has(cacheKey)) {
    return;
  }

  try {
    await context.db.createIndex({
      index: {
        fields: ['entityId', '_id'],
      },
      name: 'entityId-id-index',
      ddoc: 'entityId-index',
    });
  } catch {
    // Index might already exist, that's fine
  }

  indexEnsuredCache.add(cacheKey);
}

/**
 * Get audit entries by their document IDs
 * Uses CouchDB bulk fetch for efficiency
 */
async function getEntriesByIds(
  context: AuditDatabaseContext,
  ids: string[],
): Promise<AuditLogAlpha1[]> {
  if (ids.length === 0) return [];

  // Use _all_docs with keys to fetch specific documents
  const result = await context.db.fetch({ keys: ids });

  // Filter out errors and missing docs, return valid entries
  const entries: AuditLogAlpha1[] = [];
  for (const row of result.rows) {
    // Check for valid document (not an error row and has doc)
    if ('doc' in row && row.doc && !('error' in row)) {
      entries.push(row.doc as AuditLogAlpha1);
    }
  }
  return entries;
}

/**
 * Query entries for a single source using the by_source view
 */
async function queryEntriesForSource(
  context: AuditDatabaseContext,
  source: AuditSource,
  limit: number,
): Promise<AuditLogAlpha1[]> {
  try {
    const result = await context.db.view('queries', 'by_source', {
      startkey: [source, '\ufff0'],
      endkey: [source],
      descending: true,
      limit,
      include_docs: true,
    });

    return result.rows.filter((row) => row.doc).map((row) => row.doc as unknown as AuditLogAlpha1);
  } catch (error: unknown) {
    // View might not exist yet if design doc hasn't been created
    if (isNotFoundError(error)) {
      return [];
    }
    throw error;
  }
}

/**
 * List entries grouped by source (N per source, newest first)
 */
async function listEntriesBySource(
  context: AuditDatabaseContext,
  options: AuditListBySourceOptions = {},
): Promise<AuditEntriesBySource> {
  const { limitPerSource = 20 } = options;

  // Query all sources in parallel
  const results = await Promise.all(
    AUDIT_SOURCES.map(async (source) => ({
      source,
      entries: await queryEntriesForSource(context, source, limitPerSource),
    })),
  );

  // Build result object
  const entriesBySource: AuditEntriesBySource = {
    web: [],
    mcp: [],
    telegram: [],
    'github-sync': [],
    'rss-sync': [],
    'email-sync': [],
  };

  for (const { source, entries } of results) {
    entriesBySource[source] = entries;
  }

  return entriesBySource;
}

/**
 * Get an audit database instance for a user (alias for createAuditDatabase)
 */
export function getAuditDatabase(couchUrl: string, env: Env, username: string): AuditDatabase {
  return createAuditDatabase(couchUrl, env, username);
}
