import { logger } from '../utils/logger.js';
import type { MCPClient } from './client.js';

export interface MCPToolInfo {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  examples?: string[];
}

export interface MCPInfoService {
  getMCPToolsInfo(mcpClient: MCPClient): Promise<MCPToolInfo[]>;
  formatMCPInfoForPrompt(toolsInfo: MCPToolInfo[]): Promise<string>;
  formatMCPInfoForIntentAnalysis(toolsInfo: MCPToolInfo[]): Promise<string>;
}

/**
 * Service for managing MCP tool information across components
 * Provides dynamic MCP tool discovery and formatting for different use cases
 */
export class DefaultMCPInfoService implements MCPInfoService {
  private toolsCache: MCPToolInfo[] | null = null;
  private cacheTimestamp: number = 0;
  private readonly cacheTTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Gets MCP tools information with caching
   */
  async getMCPToolsInfo(mcpClient: MCPClient): Promise<MCPToolInfo[]> {
    // Check cache validity
    const now = Date.now();
    if (this.toolsCache && now - this.cacheTimestamp < this.cacheTTL) {
      return this.toolsCache;
    }

    try {
      if (!mcpClient || !mcpClient.isClientConnected()) {
        logger.warn('MCP client not connected, using fallback tool info');
        return this.getFallbackToolsInfo();
      }

      // Get fresh server info
      const serverInfo = await mcpClient.getServerInfo('all');
      const toolsInfo = this.parseServerInfoToTools(serverInfo);

      // Update cache
      this.toolsCache = toolsInfo;
      this.cacheTimestamp = now;

      return toolsInfo;
    } catch (error) {
      logger.warn('Failed to get MCP tools info, using fallback', { error });
      return this.getFallbackToolsInfo();
    }
  }

  /**
   * Formats MCP info for general prompts (used by response generator)
   */
  async formatMCPInfoForPrompt(toolsInfo: MCPToolInfo[]): Promise<string> {
    if (toolsInfo.length === 0) {
      return 'No MCP tools available.';
    }

    return toolsInfo
      .map((tool) => {
        const params = tool.parameters
          ? JSON.stringify(tool.parameters, null, 2)
          : '{}';
        return `### ${tool.name}\n${tool.description}\nParameters: ${params}`;
      })
      .join('\n\n');
  }

  /**
   * Formats MCP info specifically for intent analysis with detailed parameter extraction guidance
   */
  async formatMCPInfoForIntentAnalysis(
    toolsInfo: MCPToolInfo[],
  ): Promise<string> {
    if (toolsInfo.length === 0) {
      return this.getFallbackIntentAnalysisInfo();
    }

    const toolDescriptions = toolsInfo
      .map((tool) => {
        return this.formatToolForIntentAnalysis(tool);
      })
      .join('\n  \n');

    return `Available MCP Actions with detailed parameter specifications:
${toolDescriptions}

IMPORTANT: For createTodo actions, use semantic understanding to extract parameters:
- Parse natural language to identify the actual task title vs. command words
- Extract context from phrases like "work context", "for work", "in work", etc.
- Don't include command words ("create", "add", "todo") in the title
- Use chain-of-thought reasoning to understand user intent

Examples of proper parameter extraction:
- "create todo in 'work' context 'video call with team'" → title="video call with team", context="work"
- "add 'buy groceries' for personal" → title="buy groceries", context="personal"
- "new task: review code for work project" → title="review code for work project", context="work"`;
  }

  /**
   * Formats individual tool for intent analysis with parameter details
   */
  private formatToolForIntentAnalysis(tool: MCPToolInfo): string {
    const paramDetails = this.formatParametersForIntentAnalysis(
      tool.name,
      tool.parameters,
    );
    return `- ${tool.name}: ${tool.description}
  Parameters: ${paramDetails}`;
  }

  /**
   * Formats parameters with specific guidance for intent analysis
   */
  private formatParametersForIntentAnalysis(
    toolName: string,
    parameters: Record<string, unknown>,
  ): string {
    if (!parameters || Object.keys(parameters).length === 0) {
      return '{}';
    }

    // Special handling for createTodo to maintain existing detailed guidance
    if (toolName === 'createTodo') {
      return `{ 
    title: string (required - extract the actual task name from user's message),
    description?: string (optional detailed notes),
    context?: string (extract from phrases like "work context", "for work", "personal", etc. Default: "private"),
    due?: string (ISO format date if mentioned),
    tags?: string[] (extract any mentioned tags or categories),
    repeat?: number (days, if recurring task mentioned),
    link?: string (any URLs mentioned)
  }`;
    }

    // For other tools, format parameters more simply
    const formattedParams = Object.entries(parameters)
      .map(([key, value]) => {
        if (typeof value === 'object' && value !== null) {
          const valueObj = value as Record<string, unknown>;
          const required = valueObj.required ? ' (required)' : '';
          const description = valueObj.description
            ? ` - ${valueObj.description}`
            : '';
          return `${key}: ${valueObj.type || 'unknown'}${required}${description}`;
        }
        return `${key}: ${typeof value}`;
      })
      .join(', ');

    return `{ ${formattedParams} }`;
  }

