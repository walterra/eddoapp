/**
 * Helper functions for MCP connection manager
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { context, propagation } from '@opentelemetry/api';

import { appConfig } from '../utils/config.js';
import { logger } from '../utils/logger.js';
import type { MCPUserContext } from './user-context.js';

/**
 * Injects OpenTelemetry trace context into headers for distributed tracing
 * @param headers - Existing headers object
 * @returns Headers with trace context injected
 */
function injectTraceContext(headers: Record<string, string>): Record<string, string> {
  const carrier: Record<string, string> = { ...headers };
  propagation.inject(context.active(), carrier);
  return carrier;
}

/**
 * Creates headers for user-specific MCP requests
 * @param userContext - User context for the request
 * @returns Headers object
 */
export function createUserHeaders(userContext: MCPUserContext): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${userContext.mcpApiKey}`,
  };
}

/**
 * Creates a user-specific MCP transport with trace context propagation
 * @param userContext - User context for the request
 * @returns Configured transport
 */
export function createUserTransport(userContext: MCPUserContext): StreamableHTTPClientTransport {
  // Inject trace context for distributed tracing between telegram-bot and mcp-server
  const headers = injectTraceContext(createUserHeaders(userContext));

  return new StreamableHTTPClientTransport(new URL(appConfig.MCP_SERVER_URL), {
    requestInit: { headers },
  });
}

/**
 * Creates and connects a user-specific MCP client
 * @param userContext - User context for the request
 * @returns Connected client
 */
export async function createUserClient(userContext: MCPUserContext): Promise<Client> {
  const transport = createUserTransport(userContext);
  const client = new Client({
    name: 'eddo-telegram-bot',
    version: '1.0.0',
  });

  await client.connect(transport);
  return client;
}

/**
 * Invokes a tool on a user-specific client
 * @param client - MCP client
 * @param toolName - Tool to invoke
 * @param params - Tool parameters
 * @returns Tool result
 */
export async function invokeToolOnClient(
  client: Client,
  toolName: string,
  params: Record<string, unknown>,
): Promise<unknown> {
  const result = await client.callTool({
    name: toolName,
    arguments: params,
  });

  logger.info('MCP tool invoked successfully', {
    toolName,
    result: result.content,
  });

  return result.content;
}

/**
 * Checks if an error is connection-related
 * @param error - Error to check
 * @returns True if connection error
 */
export function isConnectionError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();
  return (
    message.includes('connect') ||
    message.includes('econnrefused') ||
    message.includes('timeout') ||
    message.includes('network') ||
    message.includes('socket')
  );
}

/**
 * Calculate exponential backoff delay
 * @param attempt - Current attempt number
 * @param baseDelayMs - Base delay in milliseconds
 * @param maxDelayMs - Maximum delay in milliseconds
 * @returns Delay in milliseconds
 */
export function calculateReconnectDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
): number {
  return Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
}
