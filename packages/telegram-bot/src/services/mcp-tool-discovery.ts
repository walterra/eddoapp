import type { Tool } from '@langchain/core/tools';
import type { MultiServerMCPClient } from '@langchain/mcp-adapters';

import { logger } from '../utils/logger.js';

/**
 * Represents an MCP tool with its metadata
 */
export interface McpTool {
  name: string;
  description: string;
  inputSchema?: object;
  category?: string;
  server?: string;
}

/**
 * Service for discovering and managing MCP tools dynamically
 */
export class McpToolDiscoveryService {
  private cachedTools: Map<string, McpTool> = new Map();
  private toolsByServer: Map<string, McpTool[]> = new Map();
  private lastDiscoveryTime: Date | null = null;
  private discoveryIntervalMs = 5 * 60 * 1000; // 5 minutes cache

  constructor(private readonly client: MultiServerMCPClient | null = null) {}

  /**
   * Discover all available tools from MCP servers
   */
  async discoverTools(tools: Tool[]): Promise<McpTool[]> {
    try {
      logger.info('Starting MCP tool discovery', { toolCount: tools.length });

      // Clear existing cache
      this.cachedTools.clear();
      this.toolsByServer.clear();

      // Process each tool
      const mcpTools: McpTool[] = tools.map((tool) => {
        const mcpTool: McpTool = {
          name: tool.name,
          description: tool.description || '',
          inputSchema: tool.schema,
          category: this.categorizeToolByName(tool.name),
          server: this.extractServerFromToolName(tool.name),
        };

        // Cache the tool
        this.cachedTools.set(tool.name, mcpTool);

        // Group by server
        const serverName = mcpTool.server || 'unknown';
        if (!this.toolsByServer.has(serverName)) {
          this.toolsByServer.set(serverName, []);
        }
        this.toolsByServer.get(serverName)!.push(mcpTool);

        return mcpTool;
      });

      this.lastDiscoveryTime = new Date();
      logger.info('MCP tool discovery completed', {
        totalTools: mcpTools.length,
        servers: Array.from(this.toolsByServer.keys()),
      });

      return mcpTools;
    } catch (error) {
      logger.error('Failed to discover MCP tools', { error });
      throw error;
    }
  }

  /**
   * Get a tool by its exact name
   */
  async getToolByName(name: string): Promise<McpTool | undefined> {
    return this.cachedTools.get(name);
  }

  /**
   * Find a tool by checking multiple name variants
   */
  async findToolByVariants(variants: string[]): Promise<McpTool | undefined> {
    for (const variant of variants) {
      const tool = this.cachedTools.get(variant);
      if (tool) {
        logger.debug('Found tool by variant', { variant, toolName: tool.name });
        return tool;
      }
    }
    return undefined;
  }

  /**
   * Get all discovered tools
   */
  getAvailableTools(): McpTool[] {
    return Array.from(this.cachedTools.values());
  }

  /**
   * Get tools by server
   */
  getToolsByServer(serverName: string): McpTool[] {
    return this.toolsByServer.get(serverName) || [];
  }

  /**
   * Get tools by category
   */
  getToolsByCategory(category: string): McpTool[] {
    return Array.from(this.cachedTools.values()).filter(
      (tool) => tool.category === category,
    );
  }

  /**
   * Check if discovery cache is still valid
   */
  isCacheValid(): boolean {
    if (!this.lastDiscoveryTime) return false;
    const now = new Date();
    const timeSinceDiscovery = now.getTime() - this.lastDiscoveryTime.getTime();
    return timeSinceDiscovery < this.discoveryIntervalMs;
  }

  /**
   * Clear the tool cache
   */
  clearCache(): void {
    this.cachedTools.clear();
    this.toolsByServer.clear();
    this.lastDiscoveryTime = null;
  }

  /**
   * Categorize a tool based on its name
   */
  private categorizeToolByName(toolName: string): string {
    const name = toolName.toLowerCase();

    if (name.includes('todo') || name.includes('task')) {
      return 'todo_management';
    }
    if (
      name.includes('time') ||
      name.includes('track') ||
      name.includes('timer')
    ) {
      return 'time_tracking';
    }
    if (name.includes('calendar') || name.includes('event')) {
      return 'calendar';
    }
    if (
      name.includes('file') ||
      name.includes('read') ||
      name.includes('write')
    ) {
      return 'file_operations';
    }
    if (
      name.includes('analyze') ||
      name.includes('summary') ||
      name.includes('report')
    ) {
      return 'analysis';
    }
    if (name.includes('notify') || name.includes('alert')) {
      return 'notifications';
    }
    if (
      name.includes('github') ||
      name.includes('slack') ||
      name.includes('notion')
    ) {
      return 'integration';
    }

    return 'utility';
  }

  /**
   * Extract server name from prefixed tool name
   */
  private extractServerFromToolName(toolName: string): string | undefined {
    // Tool names are prefixed with format: eddo_todo_createTodo
    const parts = toolName.split('_');
    if (parts.length >= 3 && parts[0] === 'eddo') {
      return parts[1]; // Return server name (e.g., 'todo')
    }
    return undefined;
  }
}
