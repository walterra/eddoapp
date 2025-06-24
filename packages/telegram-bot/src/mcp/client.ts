import type { TodoAlpha3 } from '@eddo/shared';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

import { appConfig } from '../utils/config.js';
import { logger } from '../utils/logger.js';

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
}

/**
 * Creates an MCP client instance for interacting with the Eddo MCP server
 */
export function createMCPClient(): MCPClient {
  let client: Client | null = null;
  let transport: StreamableHTTPClientTransport | null = null;
  let isConnected = false;
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 5;

  const connect = async (): Promise<void> => {
    try {
      logger.info('Connecting to MCP server', {
        url: appConfig.MCP_SERVER_URL,
      });

      // Use StreamableHTTPClientTransport for FastMCP servers
      transport = new StreamableHTTPClientTransport(
        new URL(appConfig.MCP_SERVER_URL),
      );

      client = new Client(
        {
          name: 'telegram-bot',
          version: '1.0.0',
        },
        {
          capabilities: {
            tools: {},
          },
        },
      );

      await client.connect(transport);
      isConnected = true;
      reconnectAttempts = 0;

      logger.info('Connected to MCP server successfully');

      // List available tools
      const tools = await listTools();
      logger.info('Available MCP tools', { tools: tools.map((t) => t.name) });
    } catch (error) {
      logger.error('Failed to connect to MCP server', { error });
      isConnected = false;
      throw error;
    }
  };

  const disconnect = async (): Promise<void> => {
    try {
      if (client) {
        await client.close();
      }
      if (transport) {
        await transport.close();
      }
      isConnected = false;
      logger.info('Disconnected from MCP server');
    } catch (error) {
      logger.error('Error during MCP disconnect', { error });
    }
  };

  const isClientConnected = (): boolean => {
    return isConnected && client !== null;
  };

  const attemptReconnect = async (): Promise<void> => {
    if (reconnectAttempts >= maxReconnectAttempts) {
      logger.error('Max reconnection attempts reached');
      return;
    }

    reconnectAttempts++;
    const delay = Math.pow(2, reconnectAttempts) * 1000; // Exponential backoff

    logger.info('Attempting to reconnect to MCP server', {
      attempt: reconnectAttempts,
      delay,
    });

    setTimeout(async () => {
      try {
        await connect();
      } catch (error) {
        logger.error('Reconnection attempt failed', { error });
        await attemptReconnect();
      }
    }, delay);
  };

  const callTool = async (
    name: string,
    arguments_: Record<string, unknown>,
  ): Promise<string> => {
    const requestId = Math.random().toString(36).substring(2, 15);
    const startTime = Date.now();

    // Log the start of each MCP request
    logger.info('MCP request started', {
      requestId,
      tool: name,
      arguments: arguments_,
      timestamp: new Date().toISOString(),
    });

    if (!isClientConnected()) {
      logger.warn('MCP client not connected, attempting reconnection', {
        requestId,
        tool: name,
      });
      await attemptReconnect();
      throw new Error('MCP server not available');
    }

    try {
      logger.debug('Calling MCP tool', {
        requestId,
        name,
        arguments: arguments_,
      });

      const response = await client!.callTool({
        name,
        arguments: arguments_,
      });

      const duration = Date.now() - startTime;

      if (response.isError) {
        const errorContent = Array.isArray(response.content)
          ? response.content[0]
          : response.content;
        const errorText =
          errorContent &&
          typeof errorContent === 'object' &&
          'text' in errorContent
            ? String(errorContent.text)
            : 'Unknown error';

        // Log the error response
        logger.error('MCP request failed with server error', {
          requestId,
          tool: name,
          arguments: arguments_,
          duration,
          error: errorText,
          timestamp: new Date().toISOString(),
        });

        throw new Error(`MCP tool error: ${errorText}`);
      }

      const content = Array.isArray(response.content)
        ? response.content[0]
        : response.content;
      const result =
        content && typeof content === 'object' && 'text' in content
          ? String(content.text)
          : '';

      // Log successful completion
      logger.info('MCP request completed successfully', {
        requestId,
        tool: name,
        arguments: arguments_,
        duration,
        resultLength: result.length,
        resultPreview: result.substring(0, 200),
        timestamp: new Date().toISOString(),
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Log the error
      logger.error('MCP request failed with client error', {
        requestId,
        tool: name,
        arguments: arguments_,
        duration,
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString(),
      });

      // Try to reconnect on connection errors
      if (error instanceof Error && error.message.includes('connection')) {
        isConnected = false;
        await attemptReconnect();
      }

      throw error;
    }
  };

  const listTools = async (): Promise<MCPTool[]> => {
    if (!isClientConnected()) {
      throw new Error('MCP client not connected');
    }

    try {
      const response = await client!.listTools();
      return response.tools.map((tool) => ({
        name: tool.name,
        description: tool.description || '',
        inputSchema: tool.inputSchema,
      }));
    } catch (error) {
      logger.error('Failed to list MCP tools', { error });
      throw error;
    }
  };

  const createTodo = async (params: CreateTodoParams): Promise<string> => {
    return callTool('createTodo', params);
  };

  const listTodos = async (
    params: ListTodosParams = {},
  ): Promise<TodoAlpha3[]> => {
    const result = await callTool('listTodos', params);
    try {
      return JSON.parse(result);
    } catch (error) {
      logger.error('Failed to parse listTodos response', { error, result });
      throw new Error('Invalid response format from MCP server');
    }
  };

  const updateTodo = async (params: UpdateTodoParams): Promise<string> => {
    return callTool('updateTodo', params);
  };

  const toggleTodoCompletion = async (
    id: string,
    completed: boolean,
  ): Promise<string> => {
    return callTool('toggleTodoCompletion', { id, completed });
  };

  const deleteTodo = async (id: string): Promise<string> => {
    return callTool('deleteTodo', { id });
  };

  const startTimeTracking = async (id: string): Promise<string> => {
    return callTool('startTimeTracking', { id });
  };

  const stopTimeTracking = async (id: string): Promise<string> => {
    return callTool('stopTimeTracking', { id });
  };

  const getActiveTimeTracking = async (): Promise<TodoAlpha3[]> => {
    const result = await callTool('getActiveTimeTracking', {});
    try {
      return JSON.parse(result);
    } catch (error) {
      logger.error('Failed to parse getActiveTimeTracking response', {
        error,
        result,
      });
      throw new Error('Invalid response format from MCP server');
    }
  };

  const getServerInfo = async (
    section: 'overview' | 'datamodel' | 'tools' | 'examples' | 'all' = 'all',
  ): Promise<string> => {
    return callTool('getServerInfo', { section });
  };

  const setupCleanup = (): void => {
    const cleanup = async () => {
      await disconnect();
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('exit', cleanup);
  };

  setupCleanup();

  return {
    connect,
    disconnect,
    isClientConnected,
    listTools,
    createTodo,
    listTodos,
    updateTodo,
    toggleTodoCompletion,
    deleteTodo,
    startTimeTracking,
    stopTimeTracking,
    getActiveTimeTracking,
    getServerInfo,
  };
}

// Singleton instance
let mcpClient: MCPClient | null = null;

/**
 * Get the singleton MCP client instance
 */
export function getMCPClient(): MCPClient {
  if (!mcpClient) {
    mcpClient = createMCPClient();
  }
  return mcpClient;
}
