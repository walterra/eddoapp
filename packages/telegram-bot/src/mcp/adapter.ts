import type { TodoAlpha3 } from '@eddo/shared';
import type { Tool } from '@langchain/core/tools';
import type { MultiServerMCPClient } from '@langchain/mcp-adapters';

import { MCP_ACTION_CONFIG } from '../config/mcp-actions.config.js';
import { ActionRegistry } from '../services/action-registry.js';
import { McpToolDiscoveryService } from '../services/mcp-tool-discovery.js';
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
  private discoveryService: McpToolDiscoveryService | null = null;
  private actionRegistry: ActionRegistry | null = null;

  async connect(): Promise<void> {
    try {
      logger.info('Connecting enhanced MCP adapter');
      this.enhancedSetup = await setupEnhancedMCPIntegration();

      // Initialize discovery service and action registry
      this.discoveryService = new McpToolDiscoveryService(
        this.enhancedSetup.client,
      );
      await this.discoveryService.discoverTools(this.enhancedSetup.tools);

      this.actionRegistry = new ActionRegistry(
        this.discoveryService,
        MCP_ACTION_CONFIG.fallbackActions,
      );
      await this.actionRegistry.initialize();

      this.isConnected = true;
      logger.info('Enhanced MCP adapter connected successfully', {
        toolCount: this.enhancedSetup.tools.length,
        actionCount: this.actionRegistry.getAvailableActions().length,
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
      this.discoveryService = null;
      this.actionRegistry = null;
      this.isConnected = false;
      logger.info('Enhanced MCP adapter disconnected');
    } catch (error) {
      logger.error('Error during enhanced MCP adapter disconnect', { error });
    }
  }

  isClientConnected(): boolean {
    return this.isConnected && this.enhancedSetup !== null;
  }

  /**
   * Get the action registry for dynamic action management
   */
  getActionRegistry(): ActionRegistry | null {
    return this.actionRegistry;
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
    return await this.invokeAction('createTodo', params);
  }

  async listTodos(params?: ListTodosParams): Promise<TodoAlpha3[]> {
    const result = await this.invokeAction('listTodos', params || {});

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
    return await this.invokeAction('updateTodo', params);
  }

  async toggleTodoCompletion(id: string, completed: boolean): Promise<string> {
    return await this.invokeAction('toggleTodoCompletion', { id, completed });
  }

  async deleteTodo(id: string): Promise<string> {
    return await this.invokeAction('deleteTodo', { id });
  }

  async startTimeTracking(id: string): Promise<string> {
    return await this.invokeAction('startTimeTracking', { id });
  }

  async stopTimeTracking(id: string): Promise<string> {
    return await this.invokeAction('stopTimeTracking', { id });
  }

  async getActiveTimeTracking(): Promise<TodoAlpha3[]> {
    const result = await this.invokeAction('getActiveTimeTracking', {});

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
    return await this.invokeAction('getServerInfo', { section });
  }

  /**
   * Invoke an action using the ActionRegistry for dynamic resolution
   */
  private async invokeAction(
    actionName: string,
    params: Record<string, unknown>,
  ): Promise<string> {
    if (
      !this.isClientConnected() ||
      !this.enhancedSetup ||
      !this.actionRegistry
    ) {
      throw new Error('Enhanced MCP adapter not connected');
    }

    // Resolve the action name (handles aliases)
    const resolvedActionName =
      this.actionRegistry.resolveActionName(actionName);
    if (!resolvedActionName) {
      throw new Error(`Unknown action: ${actionName}`);
    }

    // Get the tool name for this action
    const toolName =
      this.actionRegistry.getToolNameForAction(resolvedActionName);
    if (!toolName) {
      throw new Error(`No tool mapped for action: ${resolvedActionName}`);
    }

    // Find the tool
    const tool = this.enhancedSetup.tools.find(
      (t: Tool) => t.name === toolName,
    );
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    // Invoke the tool
    return await this.invokeTool(tool, params);
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
