/**
 * Elasticsearch module for Eddo search.
 *
 * Provides:
 * - ES client factory
 * - Index mappings for todos and audit logs
 * - Index management utilities
 * - CouchDB to ES sync service (per-database indices)
 *
 * Index naming (1:1 with CouchDB):
 * - eddo_user_<username> - Todo documents
 * - eddo_audit_<username> - Audit log documents
 *
 * Wildcard queries:
 * - FROM eddo_user_* - All todos across users
 * - FROM eddo_audit_* - All audit logs across users
 */

export {
  createElasticsearchClient,
  createElasticsearchClientFromEnv,
  testConnection,
} from './client';
export type { ElasticsearchClientConfig } from './client';

export { createIndexManager } from './index-manager';
export type { IndexManager, IndexOperationResult } from './index-manager';

export { createSyncService } from './sync-service';
export type { SyncService, SyncServiceConfig } from './sync-service';

export {
  TODO_INDEX_MAPPING,
  TODO_INDEX_PREFIX,
  TODO_INDEX_SETTINGS,
  TODO_INDEX_TEMPLATE,
} from './todo-mapping';
export type { IndexedTodo } from './todo-mapping';

export { AUDIT_INDEX_MAPPING, AUDIT_INDEX_PREFIX, AUDIT_INDEX_TEMPLATE } from './audit-mapping';
export type { IndexedAuditLog } from './audit-mapping';
