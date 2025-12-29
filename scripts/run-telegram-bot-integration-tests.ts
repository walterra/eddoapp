#!/usr/bin/env tsx
/**
 * Run telegram-bot integration tests with proper server lifecycle management
 */
import { type ChildProcess, spawn } from 'child_process';
import { createServer } from 'http';
import { setTimeout } from 'timers/promises';

/**
 * Check if a specific port is available on a given host
 */
function isPortAvailable(port: number, host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });
}

/**
 * Find an available port starting from the given port number.
 * Checks both IPv4 (0.0.0.0) and IPv6 (::1) to avoid EADDRINUSE race conditions.
 */
async function findAvailablePort(startPort = 3001): Promise<number> {
  let port = startPort;
  const maxPort = startPort + 100; // Limit search range

  while (port < maxPort) {
    // Check both IPv4 and IPv6 to ensure the port is truly free
    const [ipv4Available, ipv6Available] = await Promise.all([
      isPortAvailable(port, '0.0.0.0'),
      isPortAvailable(port, '::1'),
    ]);

    if (ipv4Available && ipv6Available) {
      return port;
    }
    port++;
  }

  throw new Error(`No available port found in range ${startPort}-${maxPort}`);
}

/**
 * Wait for MCP server to be ready by checking HTTP endpoint
 */
async function waitForServerReady(
  url: string,
  maxAttempts: number = 30,
  intervalMs: number = 500,
): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(2000),
      });
      // MCP endpoint returns 400 "No sessionId" for GET requests, but that means server is up
      // Also accept 405 (Method Not Allowed) or 200 (OK) as valid responses
      if (response.status === 400 || response.status === 405 || response.ok) {
        console.log(`✅ MCP server ready after ${attempt} attempts (status: ${response.status})`);
        return;
      }
    } catch {
      // Server not ready yet, continue waiting
    }
    if (attempt < maxAttempts) {
      await setTimeout(intervalMs);
    }
  }
  throw new Error(`MCP server failed to start after ${maxAttempts} attempts`);
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

    // Track if server process exits early
    let serverExited = false;
    let serverExitCode: number | null = null;
    let serverExitError: string | null = null;

    serverProcess = spawn('pnpm', ['--filter', '@eddo/mcp-server', 'start:test'], {
      env: {
        ...process.env,
        COUCHDB_URL: testConfig.url,
        MCP_SERVER_PORT: mcpPort.toString(),
        NODE_ENV: 'test',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // Track early exit
    serverProcess.on('exit', (code) => {
      serverExited = true;
      serverExitCode = code;
    });

    serverProcess.on('error', (err) => {
      serverExited = true;
      serverExitError = err.message;
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

    // Wait for server to be ready with health check
    console.log('⏳ Waiting for MCP server to be ready...');
    try {
      await waitForServerReady(mcpUrl);
    } catch (error) {
      if (serverExited) {
        throw new Error(
          `MCP server process exited early with code ${serverExitCode}${serverExitError ? `: ${serverExitError}` : ''}`,
        );
      }
      throw error;
    }

    // Double-check server is still running
    if (serverExited) {
      throw new Error(
        `MCP server process exited unexpectedly with code ${serverExitCode}${serverExitError ? `: ${serverExitError}` : ''}`,
      );
    }

    console.log('✅ MCP test server is ready');

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
