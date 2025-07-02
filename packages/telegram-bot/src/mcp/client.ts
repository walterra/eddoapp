import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

import { appConfig } from '../utils/config.js';
import { logger } from '../utils/logger.js';

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: object;
  invoke?: (params: Record<string, unknown>) => Promise<unknown>;
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
  client: Client;
  tools: MCPTool[];
  invoke: (
    toolName: string,
    params: Record<string, unknown>,
  ) => Promise<unknown>;
  close: () => Promise<void>;
}

// Singleton instance to ensure we only create one MCP connection
let mcpClientInstance: MCPClient | null = null;

/**
 * MCP integration that connects to the Eddo MCP server
 * Returns singleton instance to avoid multiple connections
 */
export async function setupMCPIntegration(): Promise<MCPClient> {
  // Return existing instance if already initialized
  if (mcpClientInstance) {
    logger.info('Returning existing MCP client instance');
    return mcpClientInstance;
  }

  logger.info('Setting up MCP integration', {
    serverUrl: appConfig.MCP_SERVER_URL,
  });

  try {
    // Create StreamableHTTP transport with API key header
    const transport = new StreamableHTTPClientTransport(
      new URL(appConfig.MCP_SERVER_URL),
      {
        requestInit: {
          headers: {
            'X-API-Key': appConfig.MCP_API_KEY,
          },
        },
      },
    );

    // Create MCP client
    const client = new Client(
      {
        name: 'eddo-telegram-bot',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );

    // Connect to the MCP server
    await client.connect(transport);
    logger.info('Connected to MCP server successfully');

    // Note: The @modelcontextprotocol/sdk v1.13.1 handles the MCP handshake
    // automatically during the connect() call. The initialize/initialized
    // methods mentioned in the MCP spec are handled internally by the SDK.
    logger.info(
      'MCP connection established, handshake completed automatically by SDK',
    );

    // Discover available tools
    const toolsResponse = await client.listTools();

    const tools: MCPTool[] = toolsResponse.tools.map((tool) => ({
      name: tool.name,
      description: tool.description || 'No description available',
      inputSchema: tool.inputSchema,
    }));

    logger.info('MCP tools discovered', {
      toolCount: tools.length,
      toolNames: tools.map((t) => t.name),
    });

    // Tool invocation function
    const invoke = async (
      toolName: string,
      params: Record<string, unknown>,
    ) => {
      logger.info('Invoking MCP tool', { toolName, params });

      try {
        const result = await client.callTool({
          name: toolName,
          arguments: params,
        });

        logger.info('MCP tool invoked successfully', {
          toolName,
          result: result.content,
        });
        return result.content;
      } catch (error) {
        logger.error('MCP tool invocation failed', {
          toolName,
          params,
          error: String(error),
        });
        throw error;
      }
    };

    // Close function
    const close = async () => {
      logger.info('Closing MCP connection');
      await client.close();
      // Clear singleton instance on close
      mcpClientInstance = null;
    };

    // Store singleton instance
    mcpClientInstance = { client, tools, invoke, close };

    return mcpClientInstance;
  } catch (error) {
    logger.error('Failed to setup MCP integration', {
      error: String(error),
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      stack: error instanceof Error ? error.stack : undefined,
      phase: 'setup',
    });

    // Provide more specific error messages based on failure type
    if (error instanceof Error) {
      if (
        error.message.includes('connect') ||
        error.message.includes('ECONNREFUSED')
      ) {
        throw new Error(
          `Failed to connect to MCP server at ${appConfig.MCP_SERVER_URL}: ${error.message}`,
        );
      } else if (error.message.includes('listTools')) {
        throw new Error(`Failed to discover MCP tools: ${error.message}`);
      } else if (
        error.message.includes('401') ||
        error.message.includes('403')
      ) {
        throw new Error(
          `MCP authentication failed. Check your API key: ${error.message}`,
        );
      }
    }

    throw error;
  }
}

/**
 * Get the current MCP client instance if initialized
 */
export function getMCPClient(): MCPClient | null {
  return mcpClientInstance;
}
