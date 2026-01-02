/**
 * Client-side database setup utilities
 * Creates design documents and indexes that will sync to CouchDB
 */
// @ts-expect-error - Used for type namespace access
import type PouchDB from 'pouchdb-browser';

import { DESIGN_DOCS, REQUIRED_INDEXES, type DesignDocument } from '@eddo/core-shared';

import type { SafeDbOperations } from './api/safe-db-operations';
import {
  fetchExistingDesignDoc,
  needsDesignDocUpdate,
  saveDesignDocWithRetry,
} from './database_setup_helpers';

/**
 * Ensures all required design documents exist in the database
 * Updates them if they differ from the expected structure
 */
export async function ensureDesignDocuments(
  safeDb: SafeDbOperations,
  rawDb?: PouchDB.Database,
): Promise<void> {
  for (const expectedDoc of DESIGN_DOCS as DesignDocument[]) {
    await ensureSingleDesignDoc(safeDb, expectedDoc);
  }

  if (rawDb) {
    await createIndexes(rawDb);
  }
}

/**
 * Ensures a single design document exists and is up to date
 */
async function ensureSingleDesignDoc(
  safeDb: SafeDbOperations,
  expectedDoc: DesignDocument,
): Promise<void> {
  try {
    const existingDoc = await fetchExistingDesignDoc(safeDb, expectedDoc._id);

    if (needsDesignDocUpdate(existingDoc, expectedDoc)) {
      await saveDesignDocWithRetry(safeDb, expectedDoc, existingDoc);
    }
  } catch (err) {
    console.error(`Failed to setup design document ${expectedDoc._id}:`, err);
    throw err;
  }
}

/**
 * Creates indexes in the database
 * Uses PouchDB-find plugin to create Mango indexes
 */
async function createIndexes(db: PouchDB.Database): Promise<void> {
  console.log('🔍 Creating indexes...');

  if (!db || typeof db.createIndex !== 'function') {
    console.warn('⚠️  Database does not support createIndex. Skipping index creation.');
    return;
  }

  for (const indexDef of REQUIRED_INDEXES) {
    await createSingleIndex(db, indexDef);
  }

  console.log('✅ Index creation complete');
}

/**
 * Creates a single index in the database
 */
async function createSingleIndex(
  db: PouchDB.Database,
  indexDef: (typeof REQUIRED_INDEXES)[number],
): Promise<void> {
  try {
    const result = await db.createIndex({ index: indexDef.index });
    logIndexResult(indexDef.name, result);
  } catch (err) {
    console.error(`❌ Failed to create index ${indexDef.name}:`, err);
    // Don't throw - indexes are optimizations, not requirements
  }
}

/**
 * Logs the result of an index creation attempt
 */
function logIndexResult(indexName: string, result: unknown): void {
  const resultObj = result as { result?: string };

  if (resultObj.result === 'created') {
    console.log(`✅ Created index: ${indexName}`);
  } else if (resultObj.result === 'exists') {
    console.log(`ℹ️  Index ${indexName} already exists`);
  } else {
    console.log(`✅ Index setup: ${indexName}`);
  }
}
