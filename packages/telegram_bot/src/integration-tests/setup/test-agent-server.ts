/**
 * Test Agent Server
 * Manages agent test environment for integration tests
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import { createTestUserRegistry, getUserDatabaseName, validateEnv } from '@eddo/core-server';
import type { Context } from 'grammy';
import { vi } from 'vitest';

import { SimpleAgent } from '../../agent/simple-agent.js';
import type { MCPClient } from '../../mcp/client.js';
import { setupMCPIntegration } from '../../mcp/client.js';
import {
  createCachedClaudeService,
  createCassetteManager,
  type CassetteManager,
  type RecordMode,
  type TimeController,
} from '../vcr/index.js';
import {
  buildMockContext,
  buildTestUserPreferences,
  buildUserRegistryEntry,
  ensureRegistryApiKey,
  generateTestApiKey,
  generateTestUserData,
  setupUserDatabase,
  type TestUser,
} from './test-agent-server-helpers.js';

export interface TestAgentServerConfig {
  mcpServerUrl?: string;
  llmModel?: string;
  mockTelegramResponses?: boolean;
  /** VCR recording mode: 'auto' (default), 'record', or 'playback' */
  vcrMode?: RecordMode;
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
  private cassetteManager: CassetteManager | null = null;
  private currentTestName: string | null = null;

  constructor(config: TestAgentServerConfig = {}) {
    const testPort = process.env.MCP_SERVER_PORT || '3001';
    const vcrMode = (process.env.VCR_MODE as RecordMode) || config.vcrMode || 'auto';

    this.config = {
      mcpServerUrl:
        config.mcpServerUrl || process.env.MCP_SERVER_URL || `http://localhost:${testPort}/mcp`,
      llmModel: config.llmModel || 'claude-3-5-haiku-20241022',
      mockTelegramResponses: config.mockTelegramResponses ?? true,
      vcrMode,
    };

    // Generate unique test API key for database isolation
    this.testApiKey = generateTestApiKey();

    // Time controller for freezing time during cassette replay
    const timeController: TimeController = {
      freeze: (isoTime: string) => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(isoTime));
      },
      unfreeze: () => {
        vi.useRealTimers();
      },
    };

    // Initialize cassette manager for VCR-style caching
    // Use __dirname to get path relative to this file, not cwd (which varies between local/CI)
    const cassettesDir = join(__dirname, '..', 'cassettes');
    this.cassetteManager = createCassetteManager(
      {
        cassettesDir,
        mode: this.config.vcrMode,
      },
      timeController,
    );
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

    // Initialize agent with cached Claude service
    const cachedClaudeService = createCachedClaudeService({
      cassetteManager: this.cassetteManager!,
      model: this.config.llmModel,
    });

    this.agent = new SimpleAgent({ claudeService: cachedClaudeService });
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

    if (userRegistry.setupDatabase) {
      await userRegistry.setupDatabase();
    }

    const apiKeySetAt = new Date().toISOString();
    const preferences = buildTestUserPreferences(undefined, this.testApiKey, apiKeySetAt);
    this.testUser = generateTestUserData(preferences);
    this.testUser.database_name = getUserDatabaseName(env, this.testUser.username);

    const existingUser = await userRegistry.findByUsername(this.testUser.username);
    const registryUser =
      existingUser ?? (await userRegistry.create(buildUserRegistryEntry(this.testUser)));

    await ensureRegistryApiKey(userRegistry, registryUser, this.testApiKey, apiKeySetAt);
    await setupUserDatabase(couchDbUrl, this.testUser.database_name);
  }

  async stop(): Promise<void> {
    // Save cassette if recording
    if (this.cassetteManager) {
      this.cassetteManager.ejectCassette();
    }

    if (this.mcpClient) {
      await this.mcpClient.close();
      this.mcpClient = null;
    }
    this.agent = null;
  }

  /**
   * Set the cassette name for VCR recording/playback
   * Call this before executing agent for each test
   */
  loadCassette(testName: string): void {
    if (!this.cassetteManager) {
      throw new Error('Cassette manager not initialized');
    }
    this.currentTestName = testName;
    this.cassetteManager.loadCassette(testName);
  }

  /**
   * Get the current VCR mode
   */
  getVcrMode(): RecordMode {
    return this.config.vcrMode;
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
    return buildMockContext(this.testUser);
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
   * Get the user's database name for direct database access
   */
  getUserDatabaseName(): string {
    if (!this.testUser) {
      throw new Error('Test user not created. Call start() first.');
    }
    return this.testUser.database_name;
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
