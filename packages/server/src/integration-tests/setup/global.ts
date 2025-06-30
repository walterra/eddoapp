/**
 * Global test setup for MCP integration tests
 * Note: Server is started externally via npm-run-all before tests run
 */
import { afterAll, beforeAll } from 'vitest';

// Global test configuration
beforeAll(async () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.COUCHDB_DB_NAME = 'todos-test';
  process.env.MCP_TEST_URL = 'http://localhost:3003/mcp';

  // Increase timeout for integration tests
  globalThis.setTimeout =
    globalThis.setTimeout ||
    ((cb: () => void, ms: number) => {
      return setTimeout(cb, ms);
    });

  console.log('🚀 MCP Integration Test Suite - Server should already be running');

  // Clear the test database before running tests
  const { TestMCPServerInstance } = await import('./test-mcp-server.js');
  const tempInstance = new TestMCPServerInstance();
  await tempInstance.clearTestDatabase();
  console.log('✅ Test database cleared and ready');
}, 30000); // 30 second timeout

afterAll(async () => {
  console.log('✅ MCP Integration Tests Complete');
}, 5000); // 5 second timeout for cleanup

// Extend Vitest's expect with custom matchers if needed
declare global {
  namespace Vi {
    interface AsymmetricMatchersContaining {
      toBeValidTodo(): unknown;
      toBeValidTodoArray(): unknown;
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
