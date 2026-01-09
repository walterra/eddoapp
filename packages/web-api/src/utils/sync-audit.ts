/**
 * Audit logging helper for sync operations (GitHub, RSS, Email).
 * Logs todo operations to the user's audit database.
 */
import {
  createEnv,
  ensureAuditDatabase,
  getAuditService,
  type AuditAction,
  type AuditSource,
  type Env,
  type TodoAlpha3,
} from '@eddo/core-server';

/** Lazy-loaded env to avoid issues during test imports */
let envCache: Env | null = null;
function getEnv(): Env {
  if (!envCache) {
    envCache = createEnv();
  }
  return envCache;
}

/** Options for logging a sync audit action */
export interface SyncAuditOptions {
  username: string;
  source: AuditSource;
  action: AuditAction;
  entityId: string;
  before?: Partial<TodoAlpha3>;
  after?: Partial<TodoAlpha3>;
  /** Optional human-readable message describing the action (short, like a git commit message) */
  message?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Log an audit entry for a sync operation.
 * Silently fails if audit logging encounters an error (non-blocking).
 */
export async function logSyncAudit(options: SyncAuditOptions): Promise<void> {
  const { username, source, action, entityId, before, after, message, metadata } = options;

  try {
    const env = getEnv();
    await ensureAuditDatabase(env.COUCHDB_URL, env, username);

    const auditService = getAuditService(env.COUCHDB_URL, env, username);
    await auditService.logAction({
      action,
      entityId,
      source,
      before,
      after,
      message,
      metadata,
    });
  } catch (error) {
    // Log error but don't fail the sync operation
    console.warn('[SyncAudit] Failed to log audit entry:', {
      error: error instanceof Error ? error.message : String(error),
      source,
      action,
      entityId,
    });
  }
}
