/**
 * Helper functions for CouchDB sync hook
 */
import PouchDB from 'pouchdb-browser';

/**
 * Create authenticated remote PouchDB connection
 */
export function createRemoteDb(authToken: string): PouchDB.Database {
  return new PouchDB(`${window.location.origin}/api/db`, {
    fetch: (url, opts) => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      };

      if (opts?.headers) {
        Object.assign(headers, opts.headers);
      }

      return fetch(url, {
        ...opts,
        headers,
      });
    },
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

/**
 * Pre-warm indexes after sync to avoid query-time rebuilding
 */
export async function preWarmIndexes(
  rawDb: PouchDB.Database,
  isCancelled: () => boolean,
): Promise<void> {
  try {
    if (isCancelled()) return;
    await rawDb.find({
      selector: { version: 'alpha3' },
      limit: 0,
    });
    if (!isCancelled()) {
      console.log('✅ Indexes pre-warmed after sync');
    }
  } catch (err) {
    if (!isCancelled()) {
      console.warn('⚠️  Index pre-warming failed:', err);
    }
  }
}
