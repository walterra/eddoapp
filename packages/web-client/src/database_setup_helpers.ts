/**
 * Helper functions for database setup operations
 */
import type { DesignDocument } from '@eddo/core-shared';

import type { SafeDbOperations } from './api/safe-db-operations';

/** Maximum retry attempts for conflict resolution */
const MAX_RETRIES = 3;

/** Base delay in ms for exponential backoff */
const BASE_RETRY_DELAY = 100;

/**
 * Checks if an existing design document needs to be updated
 * @param existing - Current document in database (or null if not found)
 * @param expected - Expected document structure
 * @returns True if document needs update
 */
export function needsDesignDocUpdate(
  existing: DesignDocument | null,
  expected: DesignDocument,
): boolean {
  if (!existing) return true;
  return JSON.stringify(existing.views) !== JSON.stringify(expected.views);
}

/**
 * Attempts to fetch an existing design document
 * @param safeDb - Database operations wrapper
 * @param docId - Design document ID
 * @returns Document if found, null otherwise
 */
export async function fetchExistingDesignDoc(
  safeDb: SafeDbOperations,
  docId: string,
): Promise<DesignDocument | null> {
  try {
    return await safeDb.safeGet<DesignDocument>(docId);
  } catch (_err) {
    console.log(`Design document ${docId} not found, will create`);
    return null;
  }
}

/**
 * Saves a design document with conflict retry logic
 * @param safeDb - Database operations wrapper
 * @param expectedDoc - Expected document structure
 * @param existingDoc - Existing document (for _rev) or null
 */
export async function saveDesignDocWithRetry(
  safeDb: SafeDbOperations,
  expectedDoc: DesignDocument,
  existingDoc: DesignDocument | null,
): Promise<void> {
  let currentDoc = existingDoc;
  let retryCount = 0;

  while (retryCount < MAX_RETRIES) {
    const saved = await attemptSave(safeDb, expectedDoc, currentDoc, retryCount);
    if (saved) return;

    retryCount++;
    currentDoc = await refreshDocForRetry(safeDb, expectedDoc._id, retryCount);
  }

  throw new Error(`Failed to save design document ${expectedDoc._id} after ${MAX_RETRIES} retries`);
}

/**
 * Single save attempt for a design document
 * @returns True if save succeeded, false if should retry
 */
async function attemptSave(
  safeDb: SafeDbOperations,
  expectedDoc: DesignDocument,
  existingDoc: DesignDocument | null,
  retryCount: number,
): Promise<boolean> {
  try {
    const docToSave = {
      ...expectedDoc,
      ...(existingDoc?._rev ? { _rev: existingDoc._rev } : {}),
    };

    await safeDb.safePut(docToSave);
    const action = existingDoc ? 'updated' : 'created';
    console.log(`✅ Design document ${expectedDoc._id} ${action}`);
    return true;
  } catch (err: unknown) {
    const isConflict = (err as Error).message?.includes('conflict');
    const hasRetriesLeft = retryCount < MAX_RETRIES - 1;

    if (isConflict && hasRetriesLeft) {
      return false;
    }
    throw err;
  }
}

/**
 * Refreshes document and waits before retry
 */
async function refreshDocForRetry(
  safeDb: SafeDbOperations,
  docId: string,
  retryCount: number,
): Promise<DesignDocument | null> {
  console.log(`Retrying design document update ${docId} (attempt ${retryCount + 1})`);
  await new Promise((resolve) => setTimeout(resolve, BASE_RETRY_DELAY * retryCount));
  return fetchExistingDesignDoc(safeDb, docId);
}
