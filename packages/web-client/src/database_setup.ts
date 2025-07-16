/**
 * Client-side database setup utilities
 * Creates design documents and indexes that will sync to CouchDB
 */
import type { SafeDbOperations } from '@eddo/core';
// @ts-expect-error - Used for type namespace access
import type PouchDB from 'pouchdb-browser';

interface DesignDocument {
  _id: string;
  _rev?: string;
  views?: Record<string, { map: string; reduce?: string }>;
}

const DESIGN_DOCS: DesignDocument[] = [
  {
    _id: '_design/todos',
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
      byDueDate: {
        map: `function (doc) {
          if (doc.due) {
            emit(doc.due, doc);
          }
        }`,
      },
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
 * Ensures all required design documents exist in the database
 * Updates them if they differ from the expected structure
 */
export async function ensureDesignDocuments(
  safeDb: SafeDbOperations,
  rawDb?: PouchDB.Database,
): Promise<void> {
  for (const expectedDoc of DESIGN_DOCS) {
    try {
      // Try to get existing design document
      const existingDoc = await safeDb.safeGet<DesignDocument>(expectedDoc._id);

      // Check if update is needed
      const needsUpdate =
        !existingDoc ||
        JSON.stringify(existingDoc.views) !== JSON.stringify(expectedDoc.views);

      if (needsUpdate) {
        // Update or create the design document
        await safeDb.safePut({
          ...expectedDoc,
          _rev: existingDoc?._rev,
        });
        console.log(`✅ Design document ${expectedDoc._id} updated`);
      }
    } catch (err) {
      console.error(`Failed to setup design document ${expectedDoc._id}:`, err);
      throw err;
    }
  }

  // Create indexes after design documents
  if (rawDb) {
    await createIndexes(rawDb);
  }
}

/**
 * Creates CouchDB-compatible indexes for efficient querying
 */
export const REQUIRED_INDEXES = [
  {
    index: { fields: ['version', 'due'] },
    name: 'version-due-index',
    type: 'json' as const,
  },
  {
    index: { fields: ['version', 'context', 'due'] },
    name: 'version-context-due-index',
    type: 'json' as const,
  },
  {
    index: { fields: ['version', 'completed', 'due'] },
    name: 'version-completed-due-index',
    type: 'json' as const,
  },
];

/**
 * Creates indexes in the database
 * Uses PouchDB-find plugin to create Mango indexes
 */
async function createIndexes(db: PouchDB.Database): Promise<void> {
  console.log('🔍 Creating indexes...');

  if (!db || typeof db.createIndex !== 'function') {
    console.warn(
      '⚠️  Database does not support createIndex. Skipping index creation.',
    );
    return;
  }

  for (const indexDef of REQUIRED_INDEXES) {
    try {
      const result = await db.createIndex({
        index: indexDef.index,
      });

      const resultObj = result as { result?: string };
      if (resultObj.result === 'created') {
        console.log(`✅ Created index: ${indexDef.name}`);
      } else if (resultObj.result === 'exists') {
        console.log(`ℹ️  Index ${indexDef.name} already exists`);
      } else {
        console.log(`✅ Index setup: ${indexDef.name}`);
      }
    } catch (err) {
      console.error(`❌ Failed to create index ${indexDef.name}:`, err);
      // Don't throw - indexes are optimizations, not requirements
    }
  }

  console.log('✅ Index creation complete');
}
