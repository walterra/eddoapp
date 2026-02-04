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

const MCP_URL = process.env.MCP_URL || 'http://localhost:3002/mcp';
const MCP_API_KEY = process.env.EDDO_MCP_API_KEY || process.env.MCP_API_KEY || '';
const MCP_USER_ID = process.env.EDDO_MCP_USER_ID || 'eddo_pi_agent';
const MCP_DATABASE_NAME = process.env.EDDO_MCP_DATABASE_NAME || '';
const MCP_TELEGRAM_ID = process.env.EDDO_MCP_TELEGRAM_ID || '';

function maskKey(key) {
  if (!key) return 'missing';
  if (key.length <= 8) return `${key.slice(0, 2)}…${key.slice(-2)}`;
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

function buildHeaders() {
  const headers = {
    'X-User-ID': MCP_USER_ID,
    'X-API-Key': MCP_API_KEY,
  };
  if (MCP_DATABASE_NAME) headers['X-Database-Name'] = MCP_DATABASE_NAME;
  if (MCP_TELEGRAM_ID) headers['X-Telegram-ID'] = MCP_TELEGRAM_ID;
  return headers;
}

async function testMcpTool(toolName, args = {}) {
  if (!MCP_API_KEY) {
    console.error('❌ EDDO_MCP_API_KEY is required to run MCP tests');
    process.exit(1);
  }

  console.log(`🚀 Testing MCP tool: ${toolName}`);
  console.log(`📡 Server URL: ${MCP_URL}`);
  console.log(`👤 User ID: ${MCP_USER_ID}`);
  console.log(`🔑 API Key: ${maskKey(MCP_API_KEY)}`);
  console.log(`📋 Arguments:`, JSON.stringify(args, null, 2));
  console.log('');

  let client;

  try {
    const result = await createMcpClient(MCP_URL, buildHeaders());
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
