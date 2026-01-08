/**
 * Custom Span Helpers for Telemetry
 *
 * Provides convenience functions for creating spans around common operations.
 */

import type { Attributes, Span } from '@opentelemetry/api';
import { SpanStatusCode } from '@opentelemetry/api';

import { getTracer } from './tracer';
import { addUserToActiveSpan, getTelemetryUser } from './user_context';

/**
 * Executes a function within a custom span.
 *
 * Automatically handles:
 * - Span creation with user context
 * - Error recording
 * - Span ending
 *
 * @param name - Span name
 * @param attributes - Span attributes
 * @param fn - Function to execute
 * @returns Result of the function
 */
export function withSpan<T>(name: string, attributes: Attributes, fn: (span: Span) => T): T {
  const tracer = getTracer();
  const user = getTelemetryUser();

  // Add user attributes if available
  const allAttributes: Attributes = { ...attributes };
  if (user) {
    allAttributes['user.id'] = user.userId;
    allAttributes['user.name'] = user.username;
  }

  return tracer.startActiveSpan(name, { attributes: allAttributes }, (span) => {
    try {
      const result = fn(span);

      if (result instanceof Promise) {
        return result
          .then((value: unknown) => {
            span.setStatus({ code: SpanStatusCode.OK });
            return value;
          })
          .catch((error: unknown) => {
            span.recordException(error instanceof Error ? error : new Error(String(error)));
            span.setStatus({ code: SpanStatusCode.ERROR });
            throw error;
          })
          .finally(() => {
            span.end();
          }) as T;
      }

      span.setStatus({ code: SpanStatusCode.OK });
      span.end();
      return result;
    } catch (error) {
      span.recordException(error instanceof Error ? error : new Error(String(error)));
      span.setStatus({ code: SpanStatusCode.ERROR });
      span.end();
      throw error;
    }
  });
}

/** PouchDB sync status for telemetry */
export type SyncStatus = 'started' | 'active' | 'paused' | 'complete' | 'error' | 'cancelled';

/**
 * Records a PouchDB sync event as a span event on the active span.
 * @param status - Sync status
 * @param details - Optional details
 */
export function recordSyncEvent(status: SyncStatus, details?: Record<string, unknown>): void {
  addUserToActiveSpan();

  const tracer = getTracer();
  const span = tracer.startSpan(`pouchdb.sync.${status}`, {
    attributes: {
      'db.system': 'pouchdb',
      'db.operation': 'sync',
      'sync.status': status,
      ...details,
    },
  });

  span.end();
}
