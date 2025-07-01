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

  constructor(config: MCPTestServerConfig = {}) {
    // Use dynamic port from environment or fall back to default
    const testPort = process.env.MCP_TEST_PORT || '3003';
    
    this.config = {
      serverUrl:
        config.serverUrl ||
        process.env.MCP_TEST_URL ||
        `http://localhost:${testPort}/mcp`,
      clientName: config.clientName || 'integration-test-client',
      clientVersion: config.clientVersion || '1.0.0',
      timeout: config.timeout || 30000,
    };
    
    this.testLock = new TestLock();
    
    // Generate unique test API key for complete isolation
    this.testApiKey = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  async start(): Promise<void> {
    if (this.client) {
      throw new Error('Test server already started');
    }

    // Create transport with API key header for test isolation
    this.transport = new StreamableHTTPClientTransport(
      new URL(this.config.serverUrl),
      {
        requestInit: {
          headers: {
            'X-API-Key': this.testApiKey,
          },
        },
      },
    );

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
      setTimeout(
        () => reject(new Error('Connection timeout')),
        this.config.timeout,
      );
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

  async callTool(
    name: string,
    args: Record<string, unknown> = {},
  ): Promise<unknown> {
    const client = this.getClient();
    const result = await client.callTool({
      name,
      arguments: args,
    });

    // Extract text content from response
    if (
      result.content &&
      Array.isArray(result.content) &&
      result.content.length > 0
    ) {
      const textContent = result.content.find(
        (c: { type: string }) => c.type === 'text',
      );
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

    // Only these tools return JSON - all others return plain text
    const JSON_RETURNING_TOOLS = ['listTodos', 'getActiveTimeTracking'];
    
    if (JSON_RETURNING_TOOLS.includes(toolName)) {
      // Try to parse as JSON for tools that should return JSON
      try {
        const parsed = JSON.parse(text);
        
        // Ensure list tools return arrays
        if (Array.isArray(parsed)) {
          return parsed;
        } else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.docs)) {
          // Handle CouchDB-style response format
          return parsed.docs;
        } else {
          console.warn(`⚠️  Tool ${toolName} returned non-array JSON: ${typeof parsed}`);
          return [];
        }
      } catch (parseError) {
        console.error(`❌ Tool ${toolName} returned invalid JSON:`, parseError);
        console.error(`Raw response: ${text.substring(0, 200)}...`);
        return [];
      }
    } else {
      // For non-JSON tools (createTodo, updateTodo, etc.), return text directly
      return text;
    }
  }

  async resetTestData(): Promise<void> {
    // With per-API-key databases via X-API-Key header, each test gets complete isolation
    console.log(`🔄 Test using isolated database for API key: ${this.testApiKey}`);
    
    // Set up the database schema for this test's isolated database
    await this.setupTestDatabase();
  }

  private async setupTestDatabase(): Promise<void> {
    try {
      const { validateEnv, getTestCouchDbConfig } = await import('@eddo/shared');
      const { DatabaseSetup } = await import('./database-setup.js');
      
      const env = validateEnv(process.env);
      const couchDbConfig = getTestCouchDbConfig(env);
      
      // Generate the same database name that the auth server will use
      const testDbName = `${couchDbConfig.dbName}_api_${this.testApiKey}`;
      
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
      const { validateEnv, getTestCouchDbConfig } = await import('@eddo/shared');
      const nano = await import('nano');
      
      const env = validateEnv(process.env);
      const couchDbConfig = getTestCouchDbConfig(env);
      const couch = nano.default(couchDbConfig.url);
      const db = couch.db.use(couchDbConfig.dbName);
      
      // Get all documents excluding design documents
      const allDocs = await db.list({ include_docs: false });
      const todoIds = allDocs.rows
        .filter(row => !row.id.startsWith('_design/'))
        .map(row => ({ id: row.id, rev: row.value.rev }));
      
      if (todoIds.length > 0) {
        console.log(`🔧 Force deleting ${todoIds.length} remaining documents`);
        
        // Bulk delete all non-design documents
        const docsToDelete = todoIds.map(doc => ({
          _id: doc.id,
          _rev: doc.rev,
          _deleted: true,
        }));
        
        await db.bulk({ docs: docsToDelete });
        console.log('✅ Force cleanup completed');
      }
    } catch (error) {
      console.error('❌ Force cleanup failed:', error);
      throw error;
    }
  }


  private async waitForServerToRecognizeCleanDatabase(): Promise<void> {
    // Brief wait to allow server to recognize the database reset
    await new Promise((resolve) => setTimeout(resolve, 200));
  }


  async waitForServer(
    maxAttempts: number = 20,
    delayMs: number = 500,
  ): Promise<void> {
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
