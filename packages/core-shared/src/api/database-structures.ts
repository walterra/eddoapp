/**
 * Shared database structure definitions
 * Design documents and indexes used by both client and server
 */

export interface DesignDocument extends Record<string, unknown> {
  _id: string;
  _rev?: string;
  views?: Record<string, { map: string; reduce?: string }>;
}

export interface IndexDefinition {
  index: { fields: string[] };
  name: string;
  type: 'json';
}

/**
 * Design documents required for todo functionality
 * Used by both client (PouchDB) and server (CouchDB) setup
 *
 * PERFORMANCE NOTE: Views emit minimal data (IDs only or small metadata).
 * Use `include_docs: true` in queries to fetch full documents.
 * This keeps indexes small and rebuilds fast.
 */
export const DESIGN_DOCS: DesignDocument[] = [
  {
    _id: '_design/todos_by_active',
    views: {
      byActive: {
        // Emits activity metadata without full doc - use include_docs to get doc
        map: `function (doc) {
          if (doc.active) {
            Object.entries(doc.active).forEach(([from, to]) => {
              emit(from, { from: from, to: to });
            });
          }
        }`,
      },
    },
  },
  {
    _id: '_design/todos_by_due_date',
    views: {
      byDueDate: {
        // Emits null - use include_docs to get full document
        map: `function (doc) {
          if (doc.due) {
            emit(doc.due, null);
          }
        }`,
      },
    },
  },
  {
    _id: '_design/todos_by_time_tracking_active',
    views: {
      byTimeTrackingActive: {
        // Emits null - doc._id available via row.id with include_docs
        map: `function (doc) {
          if (doc.active) {
            Object.entries(doc.active).forEach((d) => {
              if (d[1] === null) {
                emit(null, null);
              }
            });
          }
        }`,
      },
    },
  },
  {
    _id: '_design/todos_by_parent',
    views: {
      byParent: {
        // Emits [parentId, due] for querying children sorted by due date
        // parentId of null/_ROOT_ for root-level todos
        map: `function (doc) {
          if (doc.version === 'alpha3') {
            var parent = doc.parentId || '_ROOT_';
            emit([parent, doc.due || ''], null);
          }
        }`,
      },
    },
  },
  {
    _id: '_design/tags',
    views: {
      by_tag: {
        map: `function(doc) {
          if (doc.version === 'alpha3' && doc.tags && Array.isArray(doc.tags) && doc.tags.length > 0) {
            for (var i = 0; i < doc.tags.length; i++) {
              emit(doc.tags[i], 1);
            }
          }
        }`,
        reduce: '_count',
      },
    },
  },
];

/**
 * Required indexes for efficient querying
 * These Mango indexes work with both PouchDB and CouchDB
 */
export const REQUIRED_INDEXES: IndexDefinition[] = [
  {
    index: { fields: ['version', 'due'] },
    name: 'version-due-index',
    type: 'json',
  },
  {
    index: { fields: ['version', 'context', 'due'] },
    name: 'version-context-due-index',
    type: 'json',
  },
  {
    index: { fields: ['version', 'completed', 'due'] },
    name: 'version-completed-due-index',
    type: 'json',
  },
  {
    index: { fields: ['version', 'context', 'completed', 'due'] },
    name: 'version-context-completed-due-index',
    type: 'json',
  },
  {
    index: { fields: ['externalId'] },
    name: 'externalId-index',
    type: 'json',
  },
  {
    index: { fields: ['tags'] },
    name: 'tags-index',
    type: 'json',
  },
  {
    index: { fields: ['parentId'] },
    name: 'parentId-index',
    type: 'json',
  },
  {
    index: { fields: ['parentId', 'due'] },
    name: 'parentId-due-index',
    type: 'json',
  },
];
