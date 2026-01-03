/**
 * @eddo/core-instrumentation
 *
 * OpenTelemetry instrumentation utilities for Eddo services.
 * Provides structured logging with Pino and manual span instrumentation.
 *
 * @example
 * ```typescript
 * // For auto-instrumentation, import otel-init FIRST in entry point:
 * import '@eddo/core-instrumentation/otel-init';
 *
 * // Then use the logger and instrumentation utilities:
 * import { createLogger, withSpan, SpanAttributes, serializeError } from '@eddo/core-instrumentation';
 *
 * const logger = createLogger({
 *   serviceName: 'web-api',
 *   logDir: './logs',
 *   logFilePrefix: 'api',
 * });
 *
 * // Log with trace context
 * logger.info({ userId: '123' }, 'User logged in');
 *
 * // Instrument business logic
 * const result = await withSpan('process_request', {
 *   [SpanAttributes.USER_ID]: userId,
 * }, async () => {
 *   return await processRequest();
 * });
 * ```
 */

export { createLogger, serializeError } from './logger.js';
export type { Logger, LoggerConfig } from './logger.js';

export { SpanAttributes, getTracer, withSpan } from './instrumentation.js';
export type { SpanAttributeKey } from './instrumentation.js';
