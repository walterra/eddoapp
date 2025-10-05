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
 */
export const DESIGN_DOCS: DesignDocument[] = [
  {
    _id: '_design/todos_by_active',
    views: {
      byActive: {
        map: `function (doc) {
          if (doc.active) {
            Object.entries(doc.active).forEach(([from, to]) => {
              emit(from, { doc, from, id: doc._id, to });
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
        map: `function (doc) {
          if (doc.due) {
            emit(doc.due, doc);
          }
        }`,
      },
    },
  },
  {
    _id: '_design/todos_by_time_tracking_active',
    views: {
      byTimeTrackingActive: {
        map: `function (doc) {
          Object.entries(doc.active).forEach((d) => {
            if (d[1] === null) {
              emit(null, { id: doc._id });
            }
          });
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
];
