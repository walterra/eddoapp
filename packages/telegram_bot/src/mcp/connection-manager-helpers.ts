import {
  Client,
  StreamableHTTPClientTransport,
  type CallToolResult,
} from '@modelcontextprotocol/client';
import { context, propagation } from '@opentelemetry/api';

import { appConfig } from '../utils/config.js';
import { logger } from '../utils/logger.js';
import { createMCPHeaders, type MCPUserContext } from './user-context.js';

/** Creates credentials, operation identity, and tracing headers for one invocation. */
export function createUserHeaders(userContext: MCPUserContext): Record<string, string> {
  const headers = createMCPHeaders(userContext);
  propagation.inject(context.active(), headers);
  return headers;
}

/** Creates a user-specific HTTP transport without shared authentication state. */
export function createUserTransport(userContext: MCPUserContext): StreamableHTTPClientTransport {
  return new StreamableHTTPClientTransport(new URL(appConfig.MCP_SERVER_URL), {
    requestInit: { headers: createUserHeaders(userContext) },
  });
}

/** Connects only to the current protocol and closes failed connection attempts. */
export async function createUserClient(userContext: MCPUserContext): Promise<Client> {
  if (!userContext.mcpApiKey) throw new Error('MCP credentials are required');
  const client = new Client(
    { name: 'eddo-telegram-bot', version: '2.0.0' },
    { versionNegotiation: { mode: { pin: '2026-07-28' } } },
  );
  try {
    await client.connect(createUserTransport(userContext));
    return client;
  } catch (error) {
    await client.close().catch(() => undefined);
    throw error;
  }
}

/** Preserves structured payloads and explicit tool failures without retrying mutations. */
export async function invokeToolOnClient(
  client: Client,
  toolName: string,
  params: Record<string, unknown>,
): Promise<CallToolResult> {
  const result = await client.callTool({ name: toolName, arguments: params });
  const output = result.structuredContent;
  if (!output || typeof output !== 'object' || Array.isArray(output))
    throw new Error('MCP tool returned no structured result');
  logger.info('MCP tool request completed', { toolName, isError: result.isError === true });
  return result;
}
