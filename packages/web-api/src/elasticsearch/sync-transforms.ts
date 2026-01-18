/**
 * Document transformation functions for CouchDB to Elasticsearch sync.
 */

import type { AuditLogAlpha1, TodoAlpha3 } from '@eddo/core-shared';

import type { IndexedAuditLog } from './audit-mapping';
import type { DatabaseType } from './sync-types';
import type { IndexedTodo } from './todo-mapping';

/**
 * Determines the database type from its name.
 */
export function getDatabaseType(dbName: string): DatabaseType {
  if (dbName.startsWith('eddo_user_')) return 'user';
  if (dbName.startsWith('eddo_audit_')) return 'audit';
  return 'unknown';
}

/**
 * Extracts user ID from database name.
 */
export function extractUserId(dbName: string): string {
  const userMatch = dbName.match(/^eddo_user_(.+)$/);
  if (userMatch) return userMatch[1];

  const auditMatch = dbName.match(/^eddo_audit_(.+)$/);
  if (auditMatch) return auditMatch[1];

  return dbName;
}

/**
 * Converts a TodoAlpha3 document to an IndexedTodo for Elasticsearch.
 */
export function toIndexedTodo(
  doc: TodoAlpha3 & { _id: string; _rev: string },
  userId: string,
  database: string,
): IndexedTodo {
  return {
    todoId: doc._id,
    todoRev: doc._rev,
    title: doc.title,
    description: doc.description,
    context: doc.context,
    tags: doc.tags,
    due: doc.due,
    completed: doc.completed,
    repeat: doc.repeat,
    active: doc.active,
    externalId: doc.externalId ?? null,
    link: doc.link,
    parentId: doc.parentId ?? null,
    blockedBy: doc.blockedBy,
    auditLog: doc.auditLog,
    version: doc.version,
    notes: doc.notes,
    metadata: doc.metadata,
    userId,
    database,
    syncedAt: new Date().toISOString(),
  };
}

/**
 * Converts an AuditLogAlpha1 document to an IndexedAuditLog for Elasticsearch.
 */
export function toIndexedAuditLog(
  doc: AuditLogAlpha1 & { _id: string; _rev: string },
  userId: string,
  database: string,
): IndexedAuditLog {
  return {
    auditId: doc._id,
    auditRev: doc._rev,
    version: doc.version,
    timestamp: doc.timestamp,
    action: doc.action,
    entityType: doc.entityType,
    entityId: doc.entityId,
    source: doc.source,
    before: doc.before as Record<string, unknown> | undefined,
    after: doc.after as Record<string, unknown> | undefined,
    metadata: doc.metadata,
    userId,
    database,
    syncedAt: new Date().toISOString(),
  };
}
