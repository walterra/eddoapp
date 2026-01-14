/**
 * Shared types for MCP tool handlers
 */
import type { AttachmentDoc, TodoAlpha3 } from '@eddo/core-server';
import type { Context } from 'fastmcp';
import type nano from 'nano';

/**
 * User session for MCP authentication
 * Extends Record<string, unknown> to satisfy FastMCPSessionAuth constraint
 */
export interface UserSession extends Record<string, unknown> {
  userId: string;
  dbName: string;
  attachmentsDbName: string;
  username: string;
}

/**
 * Tool execution context provided by FastMCP
 * Re-exports the Context type from fastmcp with our UserSession
 */
export type ToolContext = Context<UserSession>;

/**
 * Standard response format for tool operations
 */
export interface ToolResponse {
  summary: string;
  data?: unknown;
  error?: string;
  recovery_suggestions?: string[];
  pagination?: {
    count: number;
    limit: number;
    has_more: boolean;
  };
  metadata: {
    execution_time?: string;
    operation: string;
    timestamp: string;
    error_type?: string;
    [key: string]: unknown;
  };
}

/**
 * Database accessor function type
 */
export type GetUserDb = (context: ToolContext) => nano.DocumentScope<TodoAlpha3>;

/**
 * Attachments database accessor function type
 */
export type GetAttachmentsDb = (context: ToolContext) => nano.DocumentScope<AttachmentDoc>;

/**
 * CouchDB nano server instance type
 */
export type CouchServer = nano.ServerScope;
