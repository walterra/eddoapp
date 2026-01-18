/**
 * Database watcher for CouchDB to Elasticsearch sync.
 */

import type nano from 'nano';
import type { Logger } from 'pino';

import { withSpan } from '../utils/logger';
import type { BatchProcessor } from './sync-batch';
import {
  processAuditChange,
  processInitialDocs,
  processTodoChange,
  shouldSkipDocument,
} from './sync-change-processor';
import { extractUserId, getDatabaseType } from './sync-transforms';
import type { ChangeEvent, DatabaseSyncState } from './sync-types';

/** Configuration for database watcher */
export interface WatcherConfig {
  batchProcessor: BatchProcessor;
  getCouchDb: () => nano.ServerScope;
  logger: Logger;
  syncStates: Map<string, DatabaseSyncState>;
}

/** Creates a database watcher. */
export function createDatabaseWatcher(config: WatcherConfig) {
  const { batchProcessor, getCouchDb, logger, syncStates } = config;

  /** Starts watching a single database for changes. */
  async function watchDatabase(dbName: string): Promise<void> {
    if (syncStates.has(dbName)) {
      logger.warn({ dbName }, 'Already watching database');
      return;
    }

    const dbType = getDatabaseType(dbName);
    if (dbType === 'unknown') {
      logger.debug({ dbName }, 'Skipping non-syncable database');
      return;
    }

    const state = await initializeState(getCouchDb, dbName, dbType, logger);
    syncStates.set(dbName, state);

    await performInitialSync(state, getCouchDb, batchProcessor, logger);
    startChangesListener(state, getCouchDb, batchProcessor, logger);
  }

  /** Stops watching a database. */
  async function unwatchDatabase(dbName: string): Promise<void> {
    const state = syncStates.get(dbName);
    if (!state) return;

    state.isRunning = false;
    state.changesEmitter?.removeAllListeners();
    getCouchDb().use(dbName).changesReader.stop();
    syncStates.delete(dbName);
    logger.info({ dbName }, 'Stopped watching database');
  }

  /** Discovers and watches all eddo_user_* and eddo_audit_* databases. */
  async function discoverAndWatchDatabases(): Promise<void> {
    const allDbs = await getCouchDb().db.list();
    const syncableDbs = allDbs.filter(
      (db) => db.startsWith('eddo_user_') || db.startsWith('eddo_audit_'),
    );
    logger.info({ count: syncableDbs.length }, 'Discovered syncable databases');

    for (const dbName of syncableDbs) {
      if (!syncStates.has(dbName)) await watchDatabase(dbName);
    }
  }

  return { discoverAndWatchDatabases, unwatchDatabase, watchDatabase };
}

/** Initializes sync state for a database. */
async function initializeState(
  getCouchDb: () => nano.ServerScope,
  dbName: string,
  dbType: 'user' | 'audit',
  logger: Logger,
): Promise<DatabaseSyncState> {
  const db = getCouchDb().use(dbName);
  const state: DatabaseSyncState = {
    changesEmitter: null,
    dbName,
    dbType,
    esIndexName: dbName,
    isRunning: true,
    lastSeq: '0',
    userId: extractUserId(dbName),
  };

  try {
    const info = await db.info();
    state.lastSeq = String(info.update_seq);
  } catch (error) {
    logger.error({ dbName, error }, 'Failed to get database info');
  }

  return state;
}

/** Performs initial sync for a database. */
async function performInitialSync(
  state: DatabaseSyncState,
  getCouchDb: () => nano.ServerScope,
  batchProcessor: BatchProcessor,
  logger: Logger,
): Promise<void> {
  await withSpan(
    'es_sync_initial_sync',
    {
      'couchdb.database': state.dbName,
      'db.type': state.dbType,
      'es.index': state.esIndexName,
      'user.id': state.userId,
    },
    async (span) => {
      logger.info(
        { dbName: state.dbName, dbType: state.dbType, userId: state.userId },
        'Starting initial sync',
      );

      try {
        const db = getCouchDb().use(state.dbName);
        const allDocs = await db.list({ include_docs: true });
        const docs = allDocs.rows
          .filter((row) => !shouldSkipDocument(row.id) && !!row.doc)
          .map((row) => ({
            id: row.id,
            doc: row.doc as { version?: string; _id: string; _rev: string },
          }));
        const { indexedCount, skippedCount } = await processInitialDocs(
          docs,
          state,
          batchProcessor,
        );
        await batchProcessor.flushBatch();

        span.setAttribute('es.initial_sync.indexed', indexedCount);
        span.setAttribute('es.initial_sync.skipped', skippedCount);
        span.setAttribute('es.initial_sync.total_docs', allDocs.rows.length);

        logger.info(
          { dbName: state.dbName, docCount: indexedCount, skipped: skippedCount },
          'Initial sync complete',
        );
      } catch (error) {
        span.setAttribute('es.initial_sync.error', true);
        logger.error({ dbName: state.dbName, error }, 'Initial sync failed');
        throw error;
      }
    },
  );
}

/** Starts the changes feed listener for a database. */
function startChangesListener(
  state: DatabaseSyncState,
  getCouchDb: () => nano.ServerScope,
  batchProcessor: BatchProcessor,
  logger: Logger,
): void {
  const db = getCouchDb().use(state.dbName);
  const processChange =
    state.dbType === 'user'
      ? (change: ChangeEvent) => processTodoChange(change, state, batchProcessor)
      : (change: ChangeEvent) => processAuditChange(change, state, batchProcessor);

  const changesEmitter = db.changesReader.start({
    includeDocs: true,
    since: state.lastSeq,
    wait: true,
  });
  state.changesEmitter = changesEmitter;

  changesEmitter.on('change', async (change: ChangeEvent) => {
    if (state.isRunning) await processChange(change);
  });

  changesEmitter.on('batch', async (changes: ChangeEvent[]) => {
    if (!state.isRunning) return;
    for (const change of changes) await processChange(change);
  });

  changesEmitter.on('error', (error: Error) => {
    logger.error({ dbName: state.dbName, error: error.message }, 'Changes feed error');
  });

  logger.info(
    {
      dbName: state.dbName,
      esIndexName: state.esIndexName,
      since: state.lastSeq,
      userId: state.userId,
    },
    'Started watching',
  );
}

export type DatabaseWatcher = ReturnType<typeof createDatabaseWatcher>;
