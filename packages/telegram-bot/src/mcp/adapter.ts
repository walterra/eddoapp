import type { TodoAlpha3 } from '@eddo/shared';
import type { Tool } from '@langchain/core/tools';
import type { MultiServerMCPClient } from '@langchain/mcp-adapters';

import { logger } from '../utils/logger.js';
import type {
  CreateTodoParams,
  ListTodosParams,
  MCPClient,
  MCPTool,
  UpdateTodoParams,
} from './client.js';
import { setupEnhancedMCPIntegration } from './enhanced-client.js';

/**
 * Adapter that implements the old MCPClient interface using the enhanced @langchain/mcp-adapters
 * This allows existing code to work unchanged while using the new adapter underneath
 */
export class EnhancedMCPAdapter implements MCPClient {
  private enhancedSetup: {
    client: MultiServerMCPClient;
    tools: Tool[];
    agent: unknown;
  } | null = null;
  private isConnected = false;

  async connect(): Promise<void> {
    try {
      logger.info('Connecting enhanced MCP adapter');
      this.enhancedSetup = await setupEnhancedMCPIntegration();
      this.isConnected = true;
      logger.info('Enhanced MCP adapter connected successfully', {
        toolCount: this.enhancedSetup.tools.length,
      });
    } catch (error) {
      logger.error('Failed to connect enhanced MCP adapter', { error });
      this.isConnected = false;
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.enhancedSetup?.client) {
        // MultiServerMCPClient doesn't have explicit disconnect, but we'll clean up
        this.enhancedSetup = null;
      }
      this.isConnected = false;
      logger.info('Enhanced MCP adapter disconnected');
    } catch (error) {
      logger.error('Error during enhanced MCP adapter disconnect', { error });
    }
  }

  isClientConnected(): boolean {
    return this.isConnected && this.enhancedSetup !== null;
  }

  async listTools(): Promise<MCPTool[]> {
    if (!this.isClientConnected() || !this.enhancedSetup) {
      throw new Error('Enhanced MCP adapter not connected');
    }

    return this.enhancedSetup.tools.map((tool: Tool) => ({
      name: tool.name,
      description: tool.description || '',
      inputSchema: {}, // LangChain tools don't expose schema the same way
    }));
  }

  async createTodo(params: CreateTodoParams): Promise<string> {
    const tool = this.findTool(['createTodo', 'create', 'addTodo']);
    return await this.invokeTool(tool, params);
  }

  async listTodos(params?: ListTodosParams): Promise<TodoAlpha3[]> {
    const tool = this.findTool(['listTodos', 'list', 'getTodos']);
    const result = await this.invokeTool(tool, params || {});

    try {
      return JSON.parse(result);
    } catch (error) {
      logger.error('Failed to parse listTodos response from enhanced adapter', {
        error,
        result,
      });
      throw new Error('Invalid response format from enhanced MCP adapter');
    }
  }

  async updateTodo(params: UpdateTodoParams): Promise<string> {
    const tool = this.findTool(['updateTodo', 'update', 'editTodo']);
    return await this.invokeTool(tool, params);
  }

  async toggleTodoCompletion(id: string, completed: boolean): Promise<string> {
    const tool = this.findTool([
      'toggleTodoCompletion',
      'toggle',
      'toggleCompletion',
      'complete',
    ]);
    return await this.invokeTool(tool, { id, completed });
  }

  async deleteTodo(id: string): Promise<string> {
    const tool = this.findTool(['deleteTodo', 'delete', 'removeTodo']);
    return await this.invokeTool(tool, { id });
  }

  async startTimeTracking(id: string): Promise<string> {
    const tool = this.findTool([
      'startTimeTracking',
      'startTimer',
      'startTracking',
      'startTime',
    ]);
    return await this.invokeTool(tool, { id });
  }

  async stopTimeTracking(id: string): Promise<string> {
    const tool = this.findTool([
      'stopTimeTracking',
      'stopTimer',
      'stopTracking',
      'stopTime',
    ]);
    return await this.invokeTool(tool, { id });
  }

  async getActiveTimeTracking(): Promise<TodoAlpha3[]> {
    const tool = this.findTool([
      'getActiveTimeTracking',
      'getTimers',
      'activeTimers',
      'listTimers',
    ]);
    const result = await this.invokeTool(tool, {});

    try {
      return JSON.parse(result);
    } catch (error) {
      logger.error(
        'Failed to parse getActiveTimeTracking response from enhanced adapter',
        { error, result },
      );
      throw new Error('Invalid response format from enhanced MCP adapter');
    }
  }

  async getServerInfo(
    section: 'overview' | 'datamodel' | 'tools' | 'examples' | 'all' = 'all',
  ): Promise<string> {
    const tool = this.findTool(['getServerInfo', 'info', 'documentation']);
    return await this.invokeTool(tool, { section });
  }

  /**
   * Find tool by trying multiple possible names
   */
  private findTool(possibleNames: string[]): Tool {
    if (!this.isClientConnected() || !this.enhancedSetup) {
      throw new Error('Enhanced MCP adapter not connected');
    }

    for (const name of possibleNames) {
      // Try exact match first
      let tool = this.enhancedSetup.tools.find(
        (t: Tool) => t.name === name || t.name.endsWith(`_${name}`),
      );

      if (tool) return tool;

      // Try fuzzy match
      tool = this.enhancedSetup.tools.find(
        (t: Tool) =>
          t.name.toLowerCase().includes(name.toLowerCase()) ||
          t.description?.toLowerCase().includes(name.toLowerCase()),
      );

      if (tool) return tool;
    }

    throw new Error(
      `Tool not found for any of: ${possibleNames.join(', ')}. Available tools: ${this.enhancedSetup?.tools.map((t: Tool) => t.name).join(', ') || 'none'}`,
    );
  }

  /**
   * Invoke a tool and return the result as a string
   */
  private async invokeTool(
    tool: Tool,
    params: Record<string, unknown>,
  ): Promise<string> {
    try {
      const result = await tool.invoke(params);

      // Handle different result formats from LangChain tools
      if (typeof result === 'string') {
        return result;
      } else if (result && typeof result === 'object') {
        if ('content' in result) {
          return String(result.content);
        } else {
          return JSON.stringify(result);
        }
      } else {
        return String(result);
      }
    } catch (error) {
      logger.error('Enhanced MCP adapter tool invocation failed', {
        toolName: tool.name,
        params,
        error,
      });
      throw error;
    }
  }
}

// Singleton instance
let enhancedAdapter: EnhancedMCPAdapter | null = null;

/**
 * Get the singleton enhanced MCP adapter instance
 */
export function getEnhancedMCPAdapter(): MCPClient {
  if (!enhancedAdapter) {
    enhancedAdapter = new EnhancedMCPAdapter();
  }
  return enhancedAdapter;
}
