/**
 * Telemetry React Hooks
 *
 * Provides hooks for instrumenting React components and user actions.
 */

import type { Attributes } from '@opentelemetry/api';
import { SpanStatusCode } from '@opentelemetry/api';
import { useCallback } from 'react';

import { getTracer } from './tracer';
import { getTelemetryUser } from './user_context';

/**
 * Hook that returns a function to wrap async actions with telemetry spans.
 *
 * @example
 * ```typescript
 * const withTelemetry = useTelemetryAction();
 *
 * const handleSave = () => withTelemetry(
 *   'todo.save',
 *   { 'todo.id': todoId },
 *   async () => await saveTodo(todo)
 * );
 * ```
 */
export function useTelemetryAction() {
  return useCallback(
    <T>(name: string, attributes: Attributes, fn: () => Promise<T>): Promise<T> => {
      const tracer = getTracer();
      const user = getTelemetryUser();

      const allAttributes: Attributes = { ...attributes };
      if (user) {
        allAttributes['user.id'] = user.userId;
        allAttributes['user.name'] = user.username;
      }

      return tracer.startActiveSpan(name, { attributes: allAttributes }, async (span) => {
        try {
          const result = await fn();
          span.setStatus({ code: SpanStatusCode.OK });
          return result;
        } catch (error) {
          span.recordException(error instanceof Error ? error : new Error(String(error)));
          span.setStatus({ code: SpanStatusCode.ERROR });
          throw error;
        } finally {
          span.end();
        }
      });
    },
    [],
  );
}

/**
 * Hook that returns a function to record instant UI events as spans.
 * Use for button clicks, navigation, and other synchronous actions.
 *
 * @example
 * ```typescript
 * const recordAction = useRecordAction();
 *
 * const handleClick = () => {
 *   recordAction('button.click', { 'button.name': 'save' });
 *   // ... do stuff
 * };
 * ```
 */
export function useRecordAction() {
  return useCallback((name: string, attributes: Attributes = {}) => {
    const tracer = getTracer();
    const user = getTelemetryUser();

    const allAttributes: Attributes = { ...attributes };
    if (user) {
      allAttributes['user.id'] = user.userId;
      allAttributes['user.name'] = user.username;
    }

    const span = tracer.startSpan(name, { attributes: allAttributes });
    span.setStatus({ code: SpanStatusCode.OK });
    span.end();
  }, []);
}
