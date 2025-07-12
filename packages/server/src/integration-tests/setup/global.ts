/**
 * Global test setup for MCP integration tests
 * Note: Server is now managed by global-setup.ts
 */
import { afterAll, beforeAll } from 'vitest';

// Global test configuration
beforeAll(async () => {
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
