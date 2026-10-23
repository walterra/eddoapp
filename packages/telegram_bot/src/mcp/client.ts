import { createUserClient, invokeToolOnClient } from './connection-manager-helpers.js';
import type { MCPUserContext } from './user-context.js';

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: object;
  invoke?: (params: Record<string, unknown>) => Promise<unknown>;
}

export interface MCPClient {
  tools: MCPTool[];
  invoke: (
    toolName: string,
    params: Record<string, unknown>,
    userContext?: MCPUserContext,
  ) => Promise<unknown>;
  close: () => Promise<void>;
}

let instance: MCPClient | null = null;

/** Creates a stateless dispatcher without anonymous discovery or background sessions. */
export async function setupMCPIntegration(): Promise<MCPClient> {
  if (instance) return instance;
  instance = {
    tools: [],
    invoke: async (name, args, user) => {
      if (!user?.mcpApiKey) throw new Error('User context is required for MCP tool invocation');
      const client = await createUserClient(user);
      try {
        return await invokeToolOnClient(client, name, args);
      } finally {
        await client.close();
      }
    },
    close: async () => {
      instance = null;
    },
  };
  return instance;
}

/** Discovers a private catalog with current credentials without sharing it across users. */
export async function scopeMCPIntegration(
  dispatcher: MCPClient,
  user: MCPUserContext,
): Promise<MCPClient> {
  const client = await createUserClient(user);
  try {
    const catalog = await client.listTools();
    return {
      ...dispatcher,
      tools: catalog.tools.map((tool) => ({
        name: tool.name,
        description: tool.description || 'No description available',
        inputSchema: tool.inputSchema,
      })),
    };
  } finally {
    await client.close();
  }
}

/** Returns the initialized dispatcher, not an authenticated shared connection. */
export function getMCPClient(): MCPClient | null {
  return instance;
}

/** Reports dispatcher readiness; remote availability is checked by authenticated requests. */
export function getConnectionInfo(): { state: string; metrics: null } {
  return { state: instance ? 'READY' : 'DISCONNECTED', metrics: null };
}
