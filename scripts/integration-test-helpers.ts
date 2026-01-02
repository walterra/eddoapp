#!/usr/bin/env tsx
/**
 * Shared helper functions for integration test runners
 */
import { type ChildProcess, spawn } from 'child_process';
import { createServer } from 'http';
import { setTimeout } from 'timers/promises';

/** Result of testcontainer setup */
export interface ContainerSetup {
  teardown: () => Promise<void>;
  url: string;
}

/** MCP server process with metadata */
export interface ServerProcess {
  process: ChildProcess;
  port: number;
  url: string;
  hasExited: boolean;
  exitCode: number | null;
  exitError: string | null;
}

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
 * Checks both IPv4 and IPv6 to avoid EADDRINUSE race conditions.
 */
export async function findAvailablePort(startPort = 3001): Promise<number> {
  let port = startPort;
  const maxPort = startPort + 100;

  while (port < maxPort) {
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
export async function waitForServerReady(
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
      if (response.status === 400 || response.status === 405 || response.ok) {
        console.log(`✅ MCP server ready after ${attempt} attempts (status: ${response.status})`);
        return;
      }
    } catch {
      // Server not ready yet
    }
    if (attempt < maxAttempts) {
      await setTimeout(intervalMs);
    }
  }
  throw new Error(`MCP server failed to start after ${maxAttempts} attempts`);
}

/**
 * Setup CouchDB testcontainer and create test database
 * @returns Container setup with teardown function and URL
 */
export async function setupTestContainer(): Promise<ContainerSetup> {
  console.log('🐳 Starting CouchDB testcontainer...');
  const { setupTestcontainer, teardownTestcontainer, loadTestcontainerConfig } = await import(
    '../test/global-testcontainer-setup'
  );
  await setupTestcontainer();

  const testConfig = loadTestcontainerConfig();
  if (!testConfig?.url) {
    throw new Error('Failed to load testcontainer config');
  }
  console.log(`📦 Using testcontainer CouchDB: ${testConfig.url}`);

  return {
    teardown: teardownTestcontainer,
    url: testConfig.url,
  };
}

/**
 * Create test database in CouchDB
 */
export async function createTestDatabase(couchUrl: string, dbName: string): Promise<void> {
  console.log('🏗️  Creating test database...');
  const nano = (await import('nano')).default;
  const couch = nano(couchUrl);

  try {
    await couch.db.create(dbName);
    console.log(`✅ Created test database: ${dbName}`);
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'statusCode' in err && err.statusCode === 412) {
      console.log(`ℹ️  Test database already exists: ${dbName}`);
    } else {
      throw err;
    }
  }
}

/**
 * Filter pnpm error output from server streams
 */
function filterPnpmErrors(output: string): boolean {
  return !output.includes('ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL');
}

/**
 * Start MCP server process with given configuration
 */
export function startMcpServer(couchUrl: string, port: number, prefix?: string): ServerProcess {
  const mcpUrl = `http://localhost:${port}/mcp`;

  console.log(`🚀 Starting MCP test server on port ${port}...`);

  const serverProcess = spawn('pnpm', ['--filter', '@eddo/mcp-server', 'start:test'], {
    env: {
      ...process.env,
      COUCHDB_URL: couchUrl,
      MCP_SERVER_PORT: port.toString(),
      NODE_ENV: 'test',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const result: ServerProcess = {
    process: serverProcess,
    port,
    url: mcpUrl,
    hasExited: false,
    exitCode: null,
    exitError: null,
  };

  serverProcess.on('exit', (code) => {
    result.hasExited = true;
    result.exitCode = code;
  });

  serverProcess.on('error', (err) => {
    result.hasExited = true;
    result.exitError = err.message;
  });

  const outputPrefix = prefix ? `[${prefix}] ` : '';

  serverProcess.stdout?.on('data', (data: Buffer) => {
    const output = data.toString();
    if (filterPnpmErrors(output)) {
      process.stdout.write(`${outputPrefix}${output}`);
    }
  });

  serverProcess.stderr?.on('data', (data: Buffer) => {
    const output = data.toString();
    if (filterPnpmErrors(output)) {
      process.stderr.write(`${outputPrefix}${output}`);
    }
  });

  return result;
}

/**
 * Stop MCP server process gracefully
 */
export async function stopMcpServer(server: ServerProcess): Promise<void> {
  console.log('🛑 Stopping MCP test server...');
  server.process.kill('SIGTERM');

  await setTimeout(500);

  if (!server.process.killed) {
    server.process.kill('SIGKILL');
  }
}

/**
 * Run test process and wait for completion
 * @returns Exit code from test process
 */
export async function runTestProcess(
  filter: string,
  testCommand: string,
  env: Record<string, string>,
): Promise<number> {
  const testProcess = spawn('pnpm', ['--filter', filter, testCommand], {
    env: { ...process.env, ...env },
    stdio: 'inherit',
  });

  return new Promise<number>((resolve) => {
    testProcess.on('exit', (code) => {
      resolve(code || 0);
    });
  });
}

/**
 * Run vitest directly with given test path
 * @returns Exit code from test process
 */
export async function runVitestProcess(testPath: string): Promise<number> {
  const testProcess = spawn('vitest', ['run', testPath], {
    stdio: 'inherit',
  });

  return new Promise<number>((resolve) => {
    testProcess.on('exit', (code) => {
      resolve(code || 0);
    });
  });
}
