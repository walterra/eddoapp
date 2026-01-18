/**
 * Batch processing for CouchDB to Elasticsearch sync.
 */

import type { Client } from '@elastic/elasticsearch';
import type { Logger } from 'pino';

import { withSpan } from '../utils/logger';
import type { PendingDoc } from './sync-types';

/** Batch processor configuration */
export interface BatchProcessorConfig {
  esClient: Client;
  logger: Logger;
  batchSize: number;
  batchTimeoutMs: number;
}

/** Bulk operation result */
interface BulkResult {
  errors: boolean;
  items: Array<{ index?: { error?: unknown }; delete?: { error?: unknown } }>;
  took: number;
}

/** Batch processor state */
interface BatchState {
  pendingDocs: PendingDoc[];
  batchTimer: ReturnType<typeof setTimeout> | null;
}

/** Creates a batch processor for Elasticsearch indexing. */
export function createBatchProcessor(config: BatchProcessorConfig) {
  const { esClient, logger, batchSize, batchTimeoutMs } = config;
  const state: BatchState = { batchTimer: null, pendingDocs: [] };

  /** Flushes pending documents to Elasticsearch. */
  async function flushBatch(): Promise<void> {
    if (state.pendingDocs.length === 0) return;

    const docsToProcess = state.pendingDocs.splice(0, state.pendingDocs.length);
    await executeBulkOperation(esClient, logger, docsToProcess, state);
  }

  /** Adds a document to the pending batch. */
  async function queueDocument(pending: PendingDoc): Promise<void> {
    state.pendingDocs.push(pending);

    if (state.pendingDocs.length >= batchSize) {
      clearTimer(state);
      await flushBatch();
    } else {
      scheduleBatchFlush(state, flushBatch, batchTimeoutMs);
    }
  }

  return {
    clearTimer: () => clearTimer(state),
    flushBatch,
    getPendingCount: () => state.pendingDocs.length,
    queueDocument,
  };
}

/** Clears the batch timer. */
function clearTimer(state: BatchState): void {
  if (state.batchTimer) {
    clearTimeout(state.batchTimer);
    state.batchTimer = null;
  }
}

/** Schedules a batch flush. */
function scheduleBatchFlush(
  state: BatchState,
  flushBatch: () => Promise<void>,
  timeoutMs: number,
): void {
  if (state.batchTimer) return;

  state.batchTimer = setTimeout(async () => {
    state.batchTimer = null;
    await flushBatch();
  }, timeoutMs);
}

/** Executes bulk operation with tracing. */
async function executeBulkOperation(
  esClient: Client,
  logger: Logger,
  docsToProcess: PendingDoc[],
  state: BatchState,
): Promise<void> {
  await withSpan('es_sync_bulk_index', buildSpanAttributes(docsToProcess), async (span) => {
    const operations = buildBulkOperations(docsToProcess);
    if (operations.length === 0) return;

    try {
      const result = await esClient.bulk({ operations, refresh: true });
      handleBulkResult(result, span, logger, docsToProcess.length);
    } catch (error) {
      span.setAttribute('es.bulk.error', true);
      logger.error({ error }, 'Bulk indexing failed');
      state.pendingDocs.push(...docsToProcess);
      throw error;
    }
  });
}

/** Builds span attributes for bulk operation. */
function buildSpanAttributes(docsToProcess: PendingDoc[]): Record<string, string | number> {
  const indexCount = docsToProcess.filter((d) => d.action === 'index').length;
  const deleteCount = docsToProcess.filter((d) => d.action === 'delete').length;
  const indices = docsToProcess.reduce(
    (acc, d) => {
      acc[d.indexName] = (acc[d.indexName] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return {
    'es.bulk.delete_count': deleteCount,
    'es.bulk.index_count': indexCount,
    'es.bulk.indices': Object.keys(indices).join(','),
    'es.bulk.total': docsToProcess.length,
  };
}

/** Builds bulk operations array from pending documents. */
function buildBulkOperations(docsToProcess: PendingDoc[]): object[] {
  const operations: object[] = [];

  for (const pending of docsToProcess) {
    if (pending.action === 'index' && pending.doc) {
      operations.push({ index: { _id: pending.id, _index: pending.indexName } });
      operations.push(pending.doc);
    } else if (pending.action === 'delete') {
      operations.push({ delete: { _id: pending.id, _index: pending.indexName } });
    }
  }

  return operations;
}

/** Handles bulk operation result and logging. */
function handleBulkResult(
  result: BulkResult,
  span: { setAttribute: (key: string, value: string | number | boolean) => void },
  logger: Logger,
  count: number,
): void {
  if (result.errors) {
    const errors = result.items.filter((item) => (item.index || item.delete)?.error);
    span.setAttribute('es.bulk.errors', errors.length);
    logger.error({ errorCount: errors.length, errors }, 'Bulk indexing had errors');
  } else {
    span.setAttribute('es.bulk.success', true);
    logger.debug({ count }, 'Bulk indexed');
  }

  span.setAttribute('es.bulk.took_ms', result.took);
}

export type BatchProcessor = ReturnType<typeof createBatchProcessor>;
