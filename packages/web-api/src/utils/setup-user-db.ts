import {
  createEnv,
  createUserRegistry,
  getUserDatabaseName,
} from '@eddo/core-server';
import type { DocumentScope } from 'nano';

/**
 * Database setup utilities for new user databases
 * Creates design documents and indexes that are required for todo functionality
 */

interface DesignDocument extends Record<string, unknown> {
  _id: string;
  _rev?: string;
  views?: Record<string, { map: string; reduce?: string }>;
}

interface IndexDefinition {
  index: { fields: string[] };
  name: string;
  type: 'json';
}

/**
 * Design documents required for todo functionality
 */
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
 * Required indexes for efficient querying
 */
const REQUIRED_INDEXES: IndexDefinition[] = [
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

/**
 * Setup a new user database with all required design documents and indexes
 */
export async function setupUserDatabase(username: string): Promise<void> {
  const env = createEnv();
  const userRegistry = createUserRegistry(env.COUCHDB_URL, env);

  // Ensure user database exists
  await userRegistry.ensureUserDatabase(username);

  // Get the user database instance
  const userDb = userRegistry.getUserDatabase(username);

  // Setup design documents
  await setupDesignDocuments(userDb);

  // Setup indexes
  await setupIndexes(userDb);

  console.log(`✅ User database setup complete for: ${username}`);
}

/**
 * Create design documents in the user database
 */
async function setupDesignDocuments(
  db: DocumentScope<Record<string, unknown>>,
): Promise<void> {
  console.log('📝 Setting up design documents...');

  for (const designDoc of DESIGN_DOCS) {
    try {
      // Try to get existing design document
      let existingDoc: DesignDocument | null = null;
      try {
        existingDoc = (await db.get(designDoc._id)) as DesignDocument;
      } catch (error: unknown) {
        // Document doesn't exist, which is fine
        if (
          error &&
          typeof error === 'object' &&
          'statusCode' in error &&
          error.statusCode !== 404
        ) {
          throw error;
        }
      }

      // Check if update is needed
      const needsUpdate =
        !existingDoc ||
        JSON.stringify(existingDoc.views) !== JSON.stringify(designDoc.views);

      if (needsUpdate) {
        // Update or create the design document
        const docToInsert: DesignDocument = {
          ...designDoc,
          _rev: existingDoc?._rev,
        };

        await db.insert(docToInsert);
        console.log(`✅ Design document ${designDoc._id} updated`);
      } else {
        console.log(`✅ Design document ${designDoc._id} already up to date`);
      }
    } catch (error) {
      console.error(
        `❌ Failed to setup design document ${designDoc._id}:`,
        error,
      );
      throw error;
    }
  }
}

/**
 * Create indexes in the user database
 * Uses nano's built-in createIndex method
 */
async function setupIndexes(
  db: DocumentScope<Record<string, unknown>>,
): Promise<void> {
  console.log('🔍 Setting up indexes...');

  for (const indexDef of REQUIRED_INDEXES) {
    try {
      // Use nano's built-in createIndex method
      const response = await db.createIndex({
        index: indexDef.index,
        name: indexDef.name,
        type: indexDef.type,
      });

      if (response.result === 'created') {
        console.log(`✅ Index ${indexDef.name} created`);
      } else if (response.result === 'exists') {
        console.log(`✅ Index ${indexDef.name} already exists`);
      } else {
        console.log(`✅ Index ${indexDef.name} result: ${response.result}`);
      }
    } catch (error: unknown) {
      console.error(`❌ Failed to create index ${indexDef.name}:`, error);
      throw error;
    }
  }
}

/**
 * Clean up user database (useful for testing)
 */
export async function cleanupUserDatabase(username: string): Promise<void> {
  const env = createEnv();
  const userRegistry = createUserRegistry(env.COUCHDB_URL, env);

  try {
    const dbName = getUserDatabaseName(env, username);
    const couchConnection = (
      userRegistry as {
        context?: {
          couchConnection?: {
            db: { destroy: (name: string) => Promise<void> };
          };
        };
      }
    ).context?.couchConnection;

    if (couchConnection) {
      await couchConnection.db.destroy(dbName);
      console.log(`✅ User database cleaned up: ${dbName}`);
    }
  } catch (error) {
    console.error(`❌ Failed to cleanup user database for ${username}:`, error);
    throw error;
  }
}

/**
 * Verify user database setup
 */
export async function verifyUserDatabase(username: string): Promise<boolean> {
  const env = createEnv();
  const userRegistry = createUserRegistry(env.COUCHDB_URL, env);

  try {
    const userDb = userRegistry.getUserDatabase(username);

    // Check design documents
    for (const designDoc of DESIGN_DOCS) {
      try {
        await userDb.get(designDoc._id);
        console.log(`✅ Design document ${designDoc._id} exists`);
      } catch (_error) {
        console.error(`❌ Design document ${designDoc._id} missing`);
        return false;
      }
    }

    console.log(`✅ User database verification passed for: ${username}`);
    return true;
  } catch (error) {
    console.error(
      `❌ User database verification failed for ${username}:`,
      error,
    );
    return false;
  }
}
