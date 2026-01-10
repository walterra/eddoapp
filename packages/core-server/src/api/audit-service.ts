/**
 * Audit service for logging todo operations.
 * Provides a unified interface for logging actions from any source.
 */
import {
  createAuditLogEntry,
  type AuditAction,
  type AuditLogAlpha1,
  type AuditSource,
  type TodoAlpha3,
} from '@eddo/core-shared';

import { type Env } from '../config/env';
import {
  createAuditDatabase,
  ensureAuditDatabase,
  type AuditDatabase,
  type AuditListOptions,
  type AuditListResult,
} from './audit-database';

/** Options for logging an audit action */
export interface LogActionOptions {
  /** Type of action performed */
  action: AuditAction;
  /** ID of the affected todo */
  entityId: string;
  /** Source system that triggered the action */
  source: AuditSource;
  /** Todo state before the action (for update/delete) */
  before?: Partial<TodoAlpha3>;
  /** Todo state after the action (for create/update) */
  after?: Partial<TodoAlpha3>;
  /** Optional human-readable message describing the action (short, like a git commit message) */
  message?: string;
  /** Optional additional metadata */
  metadata?: Record<string, unknown>;
}

/** Audit service instance */
export interface AuditService {
  /** Log an action to the audit database */
  logAction: (options: LogActionOptions) => Promise<AuditLogAlpha1>;
  /** Get recent audit entries */
  getEntries: (options?: AuditListOptions) => Promise<AuditListResult>;
  /** Get audit entries by their document IDs */
  getByIds: (ids: string[]) => Promise<AuditLogAlpha1[]>;
  /** Get the underlying audit database */
  getDatabase: () => AuditDatabase;
}

/** Context for audit service operations */
interface AuditServiceContext {
  auditDb: AuditDatabase;
  username: string;
}

/**
 * Create an audit service for a user
 * @param couchUrl - CouchDB connection URL
 * @param env - Environment configuration
 * @param username - Username to create audit service for
 * @returns Audit service instance
 */
export function createAuditService(couchUrl: string, env: Env, username: string): AuditService {
  const auditDb = createAuditDatabase(couchUrl, env, username);

  const context: AuditServiceContext = {
    auditDb,
    username,
  };

  return {
    logAction: (options) => logAction(context, options),
    getEntries: (options) => context.auditDb.list(options),
    getByIds: (ids) => context.auditDb.getByIds(ids),
    getDatabase: () => auditDb,
  };
}

/**
 * Log an action to the audit database
 */
async function logAction(
  context: AuditServiceContext,
  options: LogActionOptions,
): Promise<AuditLogAlpha1> {
  const entry = createAuditLogEntry({
    action: options.action,
    entityType: 'todo',
    entityId: options.entityId,
    source: options.source,
    before: options.before,
    after: options.after,
    message: options.message,
    metadata: options.metadata,
  });

  return context.auditDb.insert(entry);
}

/**
 * Create and initialize an audit service (ensures database exists)
 * @param couchUrl - CouchDB connection URL
 * @param env - Environment configuration
 * @param username - Username to create audit service for
 * @returns Initialized audit service instance
 */
export async function createAndInitializeAuditService(
  couchUrl: string,
  env: Env,
  username: string,
): Promise<AuditService> {
  await ensureAuditDatabase(couchUrl, env, username);
  return createAuditService(couchUrl, env, username);
}

/** Singleton cache for audit services per user */
const auditServiceCache = new Map<string, AuditService>();

/**
 * Get or create an audit service for a user (cached)
 * @param couchUrl - CouchDB connection URL
 * @param env - Environment configuration
 * @param username - Username to get audit service for
 * @returns Cached or new audit service instance
 */
export function getAuditService(couchUrl: string, env: Env, username: string): AuditService {
  const cacheKey = `${couchUrl}:${username}`;

  if (!auditServiceCache.has(cacheKey)) {
    auditServiceCache.set(cacheKey, createAuditService(couchUrl, env, username));
  }

  return auditServiceCache.get(cacheKey)!;
}

/**
 * Clear the audit service cache (useful for testing)
 */
export function clearAuditServiceCache(): void {
  auditServiceCache.clear();
}
