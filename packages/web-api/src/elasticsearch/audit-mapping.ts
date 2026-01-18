/**
 * Elasticsearch index mapping for AuditLogAlpha1 documents.
 * Optimized for ES|QL time-series queries and action filtering.
 */

import { TODO_INDEX_SETTINGS } from './todo-mapping';

/**
 * Index mapping for AuditLogAlpha1 documents.
 *
 * Design decisions:
 * - action and source as keywords for exact filtering
 * - timestamp as date for time-series queries
 * - before/after as flattened to handle partial todo snapshots
 * - entityId links to the todo document
 */
export const AUDIT_INDEX_MAPPING = {
  dynamic: 'strict',
  properties: {
    // Audit log entry ID (ISO timestamp)
    auditId: {
      type: 'keyword',
    },

    // CouchDB revision - not searchable but stored
    auditRev: {
      type: 'keyword',
      index: false,
    },

    // Schema version
    version: {
      type: 'keyword',
    },

    // When the action occurred
    timestamp: {
      type: 'date',
    },

    // Action type
    action: {
      type: 'keyword',
    },

    // Entity type (currently always 'todo')
    entityType: {
      type: 'keyword',
    },

    // Entity ID (todo ID)
    entityId: {
      type: 'keyword',
    },

    // Source of the action
    source: {
      type: 'keyword',
    },

    // State before the action (partial todo snapshot)
    before: {
      type: 'flattened',
    },

    // State after the action (partial todo snapshot)
    after: {
      type: 'flattened',
    },

    // Additional metadata
    metadata: {
      type: 'flattened',
    },

    // User ID for multi-tenant queries
    userId: {
      type: 'keyword',
    },

    // Database name
    database: {
      type: 'keyword',
    },

    // Sync timestamp
    syncedAt: {
      type: 'date',
    },
  },
} as const;

/**
 * Index template for audit indices.
 * Applies to indices matching "eddo_audit_*" pattern.
 */
export const AUDIT_INDEX_TEMPLATE = {
  index_patterns: ['eddo_audit_*'],
  template: {
    settings: TODO_INDEX_SETTINGS,
    mappings: AUDIT_INDEX_MAPPING,
  },
  priority: 100,
  _meta: {
    description: 'Index template for Eddo audit log documents',
    schema_version: 'audit_alpha1',
  },
} as const;

/** Audit log index name prefix */
export const AUDIT_INDEX_PREFIX = 'eddo_audit_';

/**
 * Type definitions for the indexed audit document.
 */
export interface IndexedAuditLog {
  auditId: string;
  auditRev: string;
  version: 'audit_alpha1';
  timestamp: string;
  action:
    | 'create'
    | 'update'
    | 'delete'
    | 'complete'
    | 'uncomplete'
    | 'time_tracking_start'
    | 'time_tracking_stop';
  entityType: 'todo';
  entityId: string;
  source: 'web' | 'mcp' | 'telegram' | 'github-sync' | 'rss-sync' | 'email-sync';
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  // Sync-specific fields
  userId: string;
  database: string;
  syncedAt: string;
}
