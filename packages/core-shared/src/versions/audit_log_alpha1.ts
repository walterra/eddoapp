import isNil from 'lodash-es/isNil';

import { type TodoAlpha3 } from './todo_alpha3';

type UnknownObject = Record<string, unknown> | { [key: string]: unknown };

/** Audit action types for todo operations */
export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'complete'
  | 'uncomplete'
  | 'time_tracking_start'
  | 'time_tracking_stop';

/** Source of the audit action */
export type AuditSource = 'web' | 'mcp' | 'telegram' | 'github-sync' | 'rss-sync' | 'email-sync';

/** Entity types that can be audited */
export type AuditEntityType = 'todo';

/**
 * Audit log entry for tracking todo operations.
 * Stored in per-user database: eddo_audit_<username>
 */
export interface AuditLogAlpha1 {
  /** ISO timestamp of action (serves as unique ID) */
  _id: string;
  /** CouchDB revision */
  _rev?: string;
  /** Schema version */
  version: 'audit_alpha1';
  /** Type of action performed */
  action: AuditAction;
  /** Type of entity affected */
  entityType: AuditEntityType;
  /** ID of the affected entity (todo _id) */
  entityId: string;
  /** ISO timestamp of action (same as _id) */
  timestamp: string;
  /** Entity state before the action (for update/delete) */
  before?: Partial<TodoAlpha3>;
  /** Entity state after the action (for create/update) */
  after?: Partial<TodoAlpha3>;
  /** Source system that triggered the action */
  source: AuditSource;
  /** Optional human-readable message describing the action (short, like a git commit message) */
  message?: string;
  /** Optional metadata for additional context */
  metadata?: Record<string, unknown>;
}

/**
 * Type guard to check if an object is an AuditLogAlpha1 entry
 * @param arg - Object to check
 * @returns True if the object is an AuditLogAlpha1 entry
 */
export function isAuditLogAlpha1(arg: unknown): arg is AuditLogAlpha1 {
  return (
    typeof arg === 'object' &&
    !isNil(arg) &&
    'version' in arg &&
    (arg as UnknownObject).version === 'audit_alpha1'
  );
}

/** Input for creating a new audit log entry (without _id and _rev) */
export type NewAuditLogEntry = Omit<AuditLogAlpha1, '_id' | '_rev' | 'timestamp' | 'version'>;

/**
 * Creates an audit log entry with auto-generated ID and timestamp
 * @param entry - Audit entry data without ID/timestamp
 * @returns Complete AuditLogAlpha1 entry ready for storage
 */
export function createAuditLogEntry(entry: NewAuditLogEntry): Omit<AuditLogAlpha1, '_rev'> {
  const now = new Date().toISOString();
  return {
    _id: now,
    version: 'audit_alpha1',
    timestamp: now,
    ...entry,
  };
}
