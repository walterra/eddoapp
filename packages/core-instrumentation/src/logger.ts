/**
 * Pino logger factory with OpenTelemetry transport support.
 *
 * Creates loggers that output to:
 * - Console (pretty-printed for development)
 * - File (JSON format for parsing)
 * - OpenTelemetry (if enabled via OTEL_SDK_DISABLED !== 'true')
 */

import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

import pino from 'pino';

/** Logger configuration options */
export interface LoggerConfig {
  /** Service name for log identification */
  serviceName: string;
  /** Log level (trace, debug, info, warn, error, fatal) */
  level?: string;
  /** Directory for log files (optional, disables file logging if not set) */
  logDir?: string;
  /** Prefix for log file name */
  logFilePrefix?: string;
  /** Enable OpenTelemetry transport */
  enableOtel?: boolean;
  /** Enable console output */
  enableConsole?: boolean;
  /** Enable file output */
  enableFile?: boolean;
}

const DEFAULT_LOG_LEVEL = 'info';

/**
 * Generate date stamp for log file names.
 * @returns ISO date string (YYYY-MM-DD)
 */
function getDateStamp(): string {
  return new Date().toISOString().split('T')[0] ?? '1970-01-01';
}

/**
 * Ensure directory exists.
 * @param dir - Directory path to create
 */
function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Build transport targets based on configuration.
 * @param config - Logger configuration
 * @param level - Log level
 * @returns Array of pino transport targets
 */
function buildTransportTargets(config: LoggerConfig, level: string): pino.TransportTargetOptions[] {
  const { logDir, logFilePrefix, enableOtel, enableConsole, enableFile } = config;
  const targets: pino.TransportTargetOptions[] = [];

  if (enableConsole) {
    targets.push({ target: 'pino-pretty', options: { colorize: true }, level });
  }

  if (enableFile && logDir && logFilePrefix) {
    ensureDir(logDir);
    const logFile = join(logDir, `${logFilePrefix}-${getDateStamp()}.log`);
    targets.push({ target: 'pino/file', options: { destination: logFile }, level });
  }

  if (enableOtel) {
    targets.push({ target: 'pino-opentelemetry-transport', options: {}, level });
  }

  // Fallback to console if no targets
  if (targets.length === 0) {
    targets.push({ target: 'pino-pretty', options: { colorize: true }, level });
  }

  return targets;
}

/**
 * Create a configured pino logger instance.
 *
 * @param config - Logger configuration
 * @returns Configured pino logger
 *
 * @example
 * ```typescript
 * import { createLogger } from '@eddo/core-instrumentation';
 *
 * const logger = createLogger({
 *   serviceName: 'web-api',
 *   logDir: './logs',
 *   logFilePrefix: 'api',
 * });
 *
 * logger.info({ userId: '123' }, 'User logged in');
 * ```
 */
export function createLogger(config: LoggerConfig): pino.Logger {
  const level = config.level ?? process.env.LOG_LEVEL ?? DEFAULT_LOG_LEVEL;
  const normalizedConfig: LoggerConfig = {
    ...config,
    enableOtel: config.enableOtel ?? process.env.OTEL_SDK_DISABLED !== 'true',
    enableConsole: config.enableConsole ?? true,
    enableFile: config.enableFile ?? true,
  };

  const targets = buildTransportTargets(normalizedConfig, level);

  return pino({
    name: config.serviceName,
    level,
    transport: { targets },
  });
}

/**
 * Serialize an error object to ECS-compliant fields.
 *
 * Extracts error details into Elastic Common Schema (ECS) format for consistent
 * error logging across the application.
 *
 * @param error - Error object, string, or unknown value to serialize
 * @returns Object with ECS-compliant error fields
 *
 * @example
 * ```typescript
 * import { serializeError } from '@eddo/core-instrumentation';
 *
 * try {
 *   await riskyOperation();
 * } catch (error) {
 *   logger.error(
 *     serializeError(error),
 *     `Operation failed: ${error instanceof Error ? error.message : String(error)}`
 *   );
 * }
 * ```
 */
export function serializeError(error: unknown): Record<string, unknown> {
  if (typeof error === 'string') {
    return { 'error.message': error, 'error.type': 'string' };
  }

  if (!(error instanceof Error)) {
    let errorMessage: string;
    try {
      errorMessage = String(error);
    } catch {
      errorMessage = '[Unstringifiable value]';
    }
    return { 'error.message': errorMessage, 'error.type': typeof error };
  }

  return serializeErrorObject(error);
}

/**
 * Serialize an Error object to ECS fields.
 * @param err - Error object to serialize
 * @returns Object with ECS-compliant error fields
 */
function serializeErrorObject(err: Error): Record<string, unknown> {
  const extendedErr = err as Error & { cause?: unknown; code?: string; errno?: number };

  const result: Record<string, unknown> = {
    'error.message': err.message,
    'error.type': err.name || err.constructor.name,
  };

  if (err.stack) {
    result['error.stack_trace'] = err.stack;
  }

  if (extendedErr.code) {
    result['error.code'] = extendedErr.code;
  }

  if (extendedErr.errno !== undefined) {
    result['error.errno'] = extendedErr.errno;
  }

  if (extendedErr.cause) {
    result['error.cause'] = serializeError(extendedErr.cause);
  }

  return result;
}

/** Re-export pino types for convenience */
export type { Logger } from 'pino';