  /**
   * Parses server info string to extract tool information
   */
  private parseServerInfoToTools(_serverInfo: string): MCPToolInfo[] {
    // This is a simplified parser - in practice you might need more sophisticated parsing
    // based on the actual format returned by mcpClient.getServerInfo()
    try {
      // Try to extract tool information from the server info
      // This would need to be adapted based on the actual format

      // For now, return the hard-coded tools as fallback
      // This should be replaced with actual parsing logic
      return this.getFallbackToolsInfo();
    } catch (error) {
      logger.warn('Failed to parse server info', { error });
      return this.getFallbackToolsInfo();
    }
  }

  /**
   * Provides fallback tool information when MCP server is unavailable
   */
  private getFallbackToolsInfo(): MCPToolInfo[] {
    return [
      {
        name: 'listTodos',
        description: 'Get todos with optional filters',
        parameters: {
          context: { type: 'string', description: 'Filter by context' },
          completed: {
            type: 'boolean',
            description: 'Filter by completion status',
          },
          dateFrom: {
            type: 'string',
            description: 'Filter from date (ISO format)',
          },
          dateTo: {
            type: 'string',
            description: 'Filter to date (ISO format)',
          },
          limit: { type: 'number', description: 'Maximum number of results' },
        },
      },
      {
        name: 'createTodo',
        description: 'Create new todo with semantic parameter extraction',
        parameters: {
          title: { type: 'string', required: true, description: 'Task title' },
          description: { type: 'string', description: 'Task description' },
          context: {
            type: 'string',
            description: 'Task context (default: private)',
          },
          due: { type: 'string', description: 'Due date in ISO format' },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Task tags',
          },
          repeat: { type: 'number', description: 'Repeat interval in days' },
          link: { type: 'string', description: 'Associated URL' },
        },
      },
      {
        name: 'updateTodo',
        description: 'Update existing todo fields',
        parameters: {
          id: { type: 'string', required: true, description: 'Todo ID' },
          title: { type: 'string', description: 'Updated title' },
          description: { type: 'string', description: 'Updated description' },
          context: { type: 'string', description: 'Updated context' },
          due: { type: 'string', description: 'Updated due date' },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Updated tags',
          },
          repeat: { type: 'number', description: 'Updated repeat interval' },
          link: { type: 'string', description: 'Updated link' },
        },
      },
      {
        name: 'deleteTodo',
        description: 'Delete todo by ID',
        parameters: {
          id: {
            type: 'string',
            required: true,
            description: 'Todo ID to delete',
          },
        },
      },
      {
        name: 'toggleTodoCompletion',
        description: 'Mark todo as complete/incomplete',
        parameters: {
          id: { type: 'string', required: true, description: 'Todo ID' },
          completed: {
            type: 'boolean',
            required: true,
            description: 'Completion status',
          },
        },
      },
      {
        name: 'startTimeTracking',
        description: 'Start timer for a todo',
        parameters: {
          id: { type: 'string', required: true, description: 'Todo ID' },
        },
      },
      {
        name: 'stopTimeTracking',
        description: 'Stop timer for a todo',
        parameters: {
          id: { type: 'string', required: true, description: 'Todo ID' },
        },
      },
      {
        name: 'getActiveTimeTracking',
        description: 'Get todos with active time tracking',
        parameters: {},
      },
    ];
  }

  /**
   * Provides fallback intent analysis info when no tools are available
   */
  private getFallbackIntentAnalysisInfo(): string {
    return `Available MCP Actions with detailed parameter specifications:
- listTodos: Get todos with optional filters
  Parameters: { context?: string, completed?: boolean, dateFrom?: string, dateTo?: string, limit?: number }
  
- createTodo: Create new todo with semantic parameter extraction
  Parameters: { 
    title: string (required - extract the actual task name from user's message),
    description?: string (optional detailed notes),
    context?: string (extract from phrases like "work context", "for work", "personal", etc. Default: "private"),
    due?: string (ISO format date if mentioned),
    tags?: string[] (extract any mentioned tags or categories),
    repeat?: number (days, if recurring task mentioned),
    link?: string (any URLs mentioned)
  }

IMPORTANT: For createTodo actions, use semantic understanding to extract parameters:
- Parse natural language to identify the actual task title vs. command words
- Extract context from phrases like "work context", "for work", "in work", etc.
- Don't include command words ("create", "add", "todo") in the title
- Use chain-of-thought reasoning to understand user intent

Examples of proper parameter extraction:
- "create todo in 'work' context 'video call with team'" → title="video call with team", context="work"
- "add 'buy groceries' for personal" → title="buy groceries", context="personal"
- "new task: review code for work project" → title="review code for work project", context="work"`;
  }

  /**
   * Clears the tools cache (useful for testing or forced refresh)
   */
  clearCache(): void {
    this.toolsCache = null;
    this.cacheTimestamp = 0;
  }
}

/**
 * Factory function to create an MCP info service instance
 */
export function createMCPInfoService(): MCPInfoService {
  return new DefaultMCPInfoService();
}
