/**
 * Telegram bot logger using Pino with OpenTelemetry support.
 *
 * Provides a Winston-compatible API (message first, then meta object)
 * while using Pino under the hood.
 *
 * Outputs to:
 * - Console (pretty-printed in development)
 * - File (JSON format in logs directory)
 * - OpenTelemetry (when OTEL_SDK_DISABLED !== 'true')
 */

import {
  createLogger as createPinoLogger,
  serializeError,
  SpanAttributes,
  withSpan,
  type Logger as PinoLogger,
} from '@eddo/core-instrumentation';
import { join } from 'path';

import { appConfig } from './config.js';

// Logs directory relative to project root
const LOGS_DIR = join(process.cwd(), 'logs');

const pinoLogger = createPinoLogger({
  serviceName: 'telegram-bot',
  level: appConfig.LOG_LEVEL,
  logDir: LOGS_DIR,
  logFilePrefix: 'telegram-bot',
  enableConsole: appConfig.NODE_ENV !== 'production' || process.env.FORCE_CONSOLE === 'true',
  enableFile: true,
  enableOtel: process.env.OTEL_SDK_DISABLED !== 'true',
});

/**
 * Winston-compatible logger interface.
 * Accepts (message, meta?) format and converts to Pino's (meta, message) format.
 */
interface WinstonCompatibleLogger {
  trace: (message: string, meta?: Record<string, unknown>) => void;
  debug: (message: string, meta?: Record<string, unknown>) => void;
  info: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, meta?: Record<string, unknown>) => void;
  fatal: (message: string, meta?: Record<string, unknown>) => void;
  child: (bindings: Record<string, unknown>) => WinstonCompatibleLogger;
  /** Access to underlying Pino logger for advanced use cases */
  pino: PinoLogger;
}

/**
 * Create a Winston-compatible wrapper around a Pino logger.
 * @param pino - Pino logger instance
 * @returns Winston-compatible logger
 */
function createWinstonWrapper(pino: PinoLogger): WinstonCompatibleLogger {
  return {
    trace: (message: string, meta?: Record<string, unknown>) => {
      pino.trace(meta ?? {}, message);
    },
    debug: (message: string, meta?: Record<string, unknown>) => {
      pino.debug(meta ?? {}, message);
    },
    info: (message: string, meta?: Record<string, unknown>) => {
      pino.info(meta ?? {}, message);
    },
    warn: (message: string, meta?: Record<string, unknown>) => {
      pino.warn(meta ?? {}, message);
    },
    error: (message: string, meta?: Record<string, unknown>) => {
      pino.error(meta ?? {}, message);
    },
    fatal: (message: string, meta?: Record<string, unknown>) => {
      pino.fatal(meta ?? {}, message);
    },
    child: (bindings: Record<string, unknown>) => {
      return createWinstonWrapper(pino.child(bindings));
    },
    pino,
  };
}

const logger = createWinstonWrapper(pinoLogger);

export { logger, serializeError, SpanAttributes, withSpan };
export type { WinstonCompatibleLogger };
