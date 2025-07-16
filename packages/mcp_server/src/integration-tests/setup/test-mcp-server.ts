/**
 * Test MCP Server Instance
 * Manages MCP server lifecycle for integration tests
 */
import { getTestCouchDbConfig, validateEnv } from '@eddo/core-server';
import { ChildProcess, spawn } from 'child_process';
import nano from 'nano';

// import path from 'path'; // Removed unused import

export interface ServerPollingConfig {
  maxAttempts?: number;
  pollIntervalMs?: number;
  startupTimeoutMs?: number;
}

export class TestMCPServerInstance {
  private port: number;
  private serverStartPromise: Promise<void> | null = null;
  private isServerRunning: boolean = false;
  private serverProcess: ChildProcess | null = null;
  private pollingConfig: Required<ServerPollingConfig>;
  private serverReady: boolean = false;
  private serverError: Error | null = null;

  constructor(port?: number, pollingConfig?: ServerPollingConfig) {
    // Use environment variable or fallback to a random port to avoid conflicts
    this.port =
      port ||
      Number(process.env.MCP_TEST_PORT) ||
      3003 + Math.floor(Math.random() * 1000);

    this.pollingConfig = {
      maxAttempts: pollingConfig?.maxAttempts ?? 30,
      pollIntervalMs: pollingConfig?.pollIntervalMs ?? 1000,
      startupTimeoutMs: pollingConfig?.startupTimeoutMs ?? 30000,
    };
  }

  async start(): Promise<void> {
    if (this.serverStartPromise) {
      return this.serverStartPromise;
    }

    if (this.isServerRunning) {
      throw new Error('Test MCP server already started');
    }

    this.serverStartPromise = this._startServer();
    return this.serverStartPromise;
  }

