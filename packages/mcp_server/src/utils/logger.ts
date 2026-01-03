/**
 * MCP Server logger using Pino with OpenTelemetry support.
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
} from '@eddo/core-instrumentation';
import { join } from 'path';
import type { Logger } from 'pino';

// Logs directory relative to project root
const LOGS_DIR = join(process.cwd(), 'logs');

const LOG_LEVEL = process.env.LOG_LEVEL ?? 'info';
const NODE_ENV = process.env.NODE_ENV ?? 'development';

const logger: Logger = createPinoLogger({
  serviceName: 'mcp-server',
  level: LOG_LEVEL,
  logDir: LOGS_DIR,
  logFilePrefix: 'mcp-server',
  enableConsole: NODE_ENV !== 'production' || process.env.FORCE_CONSOLE === 'true',
  enableFile: true,
  enableOtel: process.env.OTEL_SDK_DISABLED !== 'true',
});

export { logger, serializeError, SpanAttributes, withSpan };
