/**
 * Global test setup for MCP integration tests
 */

import { beforeAll, afterAll } from 'vitest';
import { getGlobalTestServer, stopGlobalTestServer } from './test-mcp-server.js';

// Global test configuration
beforeAll(async () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.COUCHDB_DB_NAME = 'todos-test';
  
  // Increase timeout for integration tests
  globalThis.setTimeout = globalThis.setTimeout || ((cb: () => void, ms: number) => {
    return setTimeout(cb, ms);
  });

  console.log('🚀 Starting MCP Integration Test Suite');
  
  // Start the test MCP server
  const testServer = await getGlobalTestServer();
  console.log('📡 Test MCP Server URL:', testServer.getUrl());
  
  // Update the test URL environment variable for individual tests
  process.env.MCP_TEST_URL = testServer.getUrl();
}, 60000); // 60 second timeout for server startup

afterAll(async () => {
  console.log('🛑 Stopping test MCP server...');
  await stopGlobalTestServer();
  console.log('✅ MCP Integration Tests Complete');
}, 30000); // 30 second timeout for cleanup

// Extend Vitest's expect with custom matchers if needed
declare global {
  namespace Vi {
    interface AsymmetricMatchersContaining {
      toBeValidTodo(): any;
      toBeValidTodoArray(): any;
    }
  }
}

// Global error handler for unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Global error handler for uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Don't exit in tests - let vitest handle the error
});