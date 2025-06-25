import type { TodoAlpha3 } from '@eddo/shared';

// Note: This file now re-exports the enhanced MCP adapter for backward compatibility
// The old @modelcontextprotocol/sdk implementation has been replaced with @langchain/mcp-adapters
import { getEnhancedMCPAdapter } from './adapter.js';

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: object;
}

export interface CreateTodoParams extends Record<string, unknown> {
  title: string;
  description?: string;
  context?: string;
  due?: string;
  tags?: string[];
  repeat?: number | null;
  link?: string | null;
}

export interface ListTodosParams extends Record<string, unknown> {
  context?: string;
  completed?: boolean;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}

export interface UpdateTodoParams extends Record<string, unknown> {
  id: string;
  title?: string;
  description?: string;
  context?: string;
  due?: string;
  tags?: string[];
  repeat?: number | null;
  link?: string | null;
}

export interface MCPClient {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  isClientConnected: () => boolean;
  listTools: () => Promise<MCPTool[]>;
  createTodo: (params: CreateTodoParams) => Promise<string>;
  listTodos: (params?: ListTodosParams) => Promise<TodoAlpha3[]>;
  updateTodo: (params: UpdateTodoParams) => Promise<string>;
  toggleTodoCompletion: (id: string, completed: boolean) => Promise<string>;
  deleteTodo: (id: string) => Promise<string>;
  startTimeTracking: (id: string) => Promise<string>;
  stopTimeTracking: (id: string) => Promise<string>;
  getActiveTimeTracking: () => Promise<TodoAlpha3[]>;
  getServerInfo: (
    section?: 'overview' | 'datamodel' | 'tools' | 'examples' | 'all',
  ) => Promise<string>;
  getActionRegistry?: () => unknown | null;
}

/**
 * Creates an MCP client instance (now using enhanced adapter)
 * @deprecated Use getEnhancedMCPAdapter directly
 */
export function createMCPClient(): MCPClient {
  return getEnhancedMCPAdapter();
}

/**
 * Get the singleton MCP client instance (now using enhanced adapter)
 */
export function getMCPClient(): MCPClient {
  return getEnhancedMCPAdapter();
}
