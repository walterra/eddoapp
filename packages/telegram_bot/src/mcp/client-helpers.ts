/**
 * MCP client helper functions
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

import { appConfig } from '../utils/config.js';
import { logger } from '../utils/logger.js';
import type { MCPClient, MCPTool } from './client.js';
import { MCPConnectionManager } from './connection-manager.js';
import type { MCPUserContext } from './user-context.js';

/**
 * Creates an invoke function bound to the connection manager
 * @param connectionManager - Active connection manager
 * @returns Tool invocation function
 */
export function createInvokeFunction(
  connectionManager: MCPConnectionManager,
): (
  toolName: string,
  params: Record<string, unknown>,
  userContext?: MCPUserContext,
) => Promise<unknown> {
  return async (
    toolName: string,
    params: Record<string, unknown>,
    userContext?: MCPUserContext,
  ) => {
    return connectionManager.invoke(toolName, params, userContext);
  };
}

/**
 * Creates a close function for the MCP client
 * @param connectionManager - Active connection manager
 * @param clearInstance - Callback to clear the singleton instance
 * @returns Close function
 */
export function createCloseFunction(
  connectionManager: MCPConnectionManager,
  clearInstance: () => void,
): () => Promise<void> {
  return async () => {
    logger.info('Closing MCP connection');
    await connectionManager.close();
    clearInstance();
  };
}

/**
 * Builds the MCP client instance from a connected connection manager
 * @param connectionManager - Active connection manager
 * @param clearInstance - Callback to clear the singleton instance
 * @returns MCP client instance
 */
export function buildMCPClient(
  connectionManager: MCPConnectionManager,
  clearInstance: () => void,
): MCPClient {
  const tools: MCPTool[] = connectionManager.getTools();
  const invoke = createInvokeFunction(connectionManager);
  const close = createCloseFunction(connectionManager, clearInstance);

  // Placeholder for backward compatibility
  const client = {} as Client;

  return { client, tools, invoke, close };
}

/**
 * Determines specific error message based on failure type
 * @param error - Error that occurred
 * @returns Formatted error message
 */
export function getSetupErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }

  const message = error.message;

  if (message.includes('connect') || message.includes('ECONNREFUSED')) {
    return `Failed to connect to MCP server at ${appConfig.MCP_SERVER_URL}: ${message}`;
  }

  if (message.includes('listTools')) {
    return `Failed to discover MCP tools: ${message}`;
  }

  if (message.includes('401') || message.includes('403')) {
    return `MCP authentication failed. Check your API key: ${message}`;
  }

  return message;
}

/**
 * Logs MCP setup failure with detailed context
 * @param error - Error that occurred
 */
export function logSetupError(error: unknown): void {
  logger.error('Failed to setup MCP integration', {
    error: String(error),
    errorType: error instanceof Error ? error.constructor.name : typeof error,
    stack: error instanceof Error ? error.stack : undefined,
    phase: 'setup',
  });
}
