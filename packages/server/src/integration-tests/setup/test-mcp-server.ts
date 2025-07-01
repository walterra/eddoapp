/**
 * Test MCP Server Instance
 * Manages MCP server lifecycle for integration tests
 */
import { getTestCouchDbConfig, validateEnv } from '@eddo/shared';
import { ChildProcess, spawn } from 'child_process';
import nano from 'nano';

// import path from 'path'; // Removed unused import

export class TestMCPServerInstance {
  private port: number;
  private serverStartPromise: Promise<void> | null = null;
  private isServerRunning: boolean = false;
  private serverProcess: ChildProcess | null = null;

  constructor(port?: number) {
    // Use environment variable or fallback to a random port to avoid conflicts
    this.port =
      port ||
      Number(process.env.MCP_TEST_PORT) ||
      3003 + Math.floor(Math.random() * 1000);
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
        ['--filter', '@eddo/server', 'start:test'],
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

      // Wait for server to be ready
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Server startup timeout'));
        }, 30000);

        this.serverProcess!.stdout?.on('data', (data) => {
          const output = data.toString();
          console.log(`[MCP Server] ${output.trim()}`);

          if (output.includes('🚀 Eddo MCP server running')) {
            clearTimeout(timeout);
            resolve();
          }
        });

        this.serverProcess!.stderr?.on('data', (data) => {
          console.error(`[MCP Server Error] ${data.toString().trim()}`);
        });

        this.serverProcess!.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });

        this.serverProcess!.on('exit', (code) => {
          if (code !== 0) {
            clearTimeout(timeout);
            reject(new Error(`Server exited with code ${code}`));
          }
        });
      });

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
}

// Global test server instance
let globalTestServer: TestMCPServerInstance | null = null;

export async function getGlobalTestServer(): Promise<TestMCPServerInstance> {
  if (!globalTestServer) {
    const env = validateEnv(process.env);
    globalTestServer = new TestMCPServerInstance(env.MCP_TEST_PORT);
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
