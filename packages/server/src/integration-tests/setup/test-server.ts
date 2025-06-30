/**
 * MCP Test Server Harness
 * Provides a reusable test environment for integration testing
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

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

  constructor(config: MCPTestServerConfig = {}) {
    this.config = {
      serverUrl:
        config.serverUrl ||
        process.env.MCP_TEST_URL ||
        'http://localhost:3003/mcp',
      clientName: config.clientName || 'integration-test-client',
      clientVersion: config.clientVersion || '1.0.0',
      timeout: config.timeout || 30000,
    };
  }

  async start(): Promise<void> {
    if (this.client) {
      throw new Error('Test server already started');
    }

    // Create transport
    this.transport = new StreamableHTTPClientTransport(
      new URL(this.config.serverUrl),
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
        try {
          return JSON.parse(textContent.text);
        } catch {
          return textContent.text;
        }
      }
    }

    return result;
  }

  async resetTestData(): Promise<void> {
    // Clear all todos from test database
    try {
      const todos = await this.callTool('listTodos', {});
      if (Array.isArray(todos)) {
        for (const todo of todos) {
          await this.callTool('deleteTodo', { id: todo._id });
        }
      }
    } catch (error) {
      console.warn('Warning: Failed to reset test data:', error);
    }
  }

  async waitForServer(
    maxAttempts: number = 10,
    delayMs: number = 1000,
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
