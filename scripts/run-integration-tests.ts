#!/usr/bin/env tsx
/**
 * Run integration tests with proper server lifecycle management
 */
import { type ChildProcess, spawn } from 'child_process';
import { setTimeout } from 'timers/promises';

async function runIntegrationTests(): Promise<void> {
  let serverProcess: ChildProcess | undefined;
  let testExitCode = 0;
  let containerSetup: { teardown: () => Promise<void> } | undefined;

  try {
    // Start testcontainer first
    console.log('🐳 Starting CouchDB testcontainer...');
    const { setupTestcontainer, teardownTestcontainer, loadTestcontainerConfig } = await import(
      '../test/global-testcontainer-setup'
    );
    await setupTestcontainer();

    // Override COUCHDB_URL with testcontainer URL to ensure complete isolation
    loadTestcontainerConfig();

    containerSetup = { teardown: teardownTestcontainer };

    // Start the MCP server (COUCHDB_URL set by setupTestcontainer)
    console.log('🚀 Starting MCP test server...');
    serverProcess = spawn('pnpm', ['--filter', '@eddo/mcp-server', 'start:test'], {
      env: {
        ...process.env,
        MCP_TEST_PORT: '3003',
        NODE_ENV: 'test',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // Pipe server output but filter out the exit error
    serverProcess.stdout?.on('data', (data: Buffer) => {
      const output = data.toString();
      if (!output.includes('ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL')) {
        process.stdout.write(output);
      }
    });

    serverProcess.stderr?.on('data', (data: Buffer) => {
      const output = data.toString();
      if (!output.includes('ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL')) {
        process.stderr.write(output);
      }
    });

    // Server readiness is now handled by polling in the test infrastructure
    console.log('⏳ Server started, tests will poll for readiness...');

    // Run the tests
    console.log('🧪 Running integration tests...');
    const testProcess = spawn('vitest', ['run', 'packages/mcp_server/src/integration-tests'], {
      stdio: 'inherit',
    });

    // Wait for tests to complete
    await new Promise<void>((resolve) => {
      testProcess.on('exit', (code) => {
        testExitCode = code || 0;
        resolve();
      });
    });
  } finally {
    // Clean up the server process
    if (serverProcess) {
      console.log('🛑 Stopping MCP test server...');
      serverProcess.kill('SIGTERM');

      // Give it a moment to shut down gracefully
      await setTimeout(500);

      // Force kill if still running
      if (!serverProcess.killed) {
        serverProcess.kill('SIGKILL');
      }
    }

    // Clean up testcontainer
    if (containerSetup) {
      console.log('🐳 Stopping CouchDB testcontainer...');
      await containerSetup.teardown();
    }
  }

  process.exit(testExitCode);
}

// Run the tests
runIntegrationTests().catch((error: Error) => {
  console.error('❌ Integration test runner failed:', error);
  process.exit(1);
});
