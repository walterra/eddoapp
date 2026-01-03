/**
 * Helper functions for RSS sync operations
 */
import type { TodoAlpha3 } from '@eddo/core-server';
import type nano from 'nano';

import type { RssClient, SyncLogger } from './client.js';
import type { RssItem } from './types.js';

export interface ProcessItemConfig {
  db: nano.DocumentScope<TodoAlpha3>;
  item: RssItem;
  tags: string[];
  rssClient: RssClient;
  logger: SyncLogger;
}

export type ProcessItemResult = 'created' | 'skipped';

/**
 * Find todo by externalId
 * Uses externalId index for efficient lookup
 */
export async function findTodoByExternalId(
  db: nano.DocumentScope<TodoAlpha3>,
  externalId: string,
  logger: SyncLogger,
): Promise<TodoAlpha3 | null> {
  try {
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

/**
 * Process a single RSS item (create todo if not exists)
 * RSS items are immutable - we only create, never update
 */
export async function processItem(config: ProcessItemConfig): Promise<ProcessItemResult> {
  const { db, item, tags, rssClient, logger } = config;
  const externalId = rssClient.generateExternalId(item);

  // Check if todo already exists
  const existingTodo = await findTodoByExternalId(db, externalId, logger);

  if (existingTodo) {
    logger.debug('RSS item already exists, skipping', {
      externalId,
      title: item.title,
    });
    return 'skipped';
  }

  // Create new todo
  const newTodo = rssClient.mapItemToTodo(item, tags);
  await db.insert(newTodo as TodoAlpha3);

  logger.debug('Created todo from RSS item', {
    externalId,
    title: item.title,
  });

  return 'created';
}

export interface SyncStats {
  created: number;
  skipped: number;
  errors: number;
}

/**
 * Creates empty sync stats
 */
export function createSyncStats(): SyncStats {
  return {
    created: 0,
    skipped: 0,
    errors: 0,
  };
}

/**
 * Increment stat counter
 */
export function incrementStat(stats: SyncStats, result: ProcessItemResult | 'error'): void {
  if (result === 'error') {
    stats.errors++;
  } else {
    stats[result]++;
  }
}
