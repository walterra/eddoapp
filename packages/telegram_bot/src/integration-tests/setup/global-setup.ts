/**
 * Vitest global setup for telegram-bot integration tests
 * Handles MCP server lifecycle and configuration
 */
import { type ChildProcess, spawn } from 'child_process';
import { createServer } from 'http';
import { setTimeout } from 'timers/promises';
import type { GlobalSetupContext } from 'vitest/node';

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

/**
 * Start the MCP test server
 */
async function startTestServer(port: number): Promise<ChildProcess> {
  const serverProcess = spawn(
    'pnpm',
    ['--filter', '@eddo/server', 'start:test'],
    {
      env: {
        ...process.env,
        COUCHDB_TEST_DB_NAME: 'todos-test',
        MCP_TEST_PORT: port.toString(),
        NODE_ENV: 'test',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

  // Pipe server output but filter out exit errors
  serverProcess.stdout?.on('data', (data) => {
    const output = data.toString();
    if (!output.includes('ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL')) {
      process.stdout.write(`[MCP Server] ${output}`);
    }
  });

  serverProcess.stderr?.on('data', (data) => {
    const output = data.toString();
    if (!output.includes('ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL')) {
      process.stderr.write(`[MCP Server] ${output}`);
    }
  });

  return serverProcess;
}

/**
 * Stop the MCP test server
 */
async function stopTestServer(serverProcess: ChildProcess): Promise<void> {
  if (!serverProcess) return;

  console.log('🛑 Stopping MCP test server...');
  serverProcess.kill('SIGTERM');

  // Give it a moment to shut down gracefully
  await setTimeout(500);

  // Force kill if still running
  if (!serverProcess.killed) {
    serverProcess.kill('SIGKILL');
  }
}

/**
 * Vitest global setup function
 */
export async function setup(_context: GlobalSetupContext) {
  console.log('🚀 Setting up telegram-bot integration test environment...');

  // Find an available port for the MCP server
  const mcpPort = process.env.MCP_TEST_PORT
    ? parseInt(process.env.MCP_TEST_PORT, 10)
    : await findAvailablePort(3001);

  console.log(`🔧 Using MCP test port: ${mcpPort}`);

  console.log(`🚀 Starting MCP test server on port ${mcpPort}...`);

  // Start the test server
  const serverProcess = await startTestServer(mcpPort);

  // Wait for server to be ready
  await setTimeout(3000);

  // Configure test environment
  const testServerUrl = `http://localhost:${mcpPort}/mcp`;

  // Set environment variables for tests
  process.env.MCP_TEST_PORT = mcpPort.toString();
  process.env.MCP_TEST_URL = testServerUrl;
  process.env.COUCHDB_TEST_DB_NAME = 'todos-test';
  process.env.NODE_ENV = 'test';

  console.log('⏳ Server started, tests will poll for readiness...');

  // Return cleanup function
  return async () => {
    await stopTestServer(serverProcess);
  };
}
