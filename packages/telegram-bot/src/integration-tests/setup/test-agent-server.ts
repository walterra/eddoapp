/**
 * Test Agent Server
 * Manages agent test environment for integration tests
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Context } from 'grammy';
import { vi } from 'vitest';

import { SimpleAgent } from '../../agent/simple-agent.js';
import { setupMCPIntegration } from '../../mcp/client.js';
import type { MCPClient } from '../../mcp/client.js';

export interface TestAgentServerConfig {
  mcpServerUrl?: string;
  llmModel?: string;
  mockTelegramResponses?: boolean;
}

// Define session data structure for compatibility
interface SessionData {
  userId: string;
  conversationId?: string;
  lastActivity: Date;
  context: Record<string, unknown>;
  lastBotMessage?: string;
}

// Extend the context with session data to match BotContext
type BotContext = Context & {
  session: SessionData;
};

export interface MockTelegramContext {
  replies: string[];
  chatActions: string[];
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
  session?: SessionData;
}

export class TestAgentServer {
  private agent: SimpleAgent | null = null;
  private mcpClient: MCPClient | null = null;
  private config: Required<TestAgentServerConfig>;
  private testApiKey: string;

  constructor(config: TestAgentServerConfig = {}) {
    const testPort = process.env.MCP_TEST_PORT || '3003';

    this.config = {
      mcpServerUrl:
        config.mcpServerUrl ||
        process.env.MCP_TEST_URL ||
        `http://localhost:${testPort}/mcp`,
      llmModel: config.llmModel || 'claude-3-5-haiku-20241022',
      mockTelegramResponses: config.mockTelegramResponses ?? true,
    };

    // Generate unique test API key for database isolation
    this.testApiKey = `agent-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  async start(): Promise<void> {
    if (this.agent) {
      throw new Error('Test agent server already started');
    }

    // Set up environment variables for MCP client
    process.env.MCP_SERVER_URL = this.config.mcpServerUrl;
    process.env.MCP_API_KEY = this.testApiKey;
    process.env.TELEGRAM_BOT_TOKEN =
      process.env.TELEGRAM_BOT_TOKEN || 'test-token';
    process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-key';

    // Initialize MCP integration
    this.mcpClient = await setupMCPIntegration();

    // Initialize agent
    this.agent = new SimpleAgent();
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
   * Create a mock Telegram context for testing
   */
  createMockContext(): MockTelegramContext {
    const replies: string[] = [];
    const chatActions: string[] = [];

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
        id: 12345,
        is_bot: false,
        first_name: 'Test',
        username: 'testuser',
      },
      chat: {
        id: 12345,
        type: 'private',
        first_name: 'Test',
        username: 'testuser',
      },
      message: {
        message_id: 1,
        date: Date.now(),
        chat: {
          id: 12345,
          type: 'private',
          first_name: 'Test',
          username: 'testuser',
        },
        from: {
          id: 12345,
          is_bot: false,
          first_name: 'Test',
          username: 'testuser',
        },
        text: '',
      },
      session: {
        userId: 'test-user',
        lastActivity: new Date(),
        context: {},
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
      const result = await agent.execute(
        input,
        userId,
        mockContext as unknown as BotContext,
      );
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
  async listTools(): Promise<
    Array<{ name: string; description: string; inputSchema: unknown }>
  > {
    const client = this.getMCPClient();
    return client.tools.map((tool) => ({
      name: tool.name,
      description: tool.description || '',
      inputSchema: tool.inputSchema,
    }));
  }
}
