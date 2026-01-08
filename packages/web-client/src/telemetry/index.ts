/**
 * Browser Telemetry Module
 *
 * OpenTelemetry-based Real User Monitoring (RUM) for the Eddo web client.
 * Tracks page loads, fetch requests, and custom application spans.
 *
 * @example
 * ```typescript
 * // Initialize at app startup (before React renders)
 * import { initTelemetry } from './telemetry';
 * initTelemetry();
 *
 * // Set user context after login
 * import { setTelemetryUser } from './telemetry';
 * setTelemetryUser(username);
 *
 * // Manual instrumentation
 * import { withSpan } from './telemetry';
 * await withSpan('custom-operation', { 'custom.attr': 'value' }, async (span) => {
 *   // ... do work
 * });
 * ```
 */

export { createTelemetryConfig } from './config';
export type { TelemetryConfig } from './config';
export { useRecordAction, useTelemetryAction } from './hooks';
export { recordSyncEvent, withSpan } from './spans';
export type { SyncStatus } from './spans';
export { getTracer, initTelemetry, shutdownTelemetry } from './tracer';
export { clearTelemetryUser, getTelemetryUser, setTelemetryUser } from './user_context';
