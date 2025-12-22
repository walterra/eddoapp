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
 * Uses externalId index for efficient lookup
 */
export async function findTodoByExternalId(
  db: nano.DocumentScope<TodoAlpha3>,
  externalId: string,
  logger: {
    error: (msg: string, meta?: unknown) => void;
  },
): Promise<TodoAlpha3 | null> {
  try {
    // Use Mango query with externalId index
    const result = await db.find({
      selector: {
        externalId: { $eq: externalId },
      },
      limit: 1,
      use_index: 'externalId-index',
    });

    return result.docs[0] || null;
  } catch (error) {
    logger.error('Failed to find todo by externalId', {
      externalId,
      error,
    });
    return null;
  }
}
