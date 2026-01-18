/**
 * Elasticsearch index mapping for TodoAlpha3 documents.
 * Optimized for ES|QL queries with full-text search support.
 */

/**
 * Index settings for todo indices.
 * Single shard for simplicity in development; increase for production scale.
 */
export const TODO_INDEX_SETTINGS = {
  number_of_shards: 1,
  number_of_replicas: 0,
  analysis: {
    analyzer: {
      // Custom analyzer for todo content - handles markdown, code snippets, URLs
      todo_content: {
        type: 'custom',
        tokenizer: 'standard',
        filter: ['lowercase', 'asciifolding', 'todo_stemmer'],
      },
    },
    filter: {
      todo_stemmer: {
        type: 'stemmer',
        language: 'english',
      },
    },
  },
} as const;

/**
 * Index mapping for TodoAlpha3 documents.
 *
 * Design decisions:
 * - text fields with keyword sub-fields for both MATCH() and exact matching
 * - date fields for ES|QL date functions (DATE_TRUNC, DATE_DIFF, etc.)
 * - nested type for notes to preserve note structure in queries
 * - flattened type for metadata to handle dynamic namespaced keys
 */
export const TODO_INDEX_MAPPING = {
  dynamic: 'strict',
  properties: {
    // CouchDB document ID (ISO timestamp of creation)
    // Note: We use 'todoId' instead of '_id' because '_id' is reserved by Elasticsearch
    // The ES document _id is set to the CouchDB _id during indexing
    todoId: {
      type: 'keyword',
    },

    // CouchDB revision - not searchable but stored
    todoRev: {
      type: 'keyword',
      index: false,
    },

    // Todo title - primary search field
    title: {
      type: 'text',
      analyzer: 'todo_content',
      fields: {
        keyword: {
          type: 'keyword',
          ignore_above: 256,
        },
      },
    },

    // Todo description - full-text searchable (markdown content)
    description: {
      type: 'text',
      analyzer: 'todo_content',
      fields: {
        keyword: {
          type: 'keyword',
          ignore_above: 1024,
        },
      },
    },

    // GTD context (e.g., "work", "private", "walterra/eddoapp")
    context: {
      type: 'keyword',
    },

    // Tags array (e.g., ["gtd:next", "urgent"])
    tags: {
      type: 'keyword',
    },

    // Due date as ISO string
    due: {
      type: 'date',
    },

    // Completion date (null if not completed)
    completed: {
      type: 'date',
    },

    // Repeat interval in days (null if not repeating)
    repeat: {
      type: 'integer',
    },

    // Time tracking sessions: key = start ISO, value = end ISO or null
    active: {
      type: 'flattened',
    },

    // External system ID (e.g., "github:owner/repo/issues/123")
    externalId: {
      type: 'keyword',
    },

    // URL reference
    link: {
      type: 'keyword',
    },

    // Parent todo ID for subtasks
    parentId: {
      type: 'keyword',
    },

    // Blocked by todo IDs
    blockedBy: {
      type: 'keyword',
    },

    // Audit log entry IDs
    auditLog: {
      type: 'keyword',
      index: false,
    },

    // Schema version
    version: {
      type: 'keyword',
    },

    // Work diary notes - nested for structured queries
    notes: {
      type: 'nested',
      properties: {
        id: { type: 'keyword' },
        content: {
          type: 'text',
          analyzer: 'todo_content',
        },
        createdAt: { type: 'date' },
        updatedAt: { type: 'date' },
        attachments: { type: 'keyword', index: false },
      },
    },

    // Extensible metadata with namespaced keys (agent:, github:, rss:)
    // Flattened type handles dynamic keys without mapping explosion
    metadata: {
      type: 'flattened',
    },

    // User ID for multi-tenant search (added during sync)
    userId: {
      type: 'keyword',
    },

    // Database name for filtering (added during sync)
    database: {
      type: 'keyword',
    },

    // Sync timestamp (when document was indexed)
    syncedAt: {
      type: 'date',
    },
  },
} as const;

/**
 * Index template for todo indices.
 * Applies to indices matching "eddo_user_*" pattern (1:1 with CouchDB databases).
 */
export const TODO_INDEX_TEMPLATE = {
  index_patterns: ['eddo_user_*'],
  template: {
    settings: TODO_INDEX_SETTINGS,
    mappings: TODO_INDEX_MAPPING,
  },
  priority: 100,
  _meta: {
    description: 'Index template for Eddo todo documents (per-user indices)',
    schema_version: 'alpha3',
  },
} as const;

/** Todo index name prefix (matches CouchDB database naming) */
export const TODO_INDEX_PREFIX = 'eddo_user_';

/**
 * @deprecated Use TODO_INDEX_PREFIX with per-user indices instead.
 * Kept for backward compatibility during migration.
 */
export const TODO_INDEX_NAME = 'eddo_todos';

/**
 * Type definitions for the indexed document.
 * Extends TodoAlpha3 with sync-specific fields.
 */
export interface IndexedTodo {
  /** CouchDB document ID (mapped to todoId field, also used as ES _id) */
  todoId: string;
  /** CouchDB revision */
  todoRev: string;
  title: string;
  description: string;
  context: string;
  tags: string[];
  due: string;
  completed: string | null;
  repeat: number | null;
  active: Record<string, string | null>;
  externalId?: string | null;
  link: string | null;
  parentId?: string | null;
  blockedBy?: string[];
  auditLog?: string[];
  version: 'alpha3';
  notes?: Array<{
    id: string;
    content: string;
    createdAt: string;
    updatedAt?: string;
    attachments?: string[];
  }>;
  metadata?: Record<string, string | string[]>;
  // Sync-specific fields
  userId: string;
  database: string;
  syncedAt: string;
}
