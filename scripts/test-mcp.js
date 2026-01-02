#!/usr/bin/env node
/**
 * Test script for MCP server CRUD operations
 * Supports all tools listed in dev/MCP-CRUD.md
 * Uses the official MCP SDK like the telegram bot
 */
import {
  callToolAndLog,
  closeClient,
  createMcpClient,
  discoverTools,
  parseJsonArg,
  showUsage,
} from './test-mcp-helpers.js';

const MCP_URL = 'http://localhost:3002/mcp';
const TEST_API_KEY = 'test-script-key';

async function testMcpTool(toolName, args = {}) {
  console.log(`🚀 Testing MCP tool: ${toolName}`);
  console.log(`📡 Server URL: ${MCP_URL}`);
  console.log(`🔑 API Key: ${TEST_API_KEY}`);
  console.log(`📋 Arguments:`, JSON.stringify(args, null, 2));
  console.log('');

  let client;

  try {
    const result = await createMcpClient(MCP_URL, TEST_API_KEY);
    client = result.client;

    await discoverTools(client);
    await callToolAndLog(client, toolName, args);
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  } finally {
    if (client) {
      await closeClient(client);
    }
  }
}

async function main() {
  const toolName = process.argv[2];
  const jsonArgsString = process.argv[3];

  if (!toolName) {
    showUsage();
    process.exit(0);
  }

  const args = jsonArgsString ? parseJsonArg(jsonArgsString) : {};
  await testMcpTool(toolName, args);
}

// Handle command line usage
if (process.argv[1].endsWith('test-mcp.js')) {
  main().catch(console.error);
}
