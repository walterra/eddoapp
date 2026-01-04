/**
 * Helper functions for email sync operations
 */
import type { TodoAlpha3 } from '@eddo/core-server';
import type nano from 'nano';

import type { EmailClient, EmailLogger } from './client.js';
import type { EmailItem } from './types.js';

export interface ProcessEmailConfig {
  db: nano.DocumentScope<TodoAlpha3>;
  email: EmailItem;
  tags: string[];
  emailClient: EmailClient;
  logger: EmailLogger;
}

export type ProcessEmailResult = 'created' | 'skipped';

/**
 * Find todo by externalId using CouchDB index
 */
export async function findTodoByExternalId(
  db: nano.DocumentScope<TodoAlpha3>,
  externalId: string,
  logger: EmailLogger,
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
    logger.error('Failed to find todo by externalId', { externalId, error });
    return null;
  }
}

/**
 * Process a single email (create todo if not exists)
 */
export async function processEmail(config: ProcessEmailConfig): Promise<ProcessEmailResult> {
  const { db, email, tags, emailClient, logger } = config;
  const externalId = emailClient.generateExternalId(email);

  // Check if todo already exists
  const existingTodo = await findTodoByExternalId(db, externalId, logger);

  if (existingTodo) {
    logger.debug('Email already synced, skipping', {
      externalId,
      subject: email.subject,
    });
    return 'skipped';
  }

  // Create new todo
  const newTodo = emailClient.mapEmailToTodo(email, tags);
  await db.insert(newTodo as TodoAlpha3);

  logger.debug('Created todo from email', {
    externalId,
    subject: email.subject,
    from: email.from,
  });

  return 'created';
}

export interface SyncStats {
  fetched: number;
  created: number;
  skipped: number;
  errors: number;
}

/**
 * Creates empty sync stats
 */
export function createSyncStats(): SyncStats {
  return {
    fetched: 0,
    created: 0,
    skipped: 0,
    errors: 0,
  };
}

/**
 * Increment stat counter
 */
export function incrementStat(stats: SyncStats, result: ProcessEmailResult | 'error'): void {
  if (result === 'error') {
    stats.errors++;
  } else if (result === 'created') {
    stats.created++;
  } else {
    stats.skipped++;
  }
}
