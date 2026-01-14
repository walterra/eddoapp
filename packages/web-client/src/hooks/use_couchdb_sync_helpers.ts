/**
 * Helper functions for CouchDB sync hook
 */
import PouchDB from 'pouchdb-browser';

/** Creates authenticated fetch function for PouchDB */
function createAuthenticatedFetch(authToken: string) {
  return (url: RequestInfo | URL, opts?: RequestInit) => {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${authToken}`,
    };

    // Only set Content-Type if not already provided (PouchDB sets it for attachments)
    if (opts?.headers) {
      const existingHeaders = opts.headers as Record<string, string>;
      if (!existingHeaders['Content-Type']) {
        headers['Content-Type'] = 'application/json';
      }
      Object.assign(headers, existingHeaders);
    } else {
      headers['Content-Type'] = 'application/json';
    }

    return fetch(url, { ...opts, headers });
  };
}

/**
 * Create authenticated remote PouchDB connection for user database
 */
export function createRemoteDb(authToken: string): PouchDB.Database {
  return new PouchDB(`${window.location.origin}/api/db`, {
    fetch: createAuthenticatedFetch(authToken),
  });
}

/**
 * Create authenticated remote PouchDB connection for attachments database
 */
export function createRemoteAttachmentsDb(authToken: string): PouchDB.Database {
  return new PouchDB(`${window.location.origin}/api/attachments-db`, {
    fetch: createAuthenticatedFetch(authToken),
  });
}

/** Sync configuration options */
export const SYNC_OPTIONS = {
  live: true,
  retry: true,
  batch_size: 10,
  batches_limit: 1,
  heartbeat: 10000,
  timeout: 5000,
} as const;

/**
 * Check if error is an authentication error
 */
export function isAuthError(error: unknown): boolean {
  const errorWithStatus = error as { status?: number };
  return errorWithStatus.status === 401 || errorWithStatus.status === 403;
}

/** Index selectors that match actual query patterns */
const INDEX_SELECTORS = [
  // Primary: version + due compound index (used by useTodosByDateRange)
  { version: 'alpha3', due: { $gt: null } },
  // Secondary: version + context + due (used by context filtering)
  { version: 'alpha3', context: { $gt: null }, due: { $gt: null } },
  // Tertiary: version + completed + due (used by status filtering)
  { version: 'alpha3', completed: { $gt: null }, due: { $gt: null } },
];

/**
 * Warm a single index using requestIdleCallback to avoid blocking UI.
 * Returns a promise that resolves when warming is complete or cancelled.
 */
function warmIndexInBackground(
  rawDb: PouchDB.Database,
  selector: PouchDB.Find.Selector,
  isCancelled: () => boolean,
): Promise<void> {
  return new Promise((resolve) => {
    // Use requestIdleCallback if available, otherwise setTimeout
    const scheduleTask =
      typeof requestIdleCallback !== 'undefined'
        ? (cb: () => void) => requestIdleCallback(cb, { timeout: 5000 })
        : (cb: () => void) => setTimeout(cb, 100);

    scheduleTask(async () => {
      if (isCancelled()) {
        resolve();
        return;
      }

      try {
        // Minimal query to trigger index build: limit 1, only fetch _id
        await rawDb.find({
          selector,
          limit: 1,
          fields: ['_id'],
        });
      } catch {
        // Ignore warming errors - indexes will build on first real query
      }
      resolve();
    });
  });
}

/**
 * Pre-warm indexes after sync to avoid query-time rebuilding.
 * Uses requestIdleCallback to run in background without blocking UI.
 */
export async function preWarmIndexes(
  rawDb: PouchDB.Database,
  isCancelled: () => boolean,
): Promise<void> {
  console.time('preWarmIndexes');

  // Warm indexes sequentially in background
  for (const selector of INDEX_SELECTORS) {
    if (isCancelled()) break;
    await warmIndexInBackground(rawDb, selector, isCancelled);
  }

  if (!isCancelled()) {
    console.timeEnd('preWarmIndexes');
    console.log('✅ Indexes pre-warmed after sync');
  }
}
