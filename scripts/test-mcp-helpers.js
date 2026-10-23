/**
 * Helper functions for MCP test script
 * Extracted to reduce function complexity
 */
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';

/**
 * Create MCP client with transport
 * @param {string} serverUrl - MCP server URL
 * @param {Record<string, string>} headers - Authentication headers
 * @returns {Promise<{client: Client, transport: StreamableHTTPClientTransport}>}
 */
export async function createMcpClient(serverUrl, headers) {
  console.log('🔧 Creating MCP client...');

  const transport = new StreamableHTTPClientTransport(new URL(serverUrl), {
    requestInit: {
      headers,
    },
  });

  const client = new Client(
    {
      name: 'test-client',
      version: '1.0.0',
    },
    {
      versionNegotiation: { mode: { pin: '2026-07-28' } },
    },
  );

  console.log('🔌 Connecting to MCP server...');
  await client.connect(transport);
  console.log('✅ Connected successfully!');

  return { client, transport };
}

/**
 * Discover and log available tools
 * @param {Client} client - MCP client
 * @returns {Promise<void>}
 */
export async function discoverTools(client) {
  console.log('🔍 Discovering available tools...');
  const toolsResponse = await client.listTools();
  console.log(`📋 Found ${toolsResponse.tools.length} tools`);

  console.log('Available tools:');
  toolsResponse.tools.forEach((tool) => {
    console.log(`  - ${tool.name}: ${tool.description}`);
  });
  console.log('');
}

/**
 * Call MCP tool and log response
 * @param {Client} client - MCP client
 * @param {string} toolName - Tool name to call
 * @param {object} args - Tool arguments
 * @returns {Promise<void>}
 */
export async function callToolAndLog(client, toolName, args) {
  console.log(`📞 Calling ${toolName}...`);
  const result = await client.callTool({
    name: toolName,
    arguments: args,
  });

  if (result.isError)
    throw new Error(`MCP tool failed: ${toolName}; inspect state before retrying`);
  if (!result.structuredContent) throw new Error(`Missing structured result: ${toolName}`);
  console.log('✅ Tool call successful!');
  logToolResponse(result);
}

/**
 * Log tool response content
 * @param {object} result - Tool call result
 */
function logToolResponse(result) {
  console.log('\n📄 Response:');
  console.log('='.repeat(80));

  if (result.structuredContent) {
    console.log(JSON.stringify(result.structuredContent, null, 2));
  } else if (result.content && result.content.length > 0) {
    result.content.forEach((content, index) => {
      if (content.type === 'text') {
        console.log(content.text);
      } else {
        console.log(`Content ${index + 1}:`, JSON.stringify(content, null, 2));
      }
    });
  } else {
    console.log('No content in response:', result);
  }

  console.log('='.repeat(80));
}

/**
 * Close MCP client connection
 * @param {Client} client - MCP client
 * @returns {Promise<void>}
 */
export async function closeClient(client) {
  try {
    await client.close();
    console.log('🔌 Connection closed');
  } catch (closeError) {
    console.warn('⚠️  Warning: Failed to close connection:', closeError.message);
  }
}

/**
 * Parse JSON argument string
 * @param {string} jsonString - JSON string to parse
 * @returns {object} Parsed JSON object
 */
export function parseJsonArg(jsonString) {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('❌ Invalid JSON argument:', jsonString);
    console.error('Error:', error.message);
    process.exit(1);
  }
}

/**
 * Display usage information
 */
export function showUsage() {
  console.log(`
🔧 MCP CRUD Test Script Usage:

  pnpm test:mcp <toolName> [jsonArgs]

📋 Available tools (from dev/MCP-CRUD.md):

CREATE:
  pnpm test:mcp createTodo '{"title": "Test Todo", "context": "work", "due": "2025-06-20"}'

READ:
  pnpm test:mcp listTodos '{}'
  pnpm test:mcp listTodos '{"context": "work"}'
  pnpm test:mcp listTodos '{"completed": false}'
  pnpm test:mcp getActiveTimeTracking '{}'

UPDATE:
  pnpm test:mcp updateTodo '{"id": "2025-06-18T10:30:00.000Z", "title": "New Title"}'
  pnpm test:mcp toggleTodoCompletion '{"id": "2025-06-18T10:30:00.000Z", "completed": true}'

DELETE:
  pnpm test:mcp deleteTodo '{"id": "2025-06-18T10:30:00.000Z"}'

TIME TRACKING:
  pnpm test:mcp startTimeTracking '{"id": "2025-06-18T10:30:00.000Z"}'
  pnpm test:mcp stopTimeTracking '{"id": "2025-06-18T10:30:00.000Z"}'

OTHER:
  pnpm test:mcp getServerInfo '{"section": "all"}'

Environment variables:
  MCP_URL (default: http://localhost:3002/mcp)
  EDDO_MCP_API_KEY (required)
  EDDO_MCP_USER_ID (default: eddo_pi_agent)
  EDDO_MCP_DATABASE_NAME (optional)
  EDDO_MCP_TELEGRAM_ID (optional)

Examples from dev/MCP-CRUD.md are directly supported.
`);
}
