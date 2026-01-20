/**
 * Changes feed listener for CouchDB to Elasticsearch sync.
 */

import type nano from 'nano';
import type { Logger } from 'pino';

import type { IndexMigration } from './index-migration';
import type { BatchProcessor } from './sync-batch';
import { processAuditChange, processTodoChange } from './sync-change-processor';
import type { ChangeEvent, DatabaseSyncState } from './sync-types';

/** Configuration for changes listener */
export interface ChangesListenerConfig {
  batchProcessor: BatchProcessor;
  getCouchDb: () => nano.ServerScope;
  indexMigration: IndexMigration;
  logger: Logger;
  state: DatabaseSyncState;
}

/** Interval for persisting lastSeq to ES (5 minutes) */
const LAST_SEQ_PERSIST_INTERVAL_MS = 5 * 60 * 1000;

/** Starts the changes feed listener for a database. */
export function startChangesListener(config: ChangesListenerConfig): void {
  const { batchProcessor, getCouchDb, indexMigration, logger, state } = config;
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

  // Setup lastSeq persistence for user databases
  if (state.dbType === 'user') {
    setupLastSeqPersistence(state, indexMigration, logger);
  }

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

/** Sets up periodic lastSeq persistence for user databases. */
function setupLastSeqPersistence(
  state: DatabaseSyncState,
  indexMigration: IndexMigration,
  logger: Logger,
): void {
  let lastPersistedSeq = state.lastSeq;

  const persistTimer = setInterval(async () => {
    if (state.lastSeq !== lastPersistedSeq && state.isRunning) {
      try {
        await indexMigration.updateLastSeq(state.esIndexName, state.lastSeq);
        lastPersistedSeq = state.lastSeq;
        logger.debug({ dbName: state.dbName, lastSeq: state.lastSeq }, 'Persisted lastSeq');
      } catch (error) {
        logger.error({ dbName: state.dbName, error }, 'Failed to persist lastSeq');
      }
    }
  }, LAST_SEQ_PERSIST_INTERVAL_MS);

  // Store timer reference for cleanup
  const originalIsRunning = state.isRunning;
  let isRunning = originalIsRunning;

  Object.defineProperty(state, 'isRunning', {
    configurable: true,
    get: () => isRunning,
    set: (value: boolean) => {
      isRunning = value;
      if (!value) {
        clearInterval(persistTimer);
        // Persist final lastSeq on shutdown
        if (state.lastSeq !== lastPersistedSeq) {
          indexMigration.updateLastSeq(state.esIndexName, state.lastSeq).catch((err) => {
            logger.error({ dbName: state.dbName, error: err }, 'Failed to persist final lastSeq');
          });
        }
      }
    },
  });
}
