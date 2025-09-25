/**
 * Client-side database setup utilities
 * Creates design documents and indexes that will sync to CouchDB
 */
// @ts-expect-error - Used for type namespace access
import type PouchDB from 'pouchdb-browser';

import {
  DESIGN_DOCS,
  REQUIRED_INDEXES,
  type DesignDocument,
} from '@eddo/core-shared';

import type { SafeDbOperations } from './api/safe-db-operations';

/**
 * Ensures all required design documents exist in the database
 * Updates them if they differ from the expected structure
 */
export async function ensureDesignDocuments(
  safeDb: SafeDbOperations,
  rawDb?: PouchDB.Database,
): Promise<void> {
  for (const expectedDoc of DESIGN_DOCS as DesignDocument[]) {
    try {
      let existingDoc: DesignDocument | null = null;
      let needsUpdate = true;

      try {
        // Try to get existing design document
        existingDoc = await safeDb.safeGet<DesignDocument>(expectedDoc._id);

        // Check if update is needed - compare views
        needsUpdate =
          !existingDoc ||
          JSON.stringify(existingDoc.views) !==
            JSON.stringify(expectedDoc.views);
      } catch (_getErr) {
        // Document doesn't exist - need to create it
        console.log(
          `Design document ${expectedDoc._id} not found, will create`,
        );
        needsUpdate = true;
        existingDoc = null;
      }

      if (needsUpdate) {
        // Update or create the design document with retry logic for conflicts
        let retryCount = 0;
        const maxRetries = 3;

        while (retryCount < maxRetries) {
          try {
            // Refresh the existing doc in case of concurrent updates
            if (retryCount > 0 && existingDoc) {
              existingDoc = await safeDb.safeGet<DesignDocument>(
                expectedDoc._id,
              );
            }

            const docToSave = {
              ...expectedDoc,
              ...(existingDoc?._rev ? { _rev: existingDoc._rev } : {}),
            };

            await safeDb.safePut(docToSave);
            console.log(
              `✅ Design document ${expectedDoc._id} ${existingDoc ? 'updated' : 'created'}`,
            );
            break; // Success - exit retry loop
          } catch (putErr: unknown) {
            if (
              (putErr as Error).message?.includes('conflict') &&
              retryCount < maxRetries - 1
            ) {
              retryCount++;
              console.log(
                `Retrying design document update ${expectedDoc._id} (attempt ${retryCount + 1})`,
              );
              // Short delay before retry
              await new Promise((resolve) =>
                setTimeout(resolve, 100 * retryCount),
              );
            } else {
              throw putErr; // Re-throw if not a conflict or max retries reached
            }
          }
        }
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
