import { createModels, type Models } from '@earendil-works/pi-ai/models';
import { builtinModels } from '@earendil-works/pi-ai/providers/all';
import { MemoryStorage, type ModelRef } from '@earendil-works/pi-durable';
import { fileURLToPath } from 'node:url';
import { vi } from 'vitest';
import { resolveConfiguredModel } from '../../ai/llm-model-resolution.js';
import { projectDurableExchange } from '../../durable/projection.js';
import { buildDurablePrompt } from '../../durable/prompt.js';
import { openDurableRuntime, type DurableRuntime } from '../../durable/runtime.js';
import { resolveDurableUser } from '../../durable/tools.js';
import { setupMCPIntegration, type MCPClient } from '../../mcp/client.js';
import {
  createCachedProvider,
  createCassetteManager,
  type CassetteManager,
  type LlmRequestSnapshot,
  type RecordMode,
} from '../vcr/index.js';
import { conversationDatabase, createAgentTestUser } from './durable-agent-helpers.js';
import {
  buildMockContext,
  generateTestApiKey,
  type TestUser,
} from './test-agent-server-helpers.js';

export type { LlmRequestSnapshot } from '../vcr/index.js';
export interface TestAgentServerConfig {
  sourceModels?: Models;
  cassettesDir?: string;
  mcpServerUrl?: string;
  llmModel?: string;
  vcrMode?: RecordMode;
}
export interface MockTelegramContext {
  replies: string[];
  chatActions: string[];
  toolResults?: Array<{ toolName: string; result: unknown; timestamp: number }>;
  reply: (text: string) => Promise<unknown>;
  replyWithChatAction: (action: string) => Promise<unknown>;
  from?: { id: number; is_bot: boolean; first_name: string; username?: string };
  chat?: { id: number; type: string; first_name?: string; username?: string };
  message?: { message_id: number; date: number; chat: unknown; from: unknown; text: string };
  session?: {
    userId: string;
    conversationId?: string;
    lastActivity: Date;
    context: Record<string, unknown>;
    user?: TestUser;
  };
}
interface TestAgentState {
  user: TestUser | null;
  runtime: DurableRuntime | null;
  mcp: MCPClient | null;
  context: MockTelegramContext | null;
  requests: LlmRequestSnapshot[];
  testName: string;
  sequence: number;
}
interface AgentExecutionResult {
  success: boolean;
  message: string;
  context: MockTelegramContext;
}

/** Builds a native model collection whose only generation boundary is the cassette adapter. */
function cachedModels(config: TestAgentServerConfig, state: TestAgentState): ModelsAndCassettes {
  const source = config.sourceModels ?? builtinModels();
  const model = resolveConfiguredModel(
    config.llmModel || process.env.LLM_MODEL || 'claude-sonnet-4-5-20250929',
    source,
  );
  const provider = source.getProvider(model.provider)!;
  const cassettes = createCassetteManager(
    {
      cassettesDir:
        config.cassettesDir ?? fileURLToPath(new URL('../cassettes/durable', import.meta.url)),
      namespace: `${model.provider}/${model.modelId}`,
      mode: config.vcrMode || (process.env.VCR_MODE as RecordMode) || 'auto',
    },
    {
      freeze: (time) => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date(time));
      },
      unfreeze: () => vi.useRealTimers(),
    },
  );
  const models = createModels();
  models.setProvider(
    createCachedProvider({
      source,
      provider,
      cassetteManager: cassettes,
      onRequest: (request) => state.requests.push(request),
    }),
  );
  return { models, model, cassettes };
}
interface ModelsAndCassettes {
  models: Models;
  model: ModelRef;
  cassettes: CassetteManager;
}

