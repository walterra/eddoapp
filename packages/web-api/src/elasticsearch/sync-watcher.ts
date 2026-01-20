/**
 * Database watcher for CouchDB to Elasticsearch sync.
 */

import type nano from 'nano';
import type { Logger } from 'pino';

import { withSpan } from '../utils/logger';
import type { IndexMigration, MigrationCheckResult } from './index-migration';
import type { BatchProcessor } from './sync-batch';
import { processInitialDocs, shouldSkipDocument } from './sync-change-processor';
import { startChangesListener } from './sync-changes-listener';
import { extractUserId, getDatabaseType } from './sync-transforms';
import type { DatabaseSyncState } from './sync-types';

/** Configuration for database watcher */
export interface WatcherConfig {
  batchProcessor: BatchProcessor;
  getCouchDb: () => nano.ServerScope;
  indexMigration: IndexMigration;
  logger: Logger;
  syncStates: Map<string, DatabaseSyncState>;
}

/** Handles user database watching with migration support. */
async function watchUserDatabase(config: WatcherConfig, dbName: string): Promise<void> {
  const { batchProcessor, getCouchDb, indexMigration, logger, syncStates } = config;

  const migrationCheck = await indexMigration.checkMigration(dbName);
  logMigrationCheck(logger, dbName, migrationCheck);

  const targetIndexName = await resolveTargetIndex(indexMigration, logger, dbName, migrationCheck);
  const state = createSyncState(dbName, 'user', targetIndexName, migrationCheck.lastSeq);

  if (migrationCheck.needsInitialSync) {
    await updateStateWithCurrentSeq(state, getCouchDb, logger);
  }

  syncStates.set(dbName, state);

  if (migrationCheck.needsInitialSync) {
    await performInitialSync(state, getCouchDb, batchProcessor, logger);

    if (migrationCheck.needsMigration || migrationCheck.currentVersion === null) {
      await indexMigration.finalizeMigration(dbName, targetIndexName, state.lastSeq);
    }
  } else {
    logger.info({ dbName, lastSeq: state.lastSeq }, 'Skipping initial sync - resuming');
  }

  startChangesListener({ batchProcessor, getCouchDb, indexMigration, logger, state });
}

/** Resolves the target index name based on migration status. */
async function resolveTargetIndex(
  indexMigration: IndexMigration,
  logger: Logger,
  dbName: string,
  migrationCheck: MigrationCheckResult,
): Promise<string> {
  if (migrationCheck.needsMigration) {
    logger.info(
      {
        currentVersion: migrationCheck.currentVersion,
        dbName,
        targetVersion: migrationCheck.targetVersion,
      },
      'Starting index migration',
    );
    return indexMigration.performMigration(dbName);
  }

  if (migrationCheck.currentVersion === null) {
    return indexMigration.createVersionedIndex(dbName);
  }

  return migrationCheck.versionedIndexName;
}

/** Handles audit database watching (simpler, no versioning). */
async function watchAuditDatabase(config: WatcherConfig, dbName: string): Promise<void> {
  const { batchProcessor, getCouchDb, indexMigration, logger, syncStates } = config;

  const state = await initializeState(getCouchDb, dbName, 'audit', logger);
  syncStates.set(dbName, state);
  await performInitialSync(state, getCouchDb, batchProcessor, logger);
  startChangesListener({ batchProcessor, getCouchDb, indexMigration, logger, state });
}

/** Stops watching a database. */
async function unwatchDatabase(config: WatcherConfig, dbName: string): Promise<void> {
  const { getCouchDb, logger, syncStates } = config;
  const state = syncStates.get(dbName);
  if (!state) return;

  state.isRunning = false;
  state.changesEmitter?.removeAllListeners();
  getCouchDb().use(dbName).changesReader.stop();
  syncStates.delete(dbName);
  logger.info({ dbName }, 'Stopped watching database');
}

