/**
 * Helper functions for email sync operations
 */
import type { TodoAlpha3 } from '@eddo/core-server';
import type nano from 'nano';

import { logSyncAudit } from '../utils/sync-audit.js';
import type { EmailClient, EmailLogger } from './client.js';
import type { EmailItem } from './types.js';

export interface ProcessEmailConfig {
  db: nano.DocumentScope<TodoAlpha3>;
  email: EmailItem;
  tags: string[];
  emailClient: EmailClient;
  logger: EmailLogger;
  username: string;
}

/** Result of processing a single email */
export interface ProcessEmailResult {
  /** Processing outcome */
  status: 'created' | 'skipped' | 'needs_move';
  /** Email UID for move tracking */
  uid: number;
  /** Todo ID if created or found */
  todoId?: string;
}

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
 * Check if todo needs to be moved (exists but email:moved is not set)
 */
function todoNeedsMove(todo: TodoAlpha3): boolean {
  return todo.metadata?.['email:moved'] !== 'true';
}

/**
 * Process a single email (create todo if not exists)
 */
export async function processEmail(config: ProcessEmailConfig): Promise<ProcessEmailResult> {
  const { db, email, tags, emailClient, logger, username } = config;
  const externalId = emailClient.generateExternalId(email);

  // Check if todo already exists
  const existingTodo = await findTodoByExternalId(db, externalId, logger);

  if (existingTodo) {
    // Check if this todo exists but email wasn't moved (retry scenario)
    if (todoNeedsMove(existingTodo)) {
      logger.debug('Email exists but not moved, will retry move', {
        externalId,
        subject: email.subject,
        todoId: existingTodo._id,
      });
      return { status: 'needs_move', uid: email.uid, todoId: existingTodo._id };
    }

    logger.debug('Email already synced and moved, skipping', {
      externalId,
      subject: email.subject,
    });
    return { status: 'skipped', uid: email.uid };
  }

  // Create new todo with email:uid metadata for move tracking
  const newTodo = emailClient.mapEmailToTodo(email, tags);
  const todoWithMetadata: Omit<TodoAlpha3, '_rev'> = {
    ...newTodo,
    metadata: {
      ...newTodo.metadata,
      'email:uid': String(email.uid),
    },
  };

  await db.insert(todoWithMetadata as TodoAlpha3);

  await logSyncAudit({
    username,
    source: 'email-sync',
    action: 'create',
    entityId: todoWithMetadata._id,
    after: todoWithMetadata,
    metadata: { subject: email.subject, from: email.from },
  });

  logger.debug('Created todo from email', {
    externalId,
    subject: email.subject,
    from: email.from,
    uid: email.uid,
  });

  return { status: 'created', uid: email.uid, todoId: todoWithMetadata._id };
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
 * Mark todo as moved by setting email:moved metadata
 */
export async function markTodoAsMoved(
  db: nano.DocumentScope<TodoAlpha3>,
  todoId: string,
  logger: EmailLogger,
): Promise<boolean> {
  try {
    const doc = await db.get(todoId);
    const updated: TodoAlpha3 = {
      ...doc,
      metadata: {
        ...doc.metadata,
        'email:moved': 'true',
      },
    };
    await db.insert(updated);
    logger.debug('Marked todo as moved', { todoId });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Failed to mark todo as moved', { todoId, error: message });
    return false;
  }
}

/**
 * Increment stat counter based on processing result
 */
export function incrementStat(
  stats: SyncStats,
  result: ProcessEmailResult | { status: 'error' },
): void {
  const status = typeof result === 'object' && 'status' in result ? result.status : result;

  if (status === 'error') {
    stats.errors++;
  } else if (status === 'created') {
    stats.created++;
  } else {
    // 'skipped' or 'needs_move' both count as skipped for stats
    stats.skipped++;
  }
}
