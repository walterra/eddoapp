#!/usr/bin/env tsx
/**
 * Run integration tests with proper server lifecycle management
 */
import {
  type ContainerSetup,
  createTestDatabase,
  runVitestProcess,
  type ServerProcess,
  setupTestContainer,
  startMcpServer,
  stopMcpServer,
} from './integration-test-helpers.js';

const DEFAULT_TEST_DB = 'todos-dev';
const DEFAULT_MCP_PORT = 3003;

async function runIntegrationTests(): Promise<void> {
  let serverProcess: ServerProcess | undefined;
  let containerSetup: ContainerSetup | undefined;
  let testExitCode = 0;

  try {
    containerSetup = await setupTestContainer();
    await createTestDatabase(containerSetup.url, DEFAULT_TEST_DB);

    serverProcess = startMcpServer(containerSetup.url, DEFAULT_MCP_PORT);

    console.log('⏳ Server started, tests will poll for readiness...');
    console.log('🧪 Running integration tests...');

    testExitCode = await runVitestProcess('packages/mcp_server/src/integration-tests');
  } finally {
    if (serverProcess) {
      await stopMcpServer(serverProcess);
    }

    if (containerSetup) {
      console.log('🐳 Stopping CouchDB testcontainer...');
      await containerSetup.teardown();
    }
  }

  process.exit(testExitCode);
}

runIntegrationTests().catch((error: Error) => {
  console.error('❌ Integration test runner failed:', error);
  process.exit(1);
});
