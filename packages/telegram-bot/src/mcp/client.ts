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

/**
 * MCP Client for interacting with the Eddo MCP server
 */
export class MCPClient {
  private client: Client | null = null;
  private transport: StreamableHTTPClientTransport | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;

  constructor() {
    this.setupCleanup();
  }

  /**
   * Connect to the MCP server
   */
  async connect(): Promise<void> {
    try {
      logger.info('Connecting to MCP server', {
        url: appConfig.MCP_SERVER_URL,
      });

      // Use StreamableHTTPClientTransport for FastMCP servers
      this.transport = new StreamableHTTPClientTransport(
        new URL(appConfig.MCP_SERVER_URL),
      );

      this.client = new Client(
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

      await this.client.connect(this.transport);
      this.isConnected = true;
      this.reconnectAttempts = 0;

      logger.info('Connected to MCP server successfully');

      // List available tools
      const tools = await this.listTools();
      logger.info('Available MCP tools', { tools: tools.map((t) => t.name) });
    } catch (error) {
      logger.error('Failed to connect to MCP server', { error });
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Disconnect from the MCP server
   */
  async disconnect(): Promise<void> {
    try {
      if (this.client) {
        await this.client.close();
      }
      if (this.transport) {
        await this.transport.close();
      }
      this.isConnected = false;
      logger.info('Disconnected from MCP server');
    } catch (error) {
      logger.error('Error during MCP disconnect', { error });
    }
  }

  /**
   * Check if connected to MCP server
   */
  isClientConnected(): boolean {
    return this.isConnected && this.client !== null;
  }

  /**
   * Auto-reconnect with exponential backoff
   */
  private async attemptReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.pow(2, this.reconnectAttempts) * 1000; // Exponential backoff

    logger.info('Attempting to reconnect to MCP server', {
      attempt: this.reconnectAttempts,
      delay,
    });

    setTimeout(async () => {
      try {
        await this.connect();
      } catch (error) {
        logger.error('Reconnection attempt failed', { error });
        await this.attemptReconnect();
      }
    }, delay);
  }

  /**
   * Execute an MCP tool call with error handling and retry logic
   */
  private async callTool(
    name: string,
    arguments_: Record<string, unknown>,
  ): Promise<string> {
    const requestId = Math.random().toString(36).substring(2, 15);
    const startTime = Date.now();

    // Log the start of each MCP request
    logger.info('MCP request started', {
      requestId,
      tool: name,
      arguments: arguments_,
      timestamp: new Date().toISOString(),
    });

    if (!this.isClientConnected()) {
      logger.warn('MCP client not connected, attempting reconnection', {
        requestId,
        tool: name,
      });
      await this.attemptReconnect();
      throw new Error('MCP server not available');
    }

    try {
      logger.debug('Calling MCP tool', {
        requestId,
        name,
        arguments: arguments_,
      });

      const response = await this.client!.callTool({
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
        this.isConnected = false;
        await this.attemptReconnect();
      }

      throw error;
    }
  }

  /**
   * List available tools
   */
  async listTools(): Promise<MCPTool[]> {
    if (!this.isClientConnected()) {
      throw new Error('MCP client not connected');
    }

    try {
      const response = await this.client!.listTools();
      return response.tools.map((tool) => ({
        name: tool.name,
        description: tool.description || '',
        inputSchema: tool.inputSchema,
      }));
    } catch (error) {
      logger.error('Failed to list MCP tools', { error });
      throw error;
    }
  }

  /**
   * Create a new todo
   */
  async createTodo(params: CreateTodoParams): Promise<string> {
    return this.callTool('createTodo', params);
  }

  /**
   * List todos with optional filters
   */
  async listTodos(params: ListTodosParams = {}): Promise<TodoAlpha3[]> {
    const result = await this.callTool('listTodos', params);
    try {
      return JSON.parse(result);
    } catch (error) {
      logger.error('Failed to parse listTodos response', { error, result });
      throw new Error('Invalid response format from MCP server');
    }
  }

  /**
   * Update an existing todo
   */
  async updateTodo(params: UpdateTodoParams): Promise<string> {
    return this.callTool('updateTodo', params);
  }

  /**
   * Toggle todo completion status
   */
  async toggleTodoCompletion(id: string, completed: boolean): Promise<string> {
    return this.callTool('toggleTodoCompletion', { id, completed });
  }

  /**
   * Delete a todo
   */
  async deleteTodo(id: string): Promise<string> {
    return this.callTool('deleteTodo', { id });
  }

  /**
   * Start time tracking for a todo
   */
  async startTimeTracking(id: string): Promise<string> {
    return this.callTool('startTimeTracking', { id });
  }

  /**
   * Stop time tracking for a todo
   */
  async stopTimeTracking(id: string): Promise<string> {
    return this.callTool('stopTimeTracking', { id });
  }

  /**
   * Get todos with active time tracking
   */
  async getActiveTimeTracking(): Promise<TodoAlpha3[]> {
    const result = await this.callTool('getActiveTimeTracking', {});
    try {
      return JSON.parse(result);
    } catch (error) {
      logger.error('Failed to parse getActiveTimeTracking response', {
        error,
        result,
      });
      throw new Error('Invalid response format from MCP server');
    }
  }

  /**
   * Get server information
   */
  async getServerInfo(
    section: 'overview' | 'datamodel' | 'tools' | 'examples' | 'all' = 'all',
  ): Promise<string> {
    return this.callTool('getServerInfo', { section });
  }

  /**
   * Setup cleanup handlers
   */
  private setupCleanup(): void {
    const cleanup = async () => {
      await this.disconnect();
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('exit', cleanup);
  }
}

// Singleton instance
let mcpClient: MCPClient | null = null;

/**
 * Get the singleton MCP client instance
 */
export function getMCPClient(): MCPClient {
  if (!mcpClient) {
    mcpClient = new MCPClient();
  }
  return mcpClient;
}
