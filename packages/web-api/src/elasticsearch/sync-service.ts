/**
 * CouchDB to Elasticsearch sync service.
 * Watches CouchDB changes feed and indexes to per-database ES indices.
 */

import { withSpan } from '../utils/logger';
import { createIndexManager } from './index-manager';
import { createBatchProcessor, type BatchProcessor } from './sync-batch';
import type { DatabaseSyncState, SyncServiceConfig, SyncStatus } from './sync-types';
import { createDatabaseWatcher, type DatabaseWatcher } from './sync-watcher';

/** Internal service state */
interface ServiceState {
  isInitialized: boolean;
  syncStates: Map<string, DatabaseSyncState>;
  batchProcessor: BatchProcessor;
  watcher: DatabaseWatcher;
  indexManager: ReturnType<typeof createIndexManager>;
  config: Pick<SyncServiceConfig, 'logger' | 'batchSize' | 'batchTimeoutMs'>;
}

/** Creates a CouchDB to Elasticsearch sync service. */
export function createSyncService(config: SyncServiceConfig) {
  const { esClient, getCouchDb, logger, batchSize = 100, batchTimeoutMs = 1000 } = config;

  const syncStates = new Map<string, DatabaseSyncState>();
  const batchProcessor = createBatchProcessor({ batchSize, batchTimeoutMs, esClient, logger });
  const watcher = createDatabaseWatcher({ batchProcessor, getCouchDb, logger, syncStates });

  const state: ServiceState = {
    batchProcessor,
    config: { batchSize, batchTimeoutMs, logger },
    indexManager: createIndexManager(esClient),
    isInitialized: false,
    syncStates,
    watcher,
  };

  return {
    discoverAndWatchDatabases: watcher.discoverAndWatchDatabases,
    flushBatch: batchProcessor.flushBatch,
    getStatus: () => buildStatus(state),
    initialize: () => initializeService(state),
    shutdown: () => shutdownService(state),
    unwatchDatabase: watcher.unwatchDatabase,
    watchDatabase: watcher.watchDatabase,
  };
}

/** Builds sync status response. */
function buildStatus(state: ServiceState): SyncStatus {
  return {
    databases: Array.from(state.syncStates.values()).map((s) => ({
      dbName: s.dbName,
      dbType: s.dbType,
      esIndexName: s.esIndexName,
      lastSeq: s.lastSeq,
      userId: s.userId,
    })),
    isInitialized: state.isInitialized,
    pendingDocs: state.batchProcessor.getPendingCount(),
  };
}

/** Initializes the sync service. */
async function initializeService(state: ServiceState): Promise<void> {
  const { config, indexManager, syncStates, watcher } = state;

  if (state.isInitialized) {
    config.logger.warn('Sync service already initialized');
    return;
  }

  await withSpan(
    'es_sync_initialize',
    { 'es.batch_size': config.batchSize, 'es.batch_timeout_ms': config.batchTimeoutMs },
    async (span) => {
      config.logger.info('Initializing Elasticsearch sync service');

      const initResult = await indexManager.initialize();
      span.setAttribute('es.templates_initialized', initResult.success);
      config.logger.info({ result: initResult.message }, 'Index templates initialized');

      await watcher.discoverAndWatchDatabases();

      span.setAttribute('es.databases_watched', syncStates.size);
      state.isInitialized = true;
      config.logger.info({ watchedDatabases: syncStates.size }, 'Sync service initialized');
    },
  );
}

/** Shuts down the sync service. */
async function shutdownService(state: ServiceState): Promise<void> {
  const { batchProcessor, config, syncStates, watcher } = state;

  config.logger.info('Shutting down Elasticsearch sync service');

  for (const dbName of Array.from(syncStates.keys())) {
    await watcher.unwatchDatabase(dbName);
  }

  batchProcessor.clearTimer();
  await batchProcessor.flushBatch();

  state.isInitialized = false;
  config.logger.info('Elasticsearch sync service shutdown complete');
}

/** Type for the sync service */
export type SyncService = ReturnType<typeof createSyncService>;

// Re-export types for convenience
export type { SyncServiceConfig, SyncStatus } from './sync-types';
