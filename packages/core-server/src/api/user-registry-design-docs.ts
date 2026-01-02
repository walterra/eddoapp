/**
 * Design document setup for user registry
 */
import nano from 'nano';

import type { UserRegistryEntry } from '@eddo/core-shared';

/**
 * User registry design document definition
 */
export const USER_REGISTRY_DESIGN_DOC = {
  _id: '_design/queries',
  views: {
    by_username: {
      map: `function(doc) {
        if (doc.username) {
          emit(doc.username, null);
        }
      }`,
    },
    by_email: {
      map: `function(doc) {
        if (doc.email) {
          emit(doc.email, null);
        }
      }`,
    },
    by_telegram_id: {
      map: `function(doc) {
        if (doc.telegram_id) {
          emit(doc.telegram_id, null);
        }
      }`,
    },
    by_status: {
      map: `function(doc) {
        if (doc.status) {
          emit(doc.status, null);
        }
      }`,
    },
    active_users: {
      map: `function(doc) {
        if (doc.status === 'active') {
          emit(doc.created_at, null);
        }
      }`,
    },
  },
};

const MAX_RETRIES = 10;

/**
 * Handle conflict during design document update
 */
async function handleUpdateConflict(
  db: nano.DocumentScope<UserRegistryEntry>,
  designDoc: typeof USER_REGISTRY_DESIGN_DOC,
  attempt: number,
): Promise<boolean> {
  try {
    const existing = await db.get('_design/queries');
    await db.insert({ ...designDoc, _rev: existing._rev });
    console.log('Updated design document: _design/queries');
    return true;
  } catch (updateError: unknown) {
    const isConflict =
      updateError &&
      typeof updateError === 'object' &&
      'statusCode' in updateError &&
      updateError.statusCode === 409;

    if (isConflict && attempt < MAX_RETRIES) {
      console.warn(`Design document conflict (attempt ${attempt}/${MAX_RETRIES}), retrying...`);
      await new Promise((resolve) => setTimeout(resolve, 200 * attempt));
      return false;
    }

    if (isConflict) {
      console.error('Design document update failed after retries');
    }
    throw updateError;
  }
}

/**
 * Setup design documents for user registry with retry logic for conflicts
 */
/** Check if error is a CouchDB conflict (409) */
function isConflictError(error: unknown): boolean {
  return (
    error !== null && typeof error === 'object' && 'statusCode' in error && error.statusCode === 409
  );
}

/** Attempt to insert design document */
async function tryInsertDesignDoc(
  db: nano.DocumentScope<UserRegistryEntry>,
): Promise<{ success: boolean; error?: unknown }> {
  try {
    await db.insert(USER_REGISTRY_DESIGN_DOC);
    console.log('Created design document: _design/queries');
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error };
  }
}

export async function setupDesignDocuments(
  db: nano.DocumentScope<UserRegistryEntry>,
): Promise<void> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const result = await tryInsertDesignDoc(db);
    if (result.success) return;

    if (!isConflictError(result.error)) throw result.error;

    const resolved = await handleUpdateConflict(db, USER_REGISTRY_DESIGN_DOC, attempt);
    if (resolved) return;
  }
}
