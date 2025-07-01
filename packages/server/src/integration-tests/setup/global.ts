/**
 * Global test setup for MCP integration tests
 * Note: Server is started externally via npm-run-all before tests run
 */
import { afterAll, beforeAll } from 'vitest';

// Global test configuration
beforeAll(async () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.COUCHDB_TEST_DB_NAME = 'todos-test';
  process.env.MCP_TEST_URL = 'http://localhost:3003/mcp';

  // Check if test port is available
  const { ensurePortAvailable } = await import('./port-check.js');
  const testPort = parseInt(process.env.MCP_TEST_PORT || '3003', 10);

  try {
    await ensurePortAvailable(testPort);
  } catch (error) {
    console.error(`\n❌ ${error}\n`);
    process.exit(1);
  }

  // Increase timeout for integration tests
  globalThis.setTimeout =
    globalThis.setTimeout ||
    ((cb: () => void, ms: number) => {
      return setTimeout(cb, ms);
    });

  console.log(
    '🚀 MCP Integration Test Suite - Server should already be running',
  );

  // Set up test database infrastructure once (indexes, design documents)
  console.log('🏗️  Setting up shared test database infrastructure...');
  const { DatabaseSetup } = await import('./database-setup.js');
  const dbSetup = new DatabaseSetup();

  // Reset database completely to ensure clean start
  await dbSetup.resetDatabase();

  // Additional cleanup to ensure no test data remains
  const { MCPTestServer } = await import('./test-server.js');
  const cleanupServer = new MCPTestServer();
  await cleanupServer.waitForServer();
  await cleanupServer.resetTestData();
  await cleanupServer.stop();

  console.log('✅ Test database infrastructure ready and verified clean');
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
