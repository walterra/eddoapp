/**
 * Test Agent Server
 * Manages agent test environment for integration tests
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomBytes } from 'crypto';

import { createTestUserRegistry, validateEnv } from '@eddo/core-server';
import type { UserPreferences } from '@eddo/core-shared';
import type { Context } from 'grammy';
import nano from 'nano';
import { vi } from 'vitest';

import { SimpleAgent } from '../../agent/simple-agent.js';
import type { MCPClient } from '../../mcp/client.js';
import { setupMCPIntegration } from '../../mcp/client.js';

export interface TestAgentServerConfig {
  mcpServerUrl?: string;
  llmModel?: string;
  mockTelegramResponses?: boolean;
}

// Test user data structure matching the user registry (TelegramUser interface)
interface TestUser {
  _id: string;
  username: string;
  email: string;
  telegram_id: number;
  database_name: string;
  status: string;
  permissions: string[];
  created_at: string;
  updated_at: string;
  preferences: UserPreferences;
}

// Define session data structure for compatibility
interface SessionData {
  userId: string;
  conversationId?: string;
  lastActivity: Date;
  context: Record<string, unknown>;
  lastBotMessage?: string;
  user?: TestUser;
}

// Extend the context with session data to match BotContext
type BotContext = Context & {
  session: SessionData;
};

export interface MockTelegramContext {
  replies: string[];
  chatActions: string[];
  toolResults?: Array<{ toolName: string; result: unknown; timestamp: number }>;
  reply: (text: string) => Promise<any>;
  replyWithChatAction: (action: string) => Promise<any>;
  from?: {
    id: number;
    is_bot: boolean;
    first_name: string;
    username?: string;
  };
  chat?: {
    id: number;
    type: string;
    first_name?: string;
    username?: string;
  };
  message?: {
    message_id: number;
    date: number;
    chat: {
      id: number;
      type: string;
      first_name?: string;
      username?: string;
    };
    from: {
      id: number;
      is_bot: boolean;
      first_name: string;
      username?: string;
    };
    text: string;
  };
  session?: SessionData & {
    user?: TestUser;
  };
}

export class TestAgentServer {
  private agent: SimpleAgent | null = null;
  private mcpClient: MCPClient | null = null;
  private config: Required<TestAgentServerConfig>;
  private testApiKey: string;
  private testUser: TestUser | null = null;

  constructor(config: TestAgentServerConfig = {}) {
    const testPort = process.env.MCP_SERVER_PORT || '3001';

    this.config = {
      mcpServerUrl:
        config.mcpServerUrl || process.env.MCP_SERVER_URL || `http://localhost:${testPort}/mcp`,
      llmModel: config.llmModel || 'claude-3-5-haiku-20241022',
      mockTelegramResponses: config.mockTelegramResponses ?? true,
    };

    // Generate unique test API key for database isolation
    this.testApiKey = `agent-test-${Date.now()}-${randomBytes(9).toString('hex')}`;
  }

  async start(): Promise<void> {
    if (this.agent) {
      throw new Error('Test agent server already started');
    }

    // Set up environment variables for MCP client
    process.env.MCP_SERVER_URL = this.config.mcpServerUrl;
    process.env.MCP_API_KEY = this.testApiKey;
    process.env.TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || 'test-token';
    process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-key';

    // Create test user in the registry
    await this.createTestUser();

    // Initialize MCP integration
    this.mcpClient = await setupMCPIntegration();

    // Initialize agent
    this.agent = new SimpleAgent();
  }

  /**
   * Create a test user in the user registry and their database
   */
  private async createTestUser(): Promise<void> {
    const couchDbUrl = process.env.COUCHDB_URL;
    if (!couchDbUrl) {
      throw new Error('COUCHDB_URL not set - testcontainer setup may have failed');
    }

    const env = validateEnv(process.env);
    const userRegistry = await createTestUserRegistry(couchDbUrl, env);

    // Set up user registry database
    if (userRegistry.setupDatabase) {
      await userRegistry.setupDatabase();
    }

    // Create unique test user
    const timestamp = Date.now();
    const telegramId = 12345 + (randomBytes(2).readUInt16BE(0) % 10000);
    const username = `testuser_${timestamp}`;
    const databaseName = `eddo_test_user_${username}`;

    const now = new Date().toISOString();
    this.testUser = {
      _id: username,
      username,
      email: `${username}@test.example.com`,
      telegram_id: telegramId,
      database_name: databaseName,
      status: 'active',
      permissions: ['read', 'write'],
      created_at: now,
      updated_at: now,
      preferences: {
        dailyBriefing: false,
        briefingTime: '07:00',
        dailyRecap: false,
        recapTime: '18:00',
      },
    };

    // Check if user already exists
    const existingUser = await userRegistry.findByUsername(username);
    if (!existingUser) {
      await userRegistry.create({
        username,
        email: `${username}@test.example.com`,
        password_hash: 'test-hash',
        telegram_id: telegramId,
        permissions: ['read', 'write'],
        status: 'active',
        version: 'alpha2',
        database_name: databaseName,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        preferences: {
          dailyBriefing: false,
          briefingTime: '07:00',
          dailyRecap: false,
          recapTime: '18:00',
        },
      });
    }

    // Create the user's todo database
    const couch = nano(couchDbUrl);
    try {
      await couch.db.create(databaseName);
    } catch (err: any) {
      if (err.statusCode !== 412) {
        // 412 means database already exists
        throw err;
      }
    }
  }

  async stop(): Promise<void> {
    if (this.mcpClient) {
      await this.mcpClient.close();
      this.mcpClient = null;
    }
    this.agent = null;
  }

  getAgent(): SimpleAgent {
    if (!this.agent) {
      throw new Error('Test agent not started. Call start() first.');
    }
    return this.agent;
  }

  getMCPClient(): MCPClient {
    if (!this.mcpClient) {
      throw new Error('MCP client not initialized');
    }
    return this.mcpClient;
  }

  /**
   * Create a mock Telegram context for testing with proper user session
   */
  createMockContext(): MockTelegramContext {
    if (!this.testUser) {
      throw new Error('Test user not created. Call start() first.');
    }

    const replies: string[] = [];
    const chatActions: string[] = [];
    const telegramId = this.testUser.telegram_id;

    const mockContext: MockTelegramContext = {
      replies,
      chatActions,
      reply: vi.fn(async (text: string) => {
        replies.push(text);
        return {} as any;
      }),
      replyWithChatAction: vi.fn(async (action: string) => {
        chatActions.push(action);
        return true;
      }),
      from: {
        id: telegramId,
        is_bot: false,
        first_name: 'Test',
        username: this.testUser.username,
      },
      chat: {
        id: telegramId,
        type: 'private',
        first_name: 'Test',
        username: this.testUser.username,
      },
      message: {
        message_id: 1,
        date: Date.now(),
        chat: {
          id: telegramId,
          type: 'private',
          first_name: 'Test',
          username: this.testUser.username,
        },
        from: {
          id: telegramId,
          is_bot: false,
          first_name: 'Test',
          username: this.testUser.username,
        },
        text: '',
      },
      session: {
        userId: this.testUser.username,
        lastActivity: new Date(),
        context: {},
        // Include user data for MCP context extraction
        user: this.testUser,
      },
    };

    return mockContext;
  }

  /**
   * Execute agent with test input
   */
  async executeAgent(
    input: string,
    userId: string = 'test-user',
    context?: MockTelegramContext,
  ): Promise<{
    success: boolean;
    message: string;
    context: MockTelegramContext;
  }> {
    const agent = this.getAgent();
    const mockContext = context || this.createMockContext();

    try {
      const result = await agent.execute(input, userId, mockContext as unknown as BotContext);

      // Capture tool results in mock context
      if (result.toolResults) {
        mockContext.toolResults = result.toolResults;
      }

      return {
        success: result.success,
        message: result.finalResponse || 'Agent completed successfully',
        context: mockContext,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        context: mockContext,
      };
    }
  }

  /**
   * Get test API key for direct database access
   */
  getTestApiKey(): string {
    return this.testApiKey;
  }

  /**
   * List available MCP tools
   */
  async listTools(): Promise<Array<{ name: string; description: string; inputSchema: unknown }>> {
    const client = this.getMCPClient();
    return client.tools.map((tool) => ({
      name: tool.name,
      description: tool.description || '',
      inputSchema: tool.inputSchema,
    }));
  }
}
