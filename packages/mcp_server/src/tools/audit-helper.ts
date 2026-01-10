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

/**
 * Push an audit entry ID to a todo's auditLog array.
 * Fire-and-forget: does not block, silently fails on error.
 * Uses eventual consistency - the audit ID will be added asynchronously.
 */
export function pushAuditIdToTodo(
  db: DocumentScope<TodoAlpha3>,
  todoId: string,
  auditId: string,
  context: ToolContext,
): void {
  // Fire-and-forget: don't await, just log errors
  (async () => {
    try {
      const todo = await db.get(todoId);
      const auditLog = todo.auditLog ?? [];
      auditLog.push(auditId);

      await db.insert({ ...todo, auditLog });

      context.log.debug('Audit ID pushed to todo', { todoId, auditId });
    } catch (error) {
      context.log.warn('Failed to push audit ID to todo', {
        error: error instanceof Error ? error.message : String(error),
        todoId,
        auditId,
      });
    }
  })();
}
