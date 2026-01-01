/**
 * Helper functions for creating standardized tool responses
 */
import type { ToolResponse } from './types.js';

/**
 * Options for creating a success response
 */
interface SuccessResponseOptions {
  summary: string;
  data: unknown;
  operation: string;
  executionTime: number;
  extra?: Partial<ToolResponse>;
}

/**
 * Creates a success response with standard metadata
 */
export function createSuccessResponse(options: SuccessResponseOptions): string {
  const { summary, data, operation, executionTime, extra } = options;
  const response: ToolResponse = {
    summary,
    data,
    metadata: {
      execution_time: `${executionTime.toFixed(2)}ms`,
      operation,
      timestamp: new Date().toISOString(),
    },
    ...extra,
  };
  return JSON.stringify(response);
}

/**
 * Options for creating an error response
 */
interface ErrorResponseOptions {
  summary: string;
  error: unknown;
  operation: string;
  recoverySuggestions: string[];
  errorType?: string;
}

/**
 * Creates an error response with recovery suggestions
 */
export function createErrorResponse(options: ErrorResponseOptions): string {
  const { summary, error, operation, recoverySuggestions, errorType } = options;
  const message = error instanceof Error ? error.message : String(error);
  const response: ToolResponse = {
    summary,
    error: message,
    recovery_suggestions: recoverySuggestions,
    metadata: {
      operation,
      timestamp: new Date().toISOString(),
      error_type: errorType ?? (message.includes('not found') ? 'not_found' : 'database_error'),
    },
  };
  return JSON.stringify(response);
}

/**
 * Creates an empty result response for non-existent databases
 */
export function createEmptyDatabaseResponse(operation: string, limit: number): string {
  const response: ToolResponse = {
    summary: 'No todos found - database not initialized',
    data: [],
    pagination: {
      count: 0,
      limit,
      has_more: false,
    },
    metadata: {
      operation,
      timestamp: new Date().toISOString(),
      database_status: 'not_initialized',
    },
  };
  return JSON.stringify(response);
}
