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
  private testUser: {
    userId: string;
    username: string;
    dbName: string;
    telegramId: string;
    mcpApiKey: string;
  } | null = null;

  constructor(config: MCPTestServerConfig = {}) {
    // Use dynamic port from environment or fall back to default
    const testPort = process.env.MCP_SERVER_PORT || '3003';

    this.config = {
      serverUrl: config.serverUrl || process.env.MCP_TEST_URL || `http://localhost:${testPort}/mcp`,
      clientName: config.clientName || 'integration-test-client',
      clientVersion: config.clientVersion || '1.0.0',
      timeout: config.timeout || 30000,
    };

    this.testLock = new TestLock();
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
          Authorization: `Bearer ${this.testUser!.mcpApiKey}`,
        },
      },
    });

    // Create client
    this.client = new Client({
      name: this.config.clientName,
      version: this.config.clientVersion,
    });

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

  private static readonly LIST_TOOLS = ['listTodos', 'getActiveTimeTracking'];

  /**
   * Check if tool returns a list
   */
  private isListTool(toolName: string): boolean {
    return MCPTestServer.LIST_TOOLS.includes(toolName);
  }

  /**
   * Handle list tool response extraction
   */
  private parseListToolResponse(
    parsed: { error?: string; data?: unknown },
    toolName: string,
  ): unknown[] {
    if (parsed.error) {
      console.warn(`⚠️  Tool ${toolName} returned error: ${parsed.error}`);
      return [];
    }

    if (parsed.data && Array.isArray(parsed.data)) {
      return parsed.data;
    }

    if (Array.isArray(parsed)) {
      return parsed;
    }

    console.warn(`⚠️  Tool ${toolName} returned unexpected format: ${typeof parsed}`);
    return [];
  }

  /**
   * Handle JSON parse errors
   */
  private handleParseError(parseError: unknown, text: string, toolName: string): unknown {
    if (toolName === 'getServerInfo') {
      return text;
    }

    console.error(`❌ Tool ${toolName} returned invalid JSON:`, parseError);
    console.error(`Raw response: ${text.substring(0, 200)}...`);

    return this.isListTool(toolName) ? [] : text;
  }

  /**
   * Parse tool response with proper error handling and type consistency
   */
  private parseToolResponse(text: string, toolName: string): unknown {
    if (!text || text.trim() === '') {
      console.warn(`⚠️  Empty response from tool: ${toolName}`);
      return null;
    }

    try {
      const parsed = JSON.parse(text);

      if (!parsed || typeof parsed !== 'object') {
        return parsed;
      }

      if (this.isListTool(toolName)) {
        return this.parseListToolResponse(parsed, toolName);
      }

      if (toolName === 'getUserInfo') {
        return parsed.data || parsed;
      }

      if (toolName === 'getServerInfo') {
        return text;
      }

      return parsed;
    } catch (parseError) {
      return this.handleParseError(parseError, text, toolName);
    }
  }

  async resetTestData(): Promise<void> {
    // With per-API-key databases, each test gets complete isolation
    console.log('🔄 Test using isolated database with unique API key');

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
      const { validateEnv, getCouchDbConfig } = await import('@eddo/core-server');
      const nano = await import('nano');

      const env = validateEnv(process.env);
      const couchDbConfig = getCouchDbConfig(env);
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
