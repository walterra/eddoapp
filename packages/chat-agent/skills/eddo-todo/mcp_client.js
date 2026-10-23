import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';

/** Connects to Eddo's current MCP revision without legacy fallback. */
export async function createClient() {
  const apiKey = process.env.EDDO_MCP_API_KEY;
  if (!apiKey) throw new Error('EDDO_MCP_API_KEY is required');
  const url = process.env.EDDO_MCP_URL || 'http://localhost:3001/mcp';
  const transport = new StreamableHTTPClientTransport(new URL(url), {
    requestInit: { headers: { Authorization: `Bearer ${apiKey}` } },
  });
  const client = new Client(
    { name: 'eddo-todo-skill', version: '2.0.0' },
    { capabilities: {}, versionNegotiation: { mode: { pin: '2026-07-28' } } },
  );
  try {
    await client.connect(transport);
    return client;
  } catch (error) {
    await client.close().catch(() => {});
    throw error;
  }
}

/** Returns the structured envelope as JSON for existing CLI formatters. Never retries writes. */
export async function callTool(client, toolName, args = {}) {
  const response = await client.callTool({ name: toolName, arguments: args });
  if (response.isError)
    throw new Error(`MCP tool failed: ${toolName}; inspect state before retrying`);
  const output = response.structuredContent;
  if (!output || typeof output !== 'object' || Array.isArray(output))
    throw new Error(`Missing structured MCP result: ${toolName}`);
  if (typeof output.summary !== 'string' || !output.metadata || output.error !== undefined)
    throw new Error(`Invalid structured MCP result: ${toolName}`);
  return JSON.stringify(output);
}
