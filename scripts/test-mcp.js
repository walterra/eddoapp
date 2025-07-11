#!/usr/bin/env node

/**
 * Test script for MCP server CRUD operations
 * Supports all tools listed in dev/MCP-CRUD.md
 * Uses the official MCP SDK like the telegram bot
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const MCP_URL = 'http://localhost:3001/mcp';

async function testMcpTool(toolName, args = {}) {
  console.log(`🚀 Testing MCP tool: ${toolName}`);
  console.log(`📡 Server URL: ${MCP_URL}`);
  console.log(`📋 Arguments:`, JSON.stringify(args, null, 2));
  console.log('');

  let client;

  try {
    console.log('🔧 Creating MCP client...');

    // Create transport with API key authentication
    const transport = new StreamableHTTPClientTransport(new URL(MCP_URL), {
      requestInit: {
        headers: {
          'X-API-Key': 'walterra',
        },
      },
    });

    // Create client
    client = new Client(
      {
        name: 'test-client',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    console.log('🔌 Connecting to MCP server...');
    await client.connect(transport);
    console.log('✅ Connected successfully!');

    console.log('🔍 Discovering available tools...');
    const toolsResponse = await client.listTools();
    console.log(`📋 Found ${toolsResponse.tools.length} tools`);
    
    // List available tools
    console.log('Available tools:');
    toolsResponse.tools.forEach(tool => {
      console.log(`  - ${tool.name}: ${tool.description}`);
    });
    console.log('');

    console.log(`📞 Calling ${toolName}...`);
    const result = await client.callTool({
      name: toolName,
      arguments: args,
    });

    console.log('✅ Tool call successful!');
    console.log('\n📄 Response:');
    console.log('='.repeat(80));

    if (result.content && result.content.length > 0) {
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

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  } finally {
    if (client) {
      try {
        await client.close();
        console.log('🔌 Connection closed');
      } catch (closeError) {
        console.warn('⚠️  Warning: Failed to close connection:', closeError.message);
      }
    }
  }
}

function parseJsonArg(jsonString) {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('❌ Invalid JSON argument:', jsonString);
    console.error('Error:', error.message);
    process.exit(1);
  }
}

function showUsage() {
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

Examples from dev/MCP-CRUD.md are directly supported.
`);
}

async function main() {
  const toolName = process.argv[2];
  const jsonArgsString = process.argv[3];

  if (!toolName) {
    showUsage();
    process.exit(0);
  }

  // Parse JSON arguments if provided
  const args = jsonArgsString ? parseJsonArg(jsonArgsString) : {};

  await testMcpTool(toolName, args);
}

// Handle command line usage
if (process.argv[1].endsWith('test-mcp.js')) {
  main().catch(console.error);
}
