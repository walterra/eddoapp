/**
 * Test MCP Server Instance
 * Manages MCP server lifecycle for integration tests
 */
import { getCouchDbConfig, validateEnv } from '@eddo/shared';
import nano from 'nano';

import { startMcpServer, stopMcpServer } from '../../mcp-server.js';

export class TestMCPServerInstance {
  private port: number;
  private serverStartPromise: Promise<void> | null = null;
  private isServerRunning: boolean = false;

  constructor(port: number = 3003) {
    this.port = port;
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
      process.env.COUCHDB_DB_NAME = 'todos-test';

      const env = validateEnv(process.env);
      console.log(`📦 Using test database: ${env.COUCHDB_DB_NAME}`);

      // Clear and setup test database before starting server
      await this.clearTestDatabase();

      // Start the MCP server directly with test port
      await startMcpServer(this.port);

      this.isServerRunning = true;
      console.log(`🚀 Test MCP server ready on port ${this.port}`);
    } catch (error) {
      console.error('❌ Failed to start test MCP server:', error);
      this.serverStartPromise = null;
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (this.isServerRunning) {
      try {
        await stopMcpServer();
        console.log('✅ Test MCP server stopped');
      } catch (error) {
        console.warn('Warning: Error stopping test MCP server:', error);
      }
    }

    this.isServerRunning = false;
    this.serverStartPromise = null;
  }

  async clearTestDatabase(): Promise<void> {
    try {
      const env = validateEnv(process.env);
      const couchDbConfig = getCouchDbConfig(env);
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
    globalTestServer = new TestMCPServerInstance(3003);
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