/** Discovers and watches all eddo_user_* and eddo_audit_* databases. */
async function discoverAndWatchDatabases(
  config: WatcherConfig,
  watchDatabase: (dbName: string) => Promise<void>,
): Promise<void> {
  const { getCouchDb, logger, syncStates } = config;
  const allDbs = await getCouchDb().db.list();
  const syncableDbs = allDbs.filter(
    (db) => db.startsWith('eddo_user_') || db.startsWith('eddo_audit_'),
  );
  logger.info({ count: syncableDbs.length }, 'Discovered syncable databases');

  for (const dbName of syncableDbs) {
    if (!syncStates.has(dbName)) await watchDatabase(dbName);
  }
}

/** Creates a database watcher. */
export function createDatabaseWatcher(config: WatcherConfig) {
  /** Starts watching a single database for changes. */
  async function watchDatabase(dbName: string): Promise<void> {
    if (config.syncStates.has(dbName)) {
      config.logger.warn({ dbName }, 'Already watching database');
      return;
    }

    const dbType = getDatabaseType(dbName);
    if (dbType === 'unknown') {
      config.logger.debug({ dbName }, 'Skipping non-syncable database');
      return;
    }

    if (dbType === 'user') {
      await watchUserDatabase(config, dbName);
    } else {
      await watchAuditDatabase(config, dbName);
    }
  }

  return {
    discoverAndWatchDatabases: () => discoverAndWatchDatabases(config, watchDatabase),
    unwatchDatabase: (dbName: string) => unwatchDatabase(config, dbName),
    watchDatabase,
  };
}

/** Logs migration check result. */
function logMigrationCheck(logger: Logger, dbName: string, check: MigrationCheckResult): void {
  logger.info(
    {
      currentVersion: check.currentVersion,
      dbName,
      lastSeq: check.lastSeq,
      needsInitialSync: check.needsInitialSync,
      needsMigration: check.needsMigration,
      targetVersion: check.targetVersion,
    },
    'Migration check result',
  );
}

/** Creates a sync state object. */
function createSyncState(
  dbName: string,
  dbType: 'user' | 'audit',
  esIndexName: string,
  lastSeq: string,
): DatabaseSyncState {
  return {
    changesEmitter: null,
    dbName,
    dbType,
    esIndexName,
    isRunning: true,
    lastSeq,
    userId: extractUserId(dbName),
  };
}

/** Updates state with current CouchDB sequence. */
async function updateStateWithCurrentSeq(
  state: DatabaseSyncState,
  getCouchDb: () => nano.ServerScope,
  logger: Logger,
): Promise<void> {
  try {
    const db = getCouchDb().use(state.dbName);
    const info = await db.info();
    state.lastSeq = String(info.update_seq);
  } catch (error) {
    logger.error({ dbName: state.dbName, error }, 'Failed to get database info');
  }
}

/** Initializes sync state for a database. */
async function initializeState(
  getCouchDb: () => nano.ServerScope,
  dbName: string,
  dbType: 'user' | 'audit',
  logger: Logger,
): Promise<DatabaseSyncState> {
  const state = createSyncState(dbName, dbType, dbName, '0');
  await updateStateWithCurrentSeq(state, getCouchDb, logger);
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
        const { indexedCount, skippedCount, totalDocs } = await syncAllDocs(
          state,
          getCouchDb,
          batchProcessor,
        );

        span.setAttribute('es.initial_sync.indexed', indexedCount);
        span.setAttribute('es.initial_sync.skipped', skippedCount);
        span.setAttribute('es.initial_sync.total_docs', totalDocs);

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

/** Syncs all documents from CouchDB to ES. */
async function syncAllDocs(
  state: DatabaseSyncState,
  getCouchDb: () => nano.ServerScope,
  batchProcessor: BatchProcessor,
): Promise<{ indexedCount: number; skippedCount: number; totalDocs: number }> {
  const db = getCouchDb().use(state.dbName);
  const allDocs = await db.list({ include_docs: true });

  const docs = allDocs.rows
    .filter((row) => !shouldSkipDocument(row.id) && !!row.doc)
    .map((row) => ({
      id: row.id,
      doc: row.doc as { version?: string; _id: string; _rev: string },
    }));

  const { indexedCount, skippedCount } = await processInitialDocs(docs, state, batchProcessor);
  await batchProcessor.flushBatch();

  return { indexedCount, skippedCount, totalDocs: allDocs.rows.length };
}

export type DatabaseWatcher = ReturnType<typeof createDatabaseWatcher>;
