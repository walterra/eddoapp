/**
 * Hook for logging audit entries from web client mutations.
 * Calls the audit log API after successful todo operations.
 */
import { useCallback } from 'react';

import type { Todo } from '@eddo/core-shared';

import { useAuth } from './use_auth';

/** Audit action types */
export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'complete'
  | 'uncomplete'
  | 'time_tracking_start'
  | 'time_tracking_stop';

/** Options for logging an audit entry */
export interface LogAuditOptions {
  action: AuditAction;
  entityId: string;
  before?: Partial<Todo>;
  after?: Partial<Todo>;
  metadata?: Record<string, unknown>;
}

/** Audit log API response */
interface AuditLogResponse {
  success: boolean;
  entry?: {
    _id: string;
    action: AuditAction;
    entityId: string;
    timestamp: string;
  };
  error?: string;
}

/**
 * Hook for logging audit entries.
 * Returns a function to log audit entries to the server.
 */
export function useAuditLog() {
  const { authToken } = useAuth();

  const logAudit = useCallback(
    async (options: LogAuditOptions): Promise<void> => {
      if (!authToken?.token) {
        console.warn('[AuditLog] No auth token, skipping audit log');
        return;
      }

      try {
        const response = await fetch('/api/audit-log', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken.token}`,
          },
          body: JSON.stringify({
            action: options.action,
            entityId: options.entityId,
            before: options.before,
            after: options.after,
            metadata: options.metadata,
          }),
        });

        if (!response.ok) {
          const data = (await response.json()) as AuditLogResponse;
          console.error('[AuditLog] Failed to log audit entry:', data.error);
        }
      } catch (error) {
        // Don't throw - audit logging should not break the main operation
        console.error('[AuditLog] Error logging audit entry:', error);
      }
    },
    [authToken?.token],
  );

  return { logAudit };
}

/** Check if completion status changed */
function checkCompletionChange(before: Todo, after: Todo): AuditAction | null {
  const wasCompleted = before.completed !== null;
  const isCompleted = after.completed !== null;

  if (!wasCompleted && isCompleted) return 'complete';
  if (wasCompleted && !isCompleted) return 'uncomplete';
  return null;
}

/** Check if time tracking status changed */
function checkTimeTrackingChange(before: Todo, after: Todo): AuditAction | null {
  const beforeActiveKeys = Object.keys(before.active || {});
  const afterActiveKeys = Object.keys(after.active || {});

  // New time tracking session started
  if (afterActiveKeys.length > beforeActiveKeys.length) {
    const newKey = afterActiveKeys.find((k) => !beforeActiveKeys.includes(k));
    if (newKey && after.active[newKey] === null) {
      return 'time_tracking_start';
    }
  }

  // Time tracking session stopped
  for (const key of afterActiveKeys) {
    if (before.active[key] === null && after.active[key] !== null) {
      return 'time_tracking_stop';
    }
  }

  return null;
}

/**
 * Determine the appropriate audit action for a todo state change
 */
export function determineAuditAction(
  before: Todo | undefined,
  after: Todo | undefined,
): AuditAction | null {
  if (before && !after) return 'delete';
  if (!before && after) return 'create';

  if (before && after) {
    const completionAction = checkCompletionChange(before, after);
    if (completionAction) return completionAction;

    const timeTrackingAction = checkTimeTrackingChange(before, after);
    if (timeTrackingAction) return timeTrackingAction;

    return 'update';
  }

  return null;
}
