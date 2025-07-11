#!/usr/bin/env node
/**
 * Run telegram-bot integration tests with proper server lifecycle management
 */
import { spawn } from 'child_process';
import { setTimeout } from 'timers/promises';
import { createServer } from 'http';

/**
 * Find an available port starting from the given port number
 */
function findAvailablePort(startPort = 3001) {
  return new Promise((resolve, reject) => {
    const server = createServer();
    
    server.listen(startPort, () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        // Port is in use, try the next one
        findAvailablePort(startPort + 1).then(resolve).catch(reject);
      } else {
        reject(err);
      }
    });
  });
}

async function runTelegramBotIntegrationTests() {
  let serverProcess;
  let testExitCode = 0;

  try {
    // Find an available port for the MCP server
    const mcpPort = process.env.MCP_TEST_PORT || await findAvailablePort(3001);
    const mcpUrl = `http://localhost:${mcpPort}/mcp`;
    
    console.log(`🚀 Starting MCP test server on port ${mcpPort}...`);
    serverProcess = spawn('pnpm', [
      '--filter', '@eddo/server', 'start:test'
    ], {
      env: {
        ...process.env,
        COUCHDB_TEST_DB_NAME: 'todos-test',
        MCP_TEST_PORT: mcpPort.toString(),
        NODE_ENV: 'test'
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    // Pipe server output but filter out the exit error
    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      if (!output.includes('ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL')) {
        process.stdout.write(`[MCP Server] ${output}`);
      }
    });

    serverProcess.stderr.on('data', (data) => {
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
        MCP_TEST_URL: mcpUrl,
        MCP_TEST_PORT: mcpPort.toString()
      },
      stdio: 'inherit'
    });

    // Wait for tests to complete
    await new Promise((resolve) => {
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
  }

  process.exit(testExitCode);
}

// Run the tests
runTelegramBotIntegrationTests().catch((error) => {
  console.error('❌ Telegram bot integration test runner failed:', error);
  process.exit(1);
});