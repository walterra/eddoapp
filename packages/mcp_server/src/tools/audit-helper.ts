/**
 * Audit logging helper for MCP tools.
 * Logs todo operations to the user's audit database.
 */
import {
  createEnv,
  ensureAuditDatabase,
  getAuditService,
  type AuditAction,
  type Env,
  type TodoAlpha3,
} from '@eddo/core-server';
import type { DocumentScope } from 'nano';

import type { ToolContext } from './types.js';

/** Lazy-loaded env to avoid issues during module import */
let envCache: Env | null = null;
function getEnv(): Env {
  if (!envCache) {
    envCache = createEnv();
  }
  return envCache;
}

/** Options for logging an audit action from MCP */
export interface McpAuditOptions {
  action: AuditAction;
  entityId: string;
  before?: Partial<TodoAlpha3>;
  after?: Partial<TodoAlpha3>;
  /** Optional human-readable message describing the action (short, like a git commit message) */
  message?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Log an audit entry for an MCP tool operation.
 * Silently fails if audit logging encounters an error (non-blocking).
 * @returns The audit entry ID (_id) if successful, null otherwise
 */
export async function logMcpAudit(
  context: ToolContext,
  options: McpAuditOptions,
): Promise<string | null> {
  // Skip for anonymous sessions
  if (!context.session || context.session.userId === 'anonymous') {
    return null;
  }

  const username = context.session.username;

  try {
    const env = getEnv();

    // Ensure audit database exists
    await ensureAuditDatabase(env.COUCHDB_URL, env, username);

    // Get audit service and log the action
    const auditService = getAuditService(env.COUCHDB_URL, env, username);
    const auditEntry = await auditService.logAction({
      action: options.action,
      entityId: options.entityId,
      source: 'mcp',
      before: options.before,
      after: options.after,
      message: options.message,
      metadata: options.metadata,
    });

    context.log.debug('Audit logged', {
      action: options.action,
      entityId: options.entityId,
      auditId: auditEntry._id,
    });

    return auditEntry._id;
  } catch (error) {
    // Log error but don't fail the operation
    context.log.warn('Failed to log audit entry', {
      error: error instanceof Error ? error.message : String(error),
      action: options.action,
      entityId: options.entityId,
    });
    return null;
  }
}

/** Maximum retries for conflict resolution */
const MAX_RETRIES = 5;

/** Check if error is a CouchDB conflict error */
function isConflictError(error: unknown): boolean {
  if (error && typeof error === 'object') {
    const err = error as { statusCode?: number; error?: string };
    return err.statusCode === 409 || err.error === 'conflict';
  }
  return false;
}

/**
 * Push an audit entry ID to a todo's auditLog array.
 * Includes retry logic for CouchDB revision conflicts.
 * Silently fails on error (non-blocking to main operation).
 */
export async function pushAuditIdToTodo(
  db: DocumentScope<TodoAlpha3>,
  todoId: string,
  auditId: string,
  context: ToolContext,
): Promise<void> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const todo = await db.get(todoId);
      const auditLog = todo.auditLog ?? [];
      auditLog.push(auditId);

      await db.insert({ ...todo, auditLog });

      context.log.debug('Audit ID pushed to todo', { todoId, auditId });
      return; // Success, exit retry loop
    } catch (error) {
      if (isConflictError(error) && attempt < MAX_RETRIES - 1) {
        // Conflict detected, retry with fresh document
        context.log.debug('Conflict on audit push, retrying', {
          todoId,
          auditId,
          attempt: attempt + 1,
        });
        continue;
      }
      context.log.warn('Failed to push audit ID to todo', {
        error: error instanceof Error ? error.message : String(error),
        todoId,
        auditId,
      });
      return; // Give up after max retries or non-conflict error
    }
  }
}
