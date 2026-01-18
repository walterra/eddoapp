/**
 * Type definitions for CouchDB to Elasticsearch sync.
 */

import type { AuditLogAlpha1, TodoAlpha3 } from '@eddo/core-shared';
import type { Client } from '@elastic/elasticsearch';
import type { EventEmitter } from 'events';
import type nano from 'nano';
import type { Logger } from 'pino';

import type { IndexedAuditLog } from './audit-mapping';
import type { IndexedTodo } from './todo-mapping';

/** Configuration for the sync service */
export interface SyncServiceConfig {
  /** Elasticsearch client */
  esClient: Client;
  /** Function to get CouchDB server instance */
  getCouchDb: () => nano.ServerScope;
  /** Logger instance */
  logger: Logger;
  /** Batch size for bulk indexing (default: 100) */
  batchSize?: number;
  /** Batch timeout in ms (default: 1000) */
  batchTimeoutMs?: number;
}

/** Database type for routing */
export type DatabaseType = 'user' | 'audit' | 'unknown';

/** Sync state for a single database */
export interface DatabaseSyncState {
  dbName: string;
  esIndexName: string;
  dbType: DatabaseType;
  userId: string;
  lastSeq: string;
  isRunning: boolean;
  changesEmitter: EventEmitter | null;
}

/** Pending document for batch indexing */
export interface PendingDoc {
  action: 'index' | 'delete';
  indexName: string;
  id: string;
  doc?: IndexedTodo | IndexedAuditLog;
}

/** Change event from CouchDB */
export interface ChangeEvent {
  seq: string;
  id: string;
  changes: Array<{ rev: string }>;
  deleted?: boolean;
  doc?: (TodoAlpha3 | AuditLogAlpha1) & { _id: string; _rev: string };
}

/** Sync status response */
export interface SyncStatus {
  isInitialized: boolean;
  pendingDocs: number;
  databases: Array<{
    dbName: string;
    esIndexName: string;
    dbType: DatabaseType;
    userId: string;
    lastSeq: string;
  }>;
}
