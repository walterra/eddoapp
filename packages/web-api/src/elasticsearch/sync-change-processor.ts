/**
 * Change processing functions for CouchDB to Elasticsearch sync.
 */

import type { AuditLogAlpha1, TodoAlpha3 } from '@eddo/core-shared';

import { withSpan } from '../utils/logger';
import type { BatchProcessor } from './sync-batch';
import { toIndexedAuditLog, toIndexedTodo } from './sync-transforms';
import type { ChangeEvent, DatabaseSyncState } from './sync-types';

/** Checks if a document should be skipped. */
export function shouldSkipDocument(docId: string): boolean {
  return docId.startsWith('_design/') || docId.startsWith('_local/');
}

/** Builds span attributes for a change event. */
function buildChangeSpanAttributes(
  change: ChangeEvent,
  state: DatabaseSyncState,
): Record<string, string | number | boolean> {
  return {
    'couchdb.database': state.dbName,
    'couchdb.deleted': change.deleted ?? false,
    'couchdb.doc_id': change.id,
    'couchdb.seq': change.seq,
    'es.index': state.esIndexName,
    'user.id': state.userId,
  };
}

/** Processes a single change from a todo database. */
export async function processTodoChange(
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
export async function processAuditChange(
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

/** Indexes a single document during initial sync. */
export async function indexInitialDoc(
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

/** Processes all documents during initial sync. */
export async function processInitialDocs(
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
