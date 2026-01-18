/**
 * Database watcher for CouchDB to Elasticsearch sync.
 */

import type { AuditLogAlpha1, TodoAlpha3 } from '@eddo/core-shared';
import type nano from 'nano';
import type { Logger } from 'pino';

import { withSpan } from '../utils/logger';
import type { BatchProcessor } from './sync-batch';
import {
  extractUserId,
  getDatabaseType,
  toIndexedAuditLog,
  toIndexedTodo,
} from './sync-transforms';
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
        const { indexedCount, skippedCount } = await processInitialDocs(
          allDocs.rows,
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

/** Processes all documents during initial sync. */
async function processInitialDocs(
  rows: Array<{ id: string; doc?: { version?: string; _id: string; _rev: string } }>,
  state: DatabaseSyncState,
  batchProcessor: BatchProcessor,
): Promise<{ indexedCount: number; skippedCount: number }> {
  let indexedCount = 0;
  let skippedCount = 0;

  for (const row of rows) {
    if (shouldSkipDocument(row.id) || !row.doc) {
      skippedCount++;
      continue;
    }

    const indexed = await indexInitialDoc(row.doc, state, batchProcessor);
    if (indexed) indexedCount++;
    else skippedCount++;
  }

  return { indexedCount, skippedCount };
}

/** Indexes a single document during initial sync. */
async function indexInitialDoc(
  doc: { version?: string; _id: string; _rev: string },
  state: DatabaseSyncState,
  batchProcessor: BatchProcessor,
): Promise<boolean> {
  if (state.dbType === 'user' && doc.version === 'alpha3') {
    const indexedDoc = toIndexedTodo(
      doc as TodoAlpha3 & { _id: string; _rev: string },
      state.userId,
      state.dbName,
    );
    await batchProcessor.queueDocument({
      action: 'index',
      doc: indexedDoc,
      id: doc._id,
      indexName: state.esIndexName,
    });
    return true;
  }

  if (state.dbType === 'audit' && doc.version === 'audit_alpha1') {
    const indexedDoc = toIndexedAuditLog(
      doc as AuditLogAlpha1 & { _id: string; _rev: string },
      state.userId,
      state.dbName,
    );
    await batchProcessor.queueDocument({
      action: 'index',
      doc: indexedDoc,
      id: doc._id,
      indexName: state.esIndexName,
    });
    return true;
  }

  return false;
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

/** Processes a single change from a todo database. */
async function processTodoChange(
  change: ChangeEvent,
  state: DatabaseSyncState,
  batchProcessor: BatchProcessor,
): Promise<void> {
  if (shouldSkipDocument(change.id)) return;

  await withSpan(
    'es_sync_process_change',
    buildChangeSpanAttributes(change, state),
    async (span) => {
      if (change.deleted) {
        await batchProcessor.queueDocument({
          action: 'delete',
          id: change.id,
          indexName: state.esIndexName,
        });
        span.setAttribute('es.action', 'delete');
      } else if (change.doc) {
        const doc = change.doc as TodoAlpha3 & { _id: string; _rev: string };
        if (doc.version !== 'alpha3') {
          span.setAttribute('es.action', 'skip');
          span.setAttribute('es.skip_reason', 'not_alpha3');
          return;
        }

        const indexedDoc = toIndexedTodo(doc, state.userId, state.dbName);
        await batchProcessor.queueDocument({
          action: 'index',
          doc: indexedDoc,
          id: change.id,
          indexName: state.esIndexName,
        });
        span.setAttribute('es.action', 'index');
      }
      state.lastSeq = change.seq;
    },
  );
}

/** Processes a single change from an audit database. */
async function processAuditChange(
  change: ChangeEvent,
  state: DatabaseSyncState,
  batchProcessor: BatchProcessor,
): Promise<void> {
  if (shouldSkipDocument(change.id)) return;

  await withSpan(
    'es_sync_process_change',
    buildChangeSpanAttributes(change, state),
    async (span) => {
      if (change.deleted) {
        await batchProcessor.queueDocument({
          action: 'delete',
          id: change.id,
          indexName: state.esIndexName,
        });
        span.setAttribute('es.action', 'delete');
      } else if (change.doc) {
        const doc = change.doc as AuditLogAlpha1 & { _id: string; _rev: string };
        if (doc.version !== 'audit_alpha1') {
          span.setAttribute('es.action', 'skip');
          span.setAttribute('es.skip_reason', 'not_audit_alpha1');
          return;
        }

        const indexedDoc = toIndexedAuditLog(doc, state.userId, state.dbName);
        await batchProcessor.queueDocument({
          action: 'index',
          doc: indexedDoc,
          id: change.id,
          indexName: state.esIndexName,
        });
        span.setAttribute('es.action', 'index');
      }
      state.lastSeq = change.seq;
    },
  );
}

/** Checks if a document should be skipped. */
function shouldSkipDocument(docId: string): boolean {
  return docId.startsWith('_design/') || docId.startsWith('_local/');
}

/** Builds span attributes for a change event. */
function buildChangeSpanAttributes(
  change: ChangeEvent,
  state: DatabaseSyncState,
): Record<string, unknown> {
  return {
    'couchdb.database': state.dbName,
    'couchdb.deleted': change.deleted ?? false,
    'couchdb.doc_id': change.id,
    'couchdb.seq': change.seq,
    'es.index': state.esIndexName,
    'user.id': state.userId,
  };
}

export type DatabaseWatcher = ReturnType<typeof createDatabaseWatcher>;