  private async _startServer(): Promise<void> {
    try {
      console.log(`🔧 Starting test MCP server on port ${this.port}...`);

      // Set test environment variables before starting
      process.env.NODE_ENV = 'test';
      process.env.COUCHDB_TEST_DB_NAME = 'todos-test';

      const env = validateEnv(process.env);
      console.log(`📦 Using test database: ${env.COUCHDB_TEST_DB_NAME}`);

      // Start the MCP server using the dedicated test script
      this.serverProcess = spawn(
        'pnpm',
        ['--filter', '@eddo/mcp-server', 'start:test'],
        {
          env: {
            ...process.env,
            NODE_ENV: 'test',
            COUCHDB_TEST_DB_NAME: 'todos-test',
            MCP_TEST_PORT: this.port.toString(),
          },
          stdio: ['ignore', 'pipe', 'pipe'],
          cwd: process.cwd(),
        },
      );

      // Reset state flags
      this.serverReady = false;
      this.serverError = null;

      // Set up process event handlers
      this.serverProcess!.stdout?.on('data', (data) => {
        const output = data.toString();
        console.log(`[MCP Server] ${output.trim()}`);

        if (output.includes('🚀 Eddo MCP server running')) {
          this.serverReady = true;
        }
      });

      this.serverProcess!.stderr?.on('data', (data) => {
        console.error(`[MCP Server Error] ${data.toString().trim()}`);
      });

      this.serverProcess!.on('error', (error) => {
        this.serverError = error;
      });

      this.serverProcess!.on('exit', (code) => {
        if (code !== 0) {
          this.serverError = new Error(`Server exited with code ${code}`);
        }
      });

      // Poll for server readiness
      await this.pollForServerReady();

      this.isServerRunning = true;
      console.log(`🚀 Test MCP server ready on port ${this.port}`);
    } catch (error) {
      console.error('❌ Failed to start test MCP server:', error);
      this.serverStartPromise = null;
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (this.isServerRunning && this.serverProcess) {
      try {
        // Kill the server process
        this.serverProcess.kill('SIGTERM');

        // Wait for process to exit
        await new Promise<void>((resolve) => {
          if (!this.serverProcess) {
            resolve();
            return;
          }

          const timeout = setTimeout(() => {
            // Force kill if it doesn't stop gracefully
            this.serverProcess?.kill('SIGKILL');
            resolve();
          }, 5000);

          this.serverProcess.on('exit', () => {
            clearTimeout(timeout);
            resolve();
          });
        });

        console.log('✅ Test MCP server stopped');
      } catch (error) {
        console.warn('Warning: Error stopping test MCP server:', error);
      }
    }

    this.isServerRunning = false;
    this.serverStartPromise = null;
    this.serverProcess = null;
  }

  async clearTestDatabase(): Promise<void> {
    try {
      const env = validateEnv(process.env);
      const couchDbConfig = getTestCouchDbConfig(env);
      const couch = nano(couchDbConfig.url);

      // Try to delete the test database
      try {
        await couch.db.destroy(couchDbConfig.dbName);
        console.log(`🗑️  Cleared test database: ${couchDbConfig.dbName}`);
      } catch (error: unknown) {
        if (
          error &&
          typeof error === 'object' &&
          'statusCode' in error &&
          error.statusCode === 404
        ) {
          console.log(
            `ℹ️  Test database doesn't exist: ${couchDbConfig.dbName}`,
          );
        } else {
          console.warn('Warning: Failed to clear test database:', error);
        }
      }

      // Recreate the test database
      await couch.db.create(couchDbConfig.dbName);
      console.log(`✅ Created fresh test database: ${couchDbConfig.dbName}`);
    } catch (error) {
      console.error('❌ Failed to manage test database:', error);
      throw error;
    }
  }

  getPort(): number {
    return this.port;
  }

  getUrl(): string {
    return `http://localhost:${this.port}/mcp`;
  }

  isRunning(): boolean {
    return this.isServerRunning;
  }

  private async pollForServerReady(): Promise<void> {
    const startTime = Date.now();
    let attempts = 0;

    while (attempts < this.pollingConfig.maxAttempts) {
      attempts++;

      // Check if server reported ready via stdout
      if (this.serverReady) {
        console.log(`✅ Server reported ready after ${attempts} attempts`);
        return;
      }

      // Check for errors
      if (this.serverError) {
        throw this.serverError;
      }

      // Check if process is still alive
      if (this.serverProcess?.exitCode !== null) {
        throw new Error(
          `Server process exited unexpectedly with code ${this.serverProcess?.exitCode}`,
        );
      }

      // Try HTTP health check if server might be ready
      if (attempts > 2) {
        try {
          const healthCheckUrl = `http://localhost:${this.port}/mcp`;
          const controller = new AbortController();
          const timeoutId = setTimeout(
            () => controller.abort(),
            this.pollingConfig.pollIntervalMs,
          );

          const response = await fetch(healthCheckUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': 'test-health-check',
            },
            body: JSON.stringify({
              jsonrpc: '2.0',
              method: 'initialize',
              params: {
                protocolVersion: '0.1.0',
                capabilities: {},
                clientInfo: {
                  name: 'health-check',
                  version: '1.0.0',
                },
              },
              id: 1,
            }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (response.ok) {
            console.log(
              `✅ Server HTTP endpoint ready after ${attempts} attempts`,
            );
            return;
          }
        } catch (_error) {
          // Server not ready yet, continue polling
        }
      }

      // Check overall timeout
      if (Date.now() - startTime > this.pollingConfig.startupTimeoutMs) {
        throw new Error(
          `Server startup timeout after ${this.pollingConfig.startupTimeoutMs}ms`,
        );
      }

      // Wait before next attempt
      await new Promise((resolve) =>
        setTimeout(resolve, this.pollingConfig.pollIntervalMs),
      );
    }

    throw new Error(
      `Server failed to start after ${attempts} attempts (${Date.now() - startTime}ms)`,
    );
  }
}

// Global test server instance
let globalTestServer: TestMCPServerInstance | null = null;

export async function getGlobalTestServer(): Promise<TestMCPServerInstance> {
  if (!globalTestServer) {
    const env = validateEnv(process.env);
    globalTestServer = new TestMCPServerInstance(env.MCP_TEST_PORT, {
      maxAttempts: 20,
      pollIntervalMs: 500,
      startupTimeoutMs: 20000,
    });
    await globalTestServer.start();
  }
  return globalTestServer;
}

export async function stopGlobalTestServer(): Promise<void> {
  if (globalTestServer) {
    await globalTestServer.stop();
    globalTestServer = null;
  }
}
