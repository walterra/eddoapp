/**
 * OpenTelemetry Auto-Instrumentation Initialization
 *
 * This module MUST be imported BEFORE any other imports in the application entry point
 * to properly hook into Node.js modules for auto-instrumentation.
 *
 * @example
 * ```typescript
 * // At the very top of your entry point (e.g., index.ts)
 * import '@eddo/core-instrumentation/otel-init';
 *
 * // Then import everything else
 * import { createLogger } from '@eddo/core-instrumentation';
 * import { Hono } from 'hono';
 * // ...
 * ```
 *
 * Environment variables:
 * - OTEL_SDK_DISABLED: Set to 'true' to disable instrumentation
 * - OTEL_SERVICE_NAME: Service name for traces/metrics (required)
 * - OTEL_EXPORTER_OTLP_ENDPOINT: Collector endpoint (default: http://localhost:4318)
 * - OTEL_RESOURCE_ATTRIBUTES: Additional resource attributes
 */

// Only initialize if not disabled
if (process.env.OTEL_SDK_DISABLED !== 'true') {
  // Validate service name is set
  if (!process.env.OTEL_SERVICE_NAME) {
    console.warn('[otel-init] OTEL_SERVICE_NAME not set. Traces will use default service name.');
  }

  // Dynamic import to avoid issues when OTEL is disabled
  // Using require for synchronous loading (necessary for proper hooking)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@elastic/opentelemetry-node');
  } catch (error) {
    console.warn(
      '[otel-init] Failed to load @elastic/opentelemetry-node:',
      error instanceof Error ? error.message : String(error),
    );
  }
}

export {};
