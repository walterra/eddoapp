import isNil from 'lodash-es/isNil';

import { type TodoAlpha2 } from './todo_alpha2';

type UnknownObject = Record<string, unknown> | { [key: string]: unknown };

/**
 * Represents a note entry attached to a todo.
 * Notes function as a work diary for tracking progress and decisions.
 */
export interface TodoNote {
  /** Unique identifier (UUID) */
  id: string;
  /** Note content (supports markdown) */
  content: string;
  /** ISO timestamp when note was created */
  createdAt: string;
  /** ISO timestamp when note was last edited */
  updatedAt?: string;
}

export interface TodoAlpha3 extends Omit<TodoAlpha2, 'version'> {
  externalId?: string | null;
  link: string | null;
  parentId?: string | null;
  /** Optional array of notes attached to this todo */
  notes?: TodoNote[];
  /**
   * Optional key-value metadata for extensibility.
   * Use namespaced keys by convention: `agent:`, `github:`, `rss:`.
   * Values can be single strings or arrays of strings.
   * Example: { "agent:worktree": "/path/to/.trees/feature-x", "github:labels": ["bug", "priority"] }
   */
  metadata?: Record<string, string | string[]>;
  /**
   * Optional array of audit log entry IDs (ISO timestamps).
   * References entries in the user's audit database (eddo_audit_<username>).
   * Populated automatically after audit writes; eventual consistency.
   */
  auditLog?: string[];
  version: 'alpha3';
}

export function isTodoAlpha3(arg: unknown): arg is TodoAlpha3 {
  return (
    typeof arg === 'object' &&
    !isNil(arg) &&
    'version' in arg &&
    (arg as UnknownObject).version === 'alpha3'
  );
}

export function migrateToAlpha3(arg: TodoAlpha2): TodoAlpha3 {
  return {
    ...arg,
    externalId: null,
    link: null,
    version: 'alpha3',
  };
}