/** Opens the production Durable runtime against real MCP tools and real chat projection storage. */
async function startRuntime(state: TestAgentState, cached: ModelsAndCassettes): Promise<void> {
  const user = state.user!;
  const original = await setupMCPIntegration();
  state.mcp = {
    ...original,
    invoke: async (name, args, identity) => {
      const result = await original.invoke(name, args, identity);
      state.context?.toolResults?.push({ toolName: name, result, timestamp: Date.now() });
      return result;
    },
  };
  state.runtime = await openDurableRuntime({
    storage: new MemoryStorage(),
    models: cached.models,
    client: state.mcp,
    username: user.username,
    telegramId: user.telegram_id,
    model: cached.model,
    instructions: buildDurablePrompt('gtd_coach'),
    authorize: () => resolveDurableUser(user.username, user.telegram_id),
    send: async (_chatId, text) => {
      await state.context!.reply(text);
    },
    project: (input, answer) => projectDurableExchange({ username: user.username, input, answer }),
    onReport: (error) => console.error('Durable test runtime report:', error),
  });
}

/** Executes through the real Harness; no text-protocol parser or alternate agent loop exists. */
async function execute(
  state: TestAgentState,
  input: string,
  context?: MockTelegramContext,
): Promise<AgentExecutionResult> {
  if (!state.user || !state.runtime) throw new Error('Test agent not started');
  const ctx = context ?? buildMockContext(state.user);
  state.context = ctx;
  ctx.toolResults ??= [];
  await ctx.replyWithChatAction('typing');
  const conversation = await (await conversationDatabase(state.user)).getOrCreateActive();
  try {
    const message = await state.runtime.execute({
      requestId: `vcr:${state.testName}:${++state.sequence}`,
      text: input,
      conversationId: conversation._id,
      chatId: state.user.telegram_id,
      telegramId: state.user.telegram_id,
      messageId: state.sequence,
      createdAt: new Date().toISOString(),
      deadline: Date.now() + 300_000,
    });
    return { success: true, message, context: ctx };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error),
      context: ctx,
    };
  }
}

/** Checks full replay consumption and closes both runtime and MCP resources. */
async function stopRuntime(state: TestAgentState, cassettes: CassetteManager): Promise<void> {
  try {
    await state.runtime?.close();
    cassettes.assertConsumed();
  } finally {
    cassettes.ejectCassette();
    await state.mcp?.close();
    state.runtime = null;
  }
}

/** Preserves the behavioral suite's test-server API while replacing SimpleAgent with Durable. */
export function createTestAgentServer(config: TestAgentServerConfig = {}) {
  const state: TestAgentState = {
    user: null,
    runtime: null,
    mcp: null,
    context: null,
    requests: [],
    testName: '',
    sequence: 0,
  };
  const cached = cachedModels(config, state);
  const apiKey = generateTestApiKey();
  return {
    start: async (): Promise<void> => {
      if (state.runtime) throw new Error('Test agent server already started');
      if (config.mcpServerUrl) process.env.MCP_SERVER_URL = config.mcpServerUrl;
      state.user = await createAgentTestUser(apiKey);
      await startRuntime(state, cached);
    },
    stop: (): Promise<void> => stopRuntime(state, cached.cassettes),
    loadCassette: (name: string): void => {
      state.testName = name;
      state.sequence = 0;
      cached.cassettes.loadCassette(name);
    },
    getVcrMode: () => cached.cassettes.getMode(),
    getLlmRequests: () => state.requests,
    createMockContext: (): MockTelegramContext => {
      if (!state.user) throw new Error('Test user not created');
      return buildMockContext(state.user);
    },
    executeAgent: (input: string, _userId = 'test-user', context?: MockTelegramContext) =>
      execute(state, input, context),
    startNewConversation: async (): Promise<void> => {
      await (await conversationDatabase(state.user!)).startNewConversation();
    },
    getTestApiKey: () => apiKey,
    getUserDatabaseName: (): string => {
      if (!state.user) throw new Error('Test user not created');
      return state.user.database_name;
    },
  };
}
export type TestAgentServer = ReturnType<typeof createTestAgentServer>;
