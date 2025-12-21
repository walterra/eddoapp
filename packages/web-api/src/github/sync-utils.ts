/**
 * GitHub sync utility functions
 * Extracted for testability
 */
import type { TodoAlpha3 } from '@eddo/core-server';
import type nano from 'nano';

/**
 * Determine if user needs sync based on last sync time and interval
 */
export function shouldSyncUser(preferences?: {
  githubLastSync?: string;
  githubSyncInterval?: number;
}): boolean {
  const lastSync = preferences?.githubLastSync;
  const syncInterval = preferences?.githubSyncInterval || 60; // Default 60 minutes

  if (!lastSync) {
    // Never synced before
    return true;
  }

  const lastSyncTime = new Date(lastSync).getTime();
  const now = Date.now();
  const intervalMs = syncInterval * 60 * 1000;

  return now - lastSyncTime >= intervalMs;
}

/**
 * Find todo by externalId
 */
export async function findTodoByExternalId(
  db: nano.DocumentScope<TodoAlpha3>,
  externalId: string,
  logger: {
    error: (msg: string, meta?: unknown) => void;
  },
): Promise<TodoAlpha3 | null> {
  try {
    // Query using _all_docs with include_docs
    const result = await db.list({ include_docs: true });
    const todo = result.rows
      .map((row) => row.doc)
      .filter((doc): doc is TodoAlpha3 => doc !== undefined && doc.externalId === externalId)[0];

    return todo || null;
  } catch (error) {
    logger.error('Failed to find todo by externalId', {
      externalId,
      error,
    });
    return null;
  }
}
