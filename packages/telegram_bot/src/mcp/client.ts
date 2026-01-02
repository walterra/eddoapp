import { Client } from '@modelcontextprotocol/sdk/client/index.js';

import { appConfig } from '../utils/config.js';
import { logger } from '../utils/logger.js';
import { buildMCPClient, getSetupErrorMessage, logSetupError } from './client-helpers.js';
import { ConnectionState, MCPConnectionManager } from './connection-manager.js';
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

let mcpClientInstance: MCPClient | null = null;
let connectionManager: MCPConnectionManager | null = null;

function clearInstance(): void {
  connectionManager = null;
  mcpClientInstance = null;
}

/**
 * Sets up MCP integration with the Eddo MCP server
 * Returns singleton instance to avoid multiple connections
 */
export async function setupMCPIntegration(): Promise<MCPClient> {
  if (mcpClientInstance && connectionManager?.getState() === ConnectionState.CONNECTED) {
    logger.info('Returning existing MCP client instance');
    return mcpClientInstance;
  }

  logger.info('Setting up MCP integration with connection manager', {
    serverUrl: appConfig.MCP_SERVER_URL,
  });

  try {
    if (!connectionManager) {
      connectionManager = new MCPConnectionManager();
    }

    await connectionManager.initialize();
    mcpClientInstance = buildMCPClient(connectionManager, clearInstance);

    logger.info('MCP integration setup complete', {
      connectionState: connectionManager.getState(),
      metrics: connectionManager.getMetrics(),
    });

    return mcpClientInstance;
  } catch (error) {
    logSetupError(error);
    throw new Error(getSetupErrorMessage(error));
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
