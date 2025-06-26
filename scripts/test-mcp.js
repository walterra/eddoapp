#!/usr/bin/env node

/**
 * Test script for MCP server getServerInfo tool
 * Uses the official MCP SDK like the telegram bot
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const MCP_URL = 'http://localhost:3002/mcp';

async function testMcpServer(section = 'all') {
  console.log('🚀 Testing MCP getServerInfo tool');
  console.log(`📡 Server URL: ${MCP_URL}`);
  console.log(`📋 Section: ${section}`);
  console.log('');

  let client;

  try {
    console.log('🔧 Creating MCP client...');

    // Create transport
    const transport = new StreamableHTTPClientTransport(new URL(MCP_URL));

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

    console.log(`📞 Calling getServerInfo with section: ${section}`);
    const result = await client.callTool({
      name: 'getServerInfo',
      arguments: {
        section,
      },
    });

    console.log('✅ Tool call successful!');
    console.log('\n📄 Response:');
    console.log('='.repeat(80));

    if (result.content && result.content.length > 0) {
      result.content.forEach((content, index) => {
        if (content.type === 'text') {
          console.log(content.text);
        } else {
          console.log(`Content ${index + 1}:`, content);
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

async function main() {
  const section = process.argv[2] || 'all';
  await testMcpServer(section);
}

// Handle command line usage
if (process.argv[1].endsWith('test-mcp.js')) {
  main().catch(console.error);
}
