/**
 * Helper functions for GitHub sync operations
 */
import type { TodoAlpha3 } from '@eddo/core-server';
import type nano from 'nano';

import { logSyncAudit } from '../utils/sync-audit.js';
import type { GithubClient } from './client.js';
import { findTodoByExternalId } from './sync-utils.js';
import type { GithubIssue } from './types.js';

export interface SyncLogger {
  info: (msg: string, meta?: unknown) => void;
  warn: (msg: string, meta?: unknown) => void;
  error: (msg: string, meta?: unknown) => void;
  debug: (msg: string, meta?: unknown) => void;
}

export interface ProcessIssueConfig {
  db: nano.DocumentScope<TodoAlpha3>;
  issue: GithubIssue;
  context: string;
  tags: string[];
  githubClient: GithubClient;
  forceResync: boolean;
  logger: SyncLogger;
  username: string;
}

export type ProcessIssueResult = 'created' | 'updated' | 'completed' | 'unchanged';

/**
 * Compares two todos for equality, ignoring PouchDB metadata fields
 * Returns true if todos are meaningfully different
 */
export function hasTodoChanged(
  existing: TodoAlpha3,
  updated: Partial<TodoAlpha3> & { _id: string; _rev: string },
): boolean {
  const fieldsToCompare: (keyof TodoAlpha3)[] = [
    'title',
    'description',
    'context',
    'due',
    'tags',
    'active',
    'completed',
    'repeat',
    'link',
  ];

  for (const field of fieldsToCompare) {
    const existingValue = existing[field];
    const updatedValue = updated[field];

    // Deep comparison for objects and arrays
    if (field === 'tags' || field === 'active') {
      if (JSON.stringify(existingValue) !== JSON.stringify(updatedValue)) {
        return true;
      }
    } else if (existingValue !== updatedValue) {
      return true;
    }
  }

  return false;
}

/**
 * Create a new todo from a GitHub issue
 */
async function createNewTodo(config: ProcessIssueConfig): Promise<ProcessIssueResult> {
  const { db, issue, context, tags, githubClient, username } = config;
  const newTodo = githubClient.mapIssueToTodo(issue, context, tags);
  await db.insert(newTodo as TodoAlpha3);

  await logSyncAudit({
    username,
    source: 'github-sync',
    action: 'create',
    entityId: newTodo._id,
    after: newTodo,
    metadata: { issueNumber: issue.number, repository: issue.repository.full_name },
  });

  return 'created';
}

/**
 * Update an existing todo with force resync
 */
async function forceResyncTodo(
  config: ProcessIssueConfig,
  existingTodo: TodoAlpha3,
): Promise<ProcessIssueResult> {
  const { db, issue, context, tags, githubClient, username } = config;
  const freshTodo = githubClient.mapIssueToTodo(issue, context, tags);

  const updatedTodo = {
    ...freshTodo,
    _id: existingTodo._id,
    _rev: existingTodo._rev,
    active: existingTodo.active, // Preserve time tracking
    repeat: existingTodo.repeat, // Preserve repeat settings
    completed: existingTodo.completed || freshTodo.completed,
  } as TodoAlpha3;

  if (hasTodoChanged(existingTodo, updatedTodo)) {
    await db.insert(updatedTodo);

    await logSyncAudit({
      username,
      source: 'github-sync',
      action: 'update',
      entityId: updatedTodo._id,
      before: existingTodo,
      after: updatedTodo,
      metadata: { issueNumber: issue.number, repository: issue.repository.full_name },
    });

    return 'updated';
  }
  return 'unchanged';
}

/**
 * Mark a todo as completed if the issue was closed
 */
async function handleClosedIssue(
  config: ProcessIssueConfig,
  existingTodo: TodoAlpha3,
): Promise<ProcessIssueResult> {
  const { db, issue, username } = config;

  if (issue.state === 'closed' && !existingTodo.completed) {
    const updatedTodo = {
      ...existingTodo,
      completed: issue.closed_at || new Date().toISOString(),
    };

    if (hasTodoChanged(existingTodo, updatedTodo)) {
      await db.insert(updatedTodo);

      await logSyncAudit({
        username,
        source: 'github-sync',
        action: 'complete',
        entityId: updatedTodo._id,
        before: existingTodo,
        after: updatedTodo,
        metadata: { issueNumber: issue.number, repository: issue.repository.full_name },
      });

      return 'completed';
    }
  }
  return 'unchanged';
}

/**
 * Update an existing todo with changed title/description
 */
async function updateTodoContent(
  config: ProcessIssueConfig,
  existingTodo: TodoAlpha3,
): Promise<ProcessIssueResult> {
  const { db, issue, username } = config;

  const updatedTodo = {
    ...existingTodo,
    title: issue.title,
    description: issue.body || '',
  };

  if (hasTodoChanged(existingTodo, updatedTodo)) {
    await db.insert(updatedTodo);

    await logSyncAudit({
      username,
      source: 'github-sync',
      action: 'update',
      entityId: updatedTodo._id,
      before: existingTodo,
      after: updatedTodo,
      metadata: { issueNumber: issue.number, repository: issue.repository.full_name },
    });

    return 'updated';
  }

  return 'unchanged';
}

/**
 * Process a single GitHub issue (create or update todo)
 */
export async function processIssue(config: ProcessIssueConfig): Promise<ProcessIssueResult> {
  const { db, issue, githubClient, forceResync, logger } = config;
  const externalId = githubClient.generateExternalId(issue);

  // Check if todo already exists
  const existingTodo = await findTodoByExternalId(db, externalId, logger);

  if (!existingTodo) {
    return createNewTodo(config);
  }

  if (forceResync) {
    return forceResyncTodo(config, existingTodo);
  }

  // Check if issue was closed
  const closedResult = await handleClosedIssue(config, existingTodo);
  if (closedResult !== 'unchanged') {
    return closedResult;
  }

  // Check if issue content needs update
  return updateTodoContent(config, existingTodo);
}
