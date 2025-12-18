/**
 * MCP Test Server Harness
 * Provides a reusable test environment for integration testing
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

import { TestLock } from './test-lock.js';

export interface MCPTestServerConfig {
  serverUrl?: string;
  clientName?: string;
  clientVersion?: string;
  timeout?: number;
}

export class MCPTestServer {
  private client: Client | null = null;
  private transport: StreamableHTTPClientTransport | null = null;
  private config: Required<MCPTestServerConfig>;
  private testLock: TestLock;
  private testApiKey: string;
  private testUser: {
    userId: string;
    username: string;
    dbName: string;
    telegramId: string;
  } | null = null;

  constructor(config: MCPTestServerConfig = {}) {
    // Use dynamic port from environment or fall back to default
    const testPort = process.env.MCP_TEST_PORT || '3003';

    this.config = {
      serverUrl: config.serverUrl || process.env.MCP_TEST_URL || `http://localhost:${testPort}/mcp`,
      clientName: config.clientName || 'integration-test-client',
      clientVersion: config.clientVersion || '1.0.0',
      timeout: config.timeout || 30000,
    };

    this.testLock = new TestLock();

    // Generate unique test API key for complete isolation
    this.testApiKey = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private async ensureTestUser(): Promise<void> {
    if (!this.testUser) {
      const { getGlobalTestUser } = await import('./global-test-user.js');
      this.testUser = await getGlobalTestUser();
    }
  }

  async start(): Promise<void> {
    if (this.client) {
      throw new Error('Test server already started');
    }

    // Ensure test user is initialized
    await this.ensureTestUser();

    // Create transport with user authentication headers for test isolation
    this.transport = new StreamableHTTPClientTransport(new URL(this.config.serverUrl), {
      requestInit: {
        headers: {
          'X-User-ID': this.testUser!.username,
          'X-Database-Name': this.testUser!.dbName,
          'X-Telegram-ID': this.testUser!.telegramId,
        },
      },
    });

    // Create client
    this.client = new Client(
      {
        name: this.config.clientName,
        version: this.config.clientVersion,
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );

    // Connect with timeout
    const connectPromise = this.client.connect(this.transport);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Connection timeout')), this.config.timeout);
    });

    await Promise.race([connectPromise, timeoutPromise]);
  }

  async stop(): Promise<void> {
    if (this.client) {
      try {
        await this.client.close();
      } catch (error) {
        console.warn('Warning: Failed to close MCP client:', error);
      }
      this.client = null;
    }
    this.transport = null;
  }

  getClient(): Client {
    if (!this.client) {
      throw new Error('Test server not started. Call start() first.');
    }
    return this.client;
  }

  async listAvailableTools(): Promise<
    Array<{ name: string; description: string; inputSchema: unknown }>
  > {
    const client = this.getClient();
    const response = await client.listTools();
    return response.tools.map((tool) => ({
      name: tool.name,
      description: tool.description || '',
      inputSchema: tool.inputSchema,
    }));
  }

  async callTool(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
    const client = this.getClient();
    const result = await client.callTool({
      name,
      arguments: args,
    });

    // Extract text content from response
    if (result.content && Array.isArray(result.content) && result.content.length > 0) {
      const textContent = result.content.find((c: { type: string }) => c.type === 'text');
      if (textContent) {
        return this.parseToolResponse(textContent.text, name);
      }
    }

    return result;
  }

  /**
   * Parse tool response with proper error handling and type consistency
   */
  private parseToolResponse(text: string, toolName: string): unknown {
    // Handle empty responses
    if (!text || text.trim() === '') {
      console.warn(`⚠️  Empty response from tool: ${toolName}`);
      return null;
    }

    // All tools now return JSON responses with the new structured format
    try {
      const parsed = JSON.parse(text);

      // Handle the new structured response format
      if (parsed && typeof parsed === 'object') {
        // Special handling for tools that return lists
        const LIST_TOOLS = ['listTodos', 'getActiveTimeTracking'];

        if (LIST_TOOLS.includes(toolName)) {
          // Check if this is an error response
          if (parsed.error) {
            console.warn(`⚠️  Tool ${toolName} returned error: ${parsed.error}`);
            return [];
          }

          // Extract data array from structured response
          if (parsed.data && Array.isArray(parsed.data)) {
            return parsed.data;
          } else if (Array.isArray(parsed)) {
            // Backwards compatibility - if already an array
            return parsed;
          } else {
            console.warn(`⚠️  Tool ${toolName} returned unexpected format: ${typeof parsed}`);
            return [];
          }
        } else if (toolName === 'getUserInfo') {
          // getUserInfo returns the data object directly
          return parsed.data || parsed;
        } else if (toolName === 'getServerInfo') {
          // getServerInfo returns plain text, not JSON
          return text;
        } else {
          // For other tools (createTodo, updateTodo, etc.), return the full response
          // Tests will need to check the response.summary or response.data fields
          return parsed;
        }
      }

      return parsed;
    } catch (parseError) {
      // If JSON parsing fails, check if it's a plain text response (like getServerInfo)
      if (toolName === 'getServerInfo') {
        return text;
      }

      console.error(`❌ Tool ${toolName} returned invalid JSON:`, parseError);
      console.error(`Raw response: ${text.substring(0, 200)}...`);

      // Return appropriate default based on tool type
      const LIST_TOOLS = ['listTodos', 'getActiveTimeTracking'];
      return LIST_TOOLS.includes(toolName) ? [] : text;
    }
  }

  async resetTestData(): Promise<void> {
    // With per-API-key databases via X-API-Key header, each test gets complete isolation
    console.log(`🔄 Test using isolated database for API key: ${this.testApiKey}`);

    // Clear all existing documents first
    await this.clearAllDocuments();

    // Set up the database schema for this test's isolated database
    await this.setupTestDatabase();
  }

  private async setupTestDatabase(): Promise<void> {
    try {
      const { DatabaseSetup } = await import('./database-setup.js');

      // Ensure test user is initialized
      await this.ensureTestUser();

      // Use the user's database name (user is already created globally)
      const testDbName = this.testUser!.dbName;

      // Set up the database with proper indexes and design documents
      const dbSetup = new DatabaseSetup(testDbName);
      await dbSetup.setupDatabase();

      console.log(`✅ Test database initialized: ${testDbName}`);
    } catch (error) {
      console.error('❌ Failed to set up test database:', error);
      throw error;
    }
  }

  private async clearAllDocuments(): Promise<void> {
    // Always use direct database cleanup for reliability
    console.log('🔧 Using direct database cleanup for bulletproof test isolation');
    await this.forceCleanupDatabase();
  }

  private async forceCleanupDatabase(): Promise<void> {
    try {
      const { validateEnv, getTestCouchDbConfig } = await import('@eddo/core-server');
      const nano = await import('nano');

      const env = validateEnv(process.env);
      const couchDbConfig = getTestCouchDbConfig(env);
      const couch = nano.default(couchDbConfig.url);

      // Ensure test user is initialized
      await this.ensureTestUser();

      const db = couch.db.use(this.testUser!.dbName);

      // Get all documents excluding design documents
      const allDocs = await db.list({ include_docs: false });
      const todoIds = allDocs.rows
        .filter((row) => !row.id.startsWith('_design/'))
        .map((row) => ({ id: row.id, rev: row.value.rev }));

      if (todoIds.length > 0) {
        console.log(`🔧 Force deleting ${todoIds.length} remaining documents`);

        // Bulk delete all non-design documents
        const docsToDelete = todoIds.map((doc) => ({
          _id: doc.id,
          _rev: doc.rev,
          _deleted: true,
        }));

        await db.bulk({ docs: docsToDelete });
        console.log('✅ Force cleanup completed');
      }
    } catch (error) {
      if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 404) {
        console.log('🔧 Database does not exist yet - no cleanup needed');
      } else {
        console.error('❌ Force cleanup failed:', error);
        throw error;
      }
    }
  }

  private async waitForServerToRecognizeCleanDatabase(): Promise<void> {
    // Brief wait to allow server to recognize the database reset
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  async waitForServer(maxAttempts: number = 20, delayMs: number = 500): Promise<void> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await this.start();
        await this.callTool('getServerInfo', { section: 'all' });
        return; // Success
      } catch (error) {
        await this.stop();
        if (attempt === maxAttempts) {
          throw new Error(
            `Failed to connect to MCP server after ${maxAttempts} attempts: ${error}`,
          );
        }
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
}
