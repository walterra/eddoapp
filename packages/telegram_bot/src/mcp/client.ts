import { Client } from '@modelcontextprotocol/sdk/client/index.js';

import { appConfig } from '../utils/config.js';
import { logger } from '../utils/logger.js';
import {
  ConnectionState,
  MCPConnectionManager,
  type ConnectionMetrics as _ConnectionMetrics,
} from './connection-manager.js';
import type { MCPUserContext } from './user-context.js';

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: object;
  invoke?: (params: Record<string, unknown>) => Promise<unknown>;
}

export interface MCPClient {
  client: Client;
  tools: MCPTool[];
  invoke: (
    toolName: string,
    params: Record<string, unknown>,
    userContext?: MCPUserContext,
  ) => Promise<unknown>;
  close: () => Promise<void>;
}

// Singleton instance to ensure we only create one MCP connection
let mcpClientInstance: MCPClient | null = null;

// Connection manager instance for session persistence
let connectionManager: MCPConnectionManager | null = null;

/**
 * MCP integration that connects to the Eddo MCP server
 * Returns singleton instance to avoid multiple connections
 * Now uses MCPConnectionManager for improved session persistence
 */
export async function setupMCPIntegration(): Promise<MCPClient> {
  // Return existing instance if already initialized
  if (
    mcpClientInstance &&
    connectionManager?.getState() === ConnectionState.CONNECTED
  ) {
    logger.info('Returning existing MCP client instance');
    return mcpClientInstance;
  }

  logger.info('Setting up MCP integration with connection manager', {
    serverUrl: appConfig.MCP_SERVER_URL,
  });

  try {
    // Create connection manager if not exists
    if (!connectionManager) {
      connectionManager = new MCPConnectionManager();
    }

    // Initialize connection with health monitoring
    await connectionManager.initialize();

    // Get tools from connection manager
    const tools = connectionManager.getTools();

    // Tool invocation function that uses connection manager
    const invoke = async (
      toolName: string,
      params: Record<string, unknown>,
      userContext?: MCPUserContext,
    ) => {
      return connectionManager!.invoke(toolName, params, userContext);
    };

    // Close function
    const close = async () => {
      logger.info('Closing MCP connection');
      if (connectionManager) {
        await connectionManager.close();
        connectionManager = null;
      }
      mcpClientInstance = null;
    };

    // Create backward-compatible client interface
    // Note: The client property is maintained for compatibility but managed internally by connection manager
    const client = {} as Client; // Placeholder for compatibility

    // Store singleton instance
    mcpClientInstance = { client, tools, invoke, close };

    logger.info('MCP integration setup complete', {
      connectionState: connectionManager.getState(),
      metrics: connectionManager.getMetrics(),
    });

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

/**
 * Get connection metrics and state information
 */
export function getConnectionInfo() {
  if (!connectionManager) {
    return {
      state: ConnectionState.DISCONNECTED,
      metrics: null,
    };
  }

  return {
    state: connectionManager.getState(),
    metrics: connectionManager.getMetrics(),
  };
}
