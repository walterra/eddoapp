#!/usr/bin/env tsx
/**
 * Run telegram-bot integration tests with proper server lifecycle management
 */
import {
  type ContainerSetup,
  createTestDatabase,
  findAvailablePort,
  runTestProcess,
  type ServerProcess,
  setupTestContainer,
  startMcpServer,
  stopMcpServer,
  waitForServerReady,
} from './integration-test-helpers.js';

const DEFAULT_TEST_DB = 'todos-dev';

/**
 * Verify server is still running and ready
 */
async function verifyServerReady(server: ServerProcess): Promise<void> {
  console.log('⏳ Waiting for MCP server to be ready...');
  try {
    await waitForServerReady(server.url);
  } catch (error) {
    if (server.hasExited) {
      throw new Error(
        `MCP server process exited early with code ${server.exitCode}${server.exitError ? `: ${server.exitError}` : ''}`,
      );
    }
    throw error;
  }

  if (server.hasExited) {
    throw new Error(
      `MCP server process exited unexpectedly with code ${server.exitCode}${server.exitError ? `: ${server.exitError}` : ''}`,
    );
  }

  console.log('✅ MCP test server is ready');
}

async function runTelegramBotIntegrationTests(): Promise<void> {
  let serverProcess: ServerProcess | undefined;
  let containerSetup: ContainerSetup | undefined;
  let testExitCode = 0;

  try {
    containerSetup = await setupTestContainer();
    await createTestDatabase(containerSetup.url, DEFAULT_TEST_DB);

    const mcpPort = await findAvailablePort(3001);
    serverProcess = startMcpServer(containerSetup.url, mcpPort, 'MCP Server');

    await verifyServerReady(serverProcess);

    console.log(`🧪 Running telegram-bot integration tests against ${serverProcess.url}...`);

    testExitCode = await runTestProcess('@eddo/telegram-bot', 'test:integration', {
      COUCHDB_URL: containerSetup.url,
      MCP_SERVER_URL: serverProcess.url,
      MCP_SERVER_PORT: serverProcess.port.toString(),
    });
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

runTelegramBotIntegrationTests().catch((error) => {
  console.error('❌ Telegram bot integration test runner failed:', error);
  process.exit(1);
});
