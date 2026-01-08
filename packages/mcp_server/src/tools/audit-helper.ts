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
  metadata?: Record<string, unknown>;
}

/**
 * Log an audit entry for an MCP tool operation.
 * Silently fails if audit logging encounters an error (non-blocking).
 */
export async function logMcpAudit(context: ToolContext, options: McpAuditOptions): Promise<void> {
  // Skip for anonymous sessions
  if (!context.session || context.session.userId === 'anonymous') {
    return;
  }

  const username = context.session.username;

  try {
    const env = getEnv();

    // Ensure audit database exists
    await ensureAuditDatabase(env.COUCHDB_URL, env, username);

    // Get audit service and log the action
    const auditService = getAuditService(env.COUCHDB_URL, env, username);
    await auditService.logAction({
      action: options.action,
      entityId: options.entityId,
      source: 'mcp',
      before: options.before,
      after: options.after,
      metadata: options.metadata,
    });

    context.log.debug('Audit logged', {
      action: options.action,
      entityId: options.entityId,
    });
  } catch (error) {
    // Log error but don't fail the operation
    context.log.warn('Failed to log audit entry', {
      error: error instanceof Error ? error.message : String(error),
      action: options.action,
      entityId: options.entityId,
    });
  }
}
