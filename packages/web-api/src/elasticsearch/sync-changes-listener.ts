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

/** Delay before retrying an unacknowledged batch. */
const RETRY_DELAY_MS = 5000;

/** Starts the changes feed listener for a database. */
export function startChangesListener(config: ChangesListenerConfig): void {
  const { batchProcessor, getCouchDb, logger, state } = config;
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

  changesEmitter.on('batch', (changes: ChangeEvent[]) => {
    void acknowledgeBatch(config, changes, processChange, () => db.changesReader.resume());
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

/** Resumes the reader only after indexing and checkpoint persistence succeed. */
async function acknowledgeBatch(
  config: ChangesListenerConfig,
  changes: ChangeEvent[],
  processChange: (change: ChangeEvent) => Promise<void>,
  resume: () => void,
): Promise<void> {
  const { batchProcessor, indexMigration, logger, state } = config;
  const acknowledgedSeq = state.lastSeq;
  while (state.isRunning) {
    try {
      for (const change of changes) await processChange(change);
      await batchProcessor.flushBatch();
      const lastSeq = changes.at(-1)?.seq ?? acknowledgedSeq;
      if (state.dbType === 'user') {
        await indexMigration.updateLastSeq(state.esIndexName, lastSeq);
      }
      state.lastSeq = lastSeq;
      if (state.isRunning) resume();
      return;
    } catch (error) {
      state.lastSeq = acknowledgedSeq;
      logger.error({ dbName: state.dbName, error }, 'Sync batch failed; reader paused for retry');
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
}
