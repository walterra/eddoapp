/**
 * OpenTelemetry Manual Instrumentation Utilities
 *
 * Provides helpers for creating custom spans to track business logic performance.
 * Works alongside auto-instrumentation from @elastic/opentelemetry-node.
 *
 * @example
 * ```typescript
 * import { withSpan, SpanAttributes } from '@eddo/core-instrumentation';
 *
 * // Synchronous operation
 * const result = withSpan('process_request', { [SpanAttributes.USER_ID]: userId }, () => {
 *   return processRequest(request);
 * });
 *
 * // Asynchronous operation
 * const data = await withSpan('fetch_todos', { [SpanAttributes.CONTEXT]: 'work' }, async () => {
 *   return await db.getTodos();
 * });
 * ```
 */

import type { Attributes, Span } from '@opentelemetry/api';
import { SpanStatusCode, trace } from '@opentelemetry/api';

/** Default tracer name for Eddo services */
const DEFAULT_TRACER_NAME = 'eddo';

/**
 * Get a tracer instance for the given service.
 * @param serviceName - Service name (defaults to 'eddo')
 * @returns OpenTelemetry tracer
 */
export function getTracer(serviceName: string = DEFAULT_TRACER_NAME) {
  return trace.getTracer(serviceName);
}

/**
 * Execute a function within a custom span.
 *
 * Automatically handles:
 * - Span creation and activation
 * - Error recording (sets span status to ERROR and records exception)
 * - Span ending (always, even on exception)
 *
 * @param operationName - Name of the span (e.g., 'process_request', 'sync_github')
 * @param attributes - Span attributes following OpenTelemetry semantic conventions
 * @param fn - Function to execute within the span (sync or async)
 * @param tracerName - Optional tracer name (defaults to service name from env)
 * @returns Result of the function
 *
 * @throws Re-throws any exception from the function after recording it in the span
 */
export function withSpan<T>(
  operationName: string,
  attributes: Attributes,
  fn: (span: Span) => T,
  tracerName?: string,
): T {
  const tracer = getTracer(tracerName ?? process.env.OTEL_SERVICE_NAME ?? DEFAULT_TRACER_NAME);

  return tracer.startActiveSpan(operationName, { attributes }, (span) => {
    try {
      const result = fn(span);

      // Handle async functions
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

      // Synchronous success
      span.setStatus({ code: SpanStatusCode.OK });
      span.end();
      return result;
    } catch (error) {
      // Synchronous error
      span.recordException(error instanceof Error ? error : new Error(String(error)));
      span.setStatus({ code: SpanStatusCode.ERROR });
      span.end();
      throw error;
    }
  });
}

/**
 * Common span attribute names for Eddo services.
 *
 * Follows OpenTelemetry semantic conventions where applicable.
 * Custom attributes use domain-specific naming.
 *
 * @see https://opentelemetry.io/docs/specs/semconv/
 */
export const SpanAttributes = {
  // User/Auth attributes
  USER_ID: 'user.id',
  USERNAME: 'user.name',

  // Todo attributes
  TODO_ID: 'todo.id',
  TODO_TITLE: 'todo.title',
  TODO_CONTEXT: 'todo.context',
  TODO_COUNT: 'todo.count',

  // MCP attributes
  MCP_TOOL: 'mcp.tool',
  MCP_OPERATION: 'mcp.operation',

  // GitHub sync attributes
  GITHUB_REPO: 'github.repo',
  GITHUB_ISSUE_ID: 'github.issue.id',
  GITHUB_ISSUES_COUNT: 'github.issues.count',

  // Telegram bot attributes
  TELEGRAM_CHAT_ID: 'telegram.chat.id',
  TELEGRAM_MESSAGE_ID: 'telegram.message.id',

  // Agent attributes
  AGENT_ITERATION: 'agent.iteration',
  AGENT_TOOL_CALLS: 'agent.tool_calls',

  // Database attributes
  DB_NAME: 'db.name',
  DB_OPERATION: 'db.operation',
  DOCUMENTS_COUNT: 'documents.count',

  // HTTP attributes (standard OTel)
  HTTP_METHOD: 'http.method',
  HTTP_STATUS_CODE: 'http.status_code',
  HTTP_URL: 'http.url',
  HTTP_ROUTE: 'http.route',

  // Generic attributes
  OPERATION: 'operation',
  ERROR: 'error',
  ERROR_TYPE: 'error.type',
} as const;

/** Type for span attribute keys */
export type SpanAttributeKey = (typeof SpanAttributes)[keyof typeof SpanAttributes];
