#!/usr/bin/env tsx
/**
 * Run telegram-bot integration tests with proper server lifecycle management
 */
import { type ChildProcess, spawn } from 'child_process';
import { createServer } from 'http';
import { setTimeout } from 'timers/promises';

/**
 * Find an available port starting from the given port number
 */
function findAvailablePort(startPort = 3001): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();

    server.listen(startPort, () => {
      const address = server.address();
      if (address && typeof address !== 'string') {
        const port = address.port;
        server.close(() => resolve(port));
      } else {
        reject(new Error('Failed to get port from server'));
      }
    });

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        // Port is in use, try the next one
        findAvailablePort(startPort + 1)
          .then(resolve)
          .catch(reject);
      } else {
        reject(err);
      }
    });
  });
}

async function runTelegramBotIntegrationTests(): Promise<void> {
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
    const testConfig = loadTestcontainerConfig();
    if (!testConfig?.url) {
      throw new Error('Failed to load testcontainer config');
    }
    console.log(`📦 Using testcontainer CouchDB: ${testConfig.url}`);

    containerSetup = { teardown: teardownTestcontainer };

    // Create default test database before starting MCP server
    console.log('🏗️  Creating test database...');
    const nano = (await import('nano')).default;
    const couch = nano(testConfig.url);
    const testDbName = 'todos-dev'; // Default database name from env schema
    try {
      await couch.db.create(testDbName);
      console.log(`✅ Created test database: ${testDbName}`);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'statusCode' in err && err.statusCode === 412) {
        console.log(`ℹ️  Test database already exists: ${testDbName}`);
      } else {
        throw err;
      }
    }

    // Find an available port for the MCP server
    const mcpPort = await findAvailablePort(3001);
    const mcpUrl = `http://localhost:${mcpPort}/mcp`;

    console.log(`🚀 Starting MCP test server on port ${mcpPort}...`);
    serverProcess = spawn('pnpm', ['--filter', '@eddo/mcp-server', 'start:test'], {
      env: {
        ...process.env,
        COUCHDB_URL: testConfig.url,
        MCP_SERVER_PORT: mcpPort.toString(),
        NODE_ENV: 'test',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // Pipe server output but filter out the exit error
    serverProcess.stdout?.on('data', (data: Buffer) => {
      const output = data.toString();
      if (!output.includes('ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL')) {
        process.stdout.write(`[MCP Server] ${output}`);
      }
    });

    serverProcess.stderr?.on('data', (data: Buffer) => {
      const output = data.toString();
      if (!output.includes('ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL')) {
        process.stderr.write(`[MCP Server] ${output}`);
      }
    });

    // Wait a bit for server to start
    await setTimeout(3000);
    console.log('⏳ Server started, running telegram-bot integration tests...');

    // Run the tests
    console.log(`🧪 Running telegram-bot integration tests against ${mcpUrl}...`);
    const testProcess = spawn('pnpm', ['--filter', '@eddo/telegram-bot', 'test:integration'], {
      env: {
        ...process.env,
        COUCHDB_URL: testConfig.url,
        MCP_SERVER_URL: mcpUrl,
        MCP_SERVER_PORT: mcpPort.toString(),
      },
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
runTelegramBotIntegrationTests().catch((error) => {
  console.error('❌ Telegram bot integration test runner failed:', error);
  process.exit(1);
});
