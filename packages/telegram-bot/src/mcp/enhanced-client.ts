import { ChatAnthropic } from '@langchain/anthropic';
import type { RunnableSequence } from '@langchain/core/runnables';
import type { Tool } from '@langchain/core/tools';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { MultiServerMCPClient } from '@langchain/mcp-adapters';

import { appConfig } from '../utils/config.js';
import { logger } from '../utils/logger.js';

/**
 * Enhanced MCP setup configuration
 */
interface EnhancedMCPSetup {
  client: MultiServerMCPClient;
  tools: any[]; // MCP adapter tools
  agent: any; // CompiledStateGraph from createReactAgent
}

/**
 * Tool categorization for better organization and routing
 */
interface ToolCategories {
  todo_management: any[];
  time_tracking: any[];
  calendar: any[];
  file_operations: any[];
  analysis: any[];
  notifications: any[];
  integration: any[];
}

/**
 * Setup enhanced MCP integration with multi-server support
 */
export async function setupEnhancedMCPIntegration(): Promise<EnhancedMCPSetup> {
  logger.info(
    'Setting up enhanced MCP integration with @langchain/mcp-adapters',
  );

  // Configure multiple MCP servers
  const client = new MultiServerMCPClient({
    // Global configuration
    throwOnLoadError: true,
    prefixToolNameWithServerName: true,
    additionalToolNamePrefix: 'eddo',

    // Server configurations
    mcpServers: {
      // Primary Eddo todo server
      todo: {
        transport: 'http',
        url: appConfig.MCP_SERVER_URL || 'http://localhost:3002/mcp',
        // Optional: authentication headers
        headers: process.env.MCP_API_KEY
          ? {
              Authorization: `Bearer ${process.env.MCP_API_KEY}`,
            }
          : undefined,
      },

      // Future: Calendar integration (when available)
      // calendar: {
      //   transport: 'stdio',
      //   command: 'npx',
      //   args: ['-y', '@eddo/calendar-mcp-server']
      // },

      // Future: File management server (when available)
      // files: {
      //   transport: 'stdio',
      //   command: 'python',
      //   args: ['/path/to/file_server.py']
      // }
    },
  });

  logger.info('Initializing MCP client and loading tools');

  // Get all available tools across servers
  const tools = await client.getTools();

  logger.info('Enhanced MCP tools loaded', {
    totalTools: tools.length,
    toolNames: tools.map((t: any) => t.name),
  });

  // Create enhanced agent with all MCP tools
  const llm = new ChatAnthropic({
    model: 'claude-3-5-sonnet-20241022',
    apiKey: appConfig.ANTHROPIC_API_KEY,
    temperature: 0,
  });

  const agent = createReactAgent({
    llm,
    tools: tools as any[], // Type compatibility with LangChain tools
  });

  logger.info('Enhanced MCP integration setup complete');

  return { client, tools, agent };
}

/**
 * Categorize tools by their functional capability for better routing
 */
export function categorizeToolsByCapability(tools: any[]): ToolCategories {
  const categories: ToolCategories = {
    todo_management: [],
    time_tracking: [],
    calendar: [],
    file_operations: [],
    analysis: [],
    notifications: [],
    integration: [],
  };

  for (const tool of tools) {
    const name = tool.name.toLowerCase();
    const desc = tool.description?.toLowerCase() || '';

    if (
      name.includes('todo') ||
      name.includes('task') ||
      name.includes('list') ||
      name.includes('create') ||
      name.includes('update') ||
      name.includes('delete')
    ) {
      categories.todo_management.push(tool);
    } else if (
      name.includes('time') ||
      name.includes('timer') ||
      name.includes('tracking')
    ) {
      categories.time_tracking.push(tool);
    } else if (name.includes('calendar') || name.includes('schedule')) {
      categories.calendar.push(tool);
    } else if (name.includes('file') || name.includes('document')) {
      categories.file_operations.push(tool);
    } else if (
      desc.includes('analy') ||
      desc.includes('report') ||
      desc.includes('summary')
    ) {
      categories.analysis.push(tool);
    } else if (
      name.includes('notify') ||
      name.includes('alert') ||
      name.includes('remind')
    ) {
      categories.notifications.push(tool);
    } else {
      categories.integration.push(tool);
    }
  }

  return categories;
}

/**
 * Build enhanced system message for multi-server context
 */
function buildEnhancedSystemMessage(tools: any[]): string {
  const toolsByCategory = categorizeToolsByCapability(tools);

  return `You are an enhanced AI assistant with access to multiple specialized servers through MCP (Model Context Protocol).

AVAILABLE TOOL CATEGORIES:
${Object.entries(toolsByCategory)
  .map(
    ([category, categoryTools]) =>
      `${category.toUpperCase()}:
${categoryTools.map((t: any) => `  - ${t.name}: ${t.description || 'No description'}`).join('\n')}`,
  )
  .join('\n\n')}

MULTI-SERVER COORDINATION RULES:
1. Prefer tools from the same server for related operations (better consistency)
2. Use cross-server tools when combining different domains (todo + calendar)
3. Consider fallback tools from alternative servers for critical operations
4. Optimize for minimal server round-trips when possible

ENHANCED CAPABILITIES:
- Cross-server data correlation (todo completion affects calendar)
- Multi-domain workflow orchestration (todos, calendar, files)
- Intelligent fallback and error recovery across servers
- Resource sharing between different tool contexts

EXECUTION GUIDELINES:
- Always validate tool parameters before execution
- Use appropriate error handling for each server type
- Provide clear feedback about cross-server operations
- Maintain data consistency across all connected servers

You have access to ${tools.length} tools across ${Object.keys(toolsByCategory).filter((key) => toolsByCategory[key as keyof ToolCategories].length > 0).length} categories. Use them effectively to help users manage their tasks and workflows.`;
}

/**
 * Extract server name from prefixed tool name
 */
export function extractServerName(toolName: string): string {
  // Tool names are prefixed with server name, e.g., "eddo_todo_listTodos"
  const parts = toolName.split('_');
  if (parts.length >= 2) {
    return parts[1]; // Return the server name part
  }
  return 'unknown';
}

/**
 * Feature flag for enhanced MCP usage
 */
export function useEnhancedMCP(): boolean {
  return process.env.USE_ENHANCED_MCP === 'true';
}
