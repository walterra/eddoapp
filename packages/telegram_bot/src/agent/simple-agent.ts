import type { LlmService } from '../ai/llm-service.js';
import { llmService as defaultLlmService } from '../ai/llm-service.js';
import type { BotContext } from '../bot/bot.js';
import type { MCPClient } from '../mcp/client.js';
import { getMCPClient } from '../mcp/client.js';
import { logger, SpanAttributes, withSpan } from '../utils/logger.js';

import { initializeAgentState, persistAgentExchange } from './agent-session-state.js';
import {
  createAssistantChatHistoryStore,
  type AssistantChatHistoryStore,
} from './chat-history-store.js';
import { warnWhenContextIsLarge } from './context-budget.js';
import {
  extractConversationalPart,
  extractStatusMessage,
  getMCPSystemInfo,
  handleConversationalMessage,
  handleToolExecution,
  logFinalAgentState,
  parseToolCall,
  type AgentState,
} from './helpers/index.js';
import { buildSystemPrompt } from './system-prompt.js';
import { showTyping, startPeriodicTyping, stopPeriodicTyping } from './typing-indicator.js';

export type { AgentState } from './helpers/index.js';

export interface SimpleAgentConfig {
  /** Optional LLM service for dependency injection (used in testing) */
  llmService?: LlmService;
  /** Optional history store for dependency injection (used in testing) */
  historyStore?: AssistantChatHistoryStore;
}

/**
 * Context for agent iteration processing
 */
interface IterationContext {
  mcpClient: MCPClient;
  telegramContext: BotContext;
  systemPrompt: string;
}

export class SimpleAgent {
  private llmService: LlmService;
  private historyStore: AssistantChatHistoryStore;

  constructor(config: SimpleAgentConfig = {}) {
    this.llmService = config.llmService ?? defaultLlmService;
    this.historyStore = config.historyStore ?? createAssistantChatHistoryStore();
  }

  private getMCPClientOrThrow(): MCPClient {
    const client = getMCPClient();
    if (!client) {
      throw new Error(
        'MCP client not initialized. Please ensure MCP is initialized at bot startup.',
      );
    }
    return client;
  }

  async execute(
    userMessage: string,
    userId: string,
    telegramContext: BotContext,
  ): Promise<{
    success: boolean;
    finalResponse?: string;
    error?: Error;
    toolResults?: Array<{ toolName: string; result: unknown; timestamp: number }>;
  }> {
    return withSpan(
      'agent_execute',
      {
        [SpanAttributes.USER_ID]: userId,
        'message.length': userMessage.length,
      },
      async (span) => {
        const startTime = Date.now();

        logger.info('Starting simple agent execution', {
          userId,
          messageLength: userMessage.length,
        });

        try {
          const result = await this.agentLoop(userMessage, telegramContext);
          const duration = Date.now() - startTime;

          span.setAttribute(SpanAttributes.AGENT_TOOL_CALLS, result.toolResults.length);
          span.setAttribute('response.length', result.response.length);

          logger.info('Simple agent completed successfully', {
            userId,
            duration,
            responseLength: result.response.length,
          });

          return {
            success: true,
            finalResponse: result.response,
            toolResults: result.toolResults,
          };
        } catch (error) {
          return this.handleExecutionError(error, userId, startTime, telegramContext);
        }
      },
    );
  }

  private async handleExecutionError(
    error: unknown,
    userId: string,
    startTime: number,
    telegramContext: BotContext,
  ): Promise<{ success: boolean; error: Error }> {
    const duration = Date.now() - startTime;
    logger.error('Simple agent failed', {
      error: error instanceof Error ? error.message : String(error),
      userId,
      duration,
    });

    try {
      await telegramContext.reply(
        '❌ Sorry, I encountered an error processing your request. Please try again.',
      );
    } catch (replyError) {
      logger.error('Failed to send error message to user', { replyError });
    }

    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }

  private async agentLoop(
    userInput: string,
    telegramContext: BotContext,
  ): Promise<{
    response: string;
    toolResults: Array<{ toolName: string; result: unknown; timestamp: number }>;
  }> {
    const mcpClient = this.getMCPClientOrThrow();
    const typingInterval = startPeriodicTyping(telegramContext);

    try {
      const state = await initializeAgentState(this.historyStore, userInput, telegramContext);
      const systemPrompt = await this.buildSystemPromptWithMCPInfo(mcpClient, telegramContext);
      state.systemPrompt = systemPrompt;
      await warnWhenContextIsLarge(telegramContext, state, systemPrompt);

      const iterationContext: IterationContext = { mcpClient, telegramContext, systemPrompt };
      const result = await this.runAgentIterations(state, iterationContext);
      await persistAgentExchange({
        historyStore: this.historyStore,
        telegramContext,
        state,
        userInput,
        assistantResponse: result.response,
      });
      return result;
    } finally {
      stopPeriodicTyping(typingInterval);
    }
  }

  private async buildSystemPromptWithMCPInfo(
    mcpClient: MCPClient,
    telegramContext: BotContext,
  ): Promise<string> {
    const mcpSystemInfo = await getMCPSystemInfo(mcpClient, telegramContext);
    const tools = mcpClient.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
    }));
    return buildSystemPrompt(mcpSystemInfo, tools);
  }

  private async runAgentIterations(
    state: AgentState,
    context: IterationContext,
  ): Promise<{
    response: string;
    toolResults: Array<{ toolName: string; result: unknown; timestamp: number }>;
  }> {
    const maxIterations = 50;
    let iteration = 0;

    while (!state.done && iteration < maxIterations) {
      iteration++;
      await this.processIteration(state, context, iteration);
    }

    await logFinalAgentState(state, iteration);

    if (iteration >= maxIterations) {
      logger.warn('Agent loop reached max iterations', { maxIterations });
      return {
        response:
          state.history[state.history.length - 1]?.content ||
          'Process completed but exceeded maximum iterations.',
        toolResults: state.toolResults,
      };
    }

    return {
      response: state.output || 'Process completed successfully.',
      toolResults: state.toolResults,
    };
  }

  private async processIteration(
    state: AgentState,
    context: IterationContext,
    iteration: number,
  ): Promise<void> {
    return withSpan(
      'agent_iteration',
      { [SpanAttributes.AGENT_ITERATION]: iteration },
      async (span) => {
        const { telegramContext, systemPrompt } = context;
        const iterationId = `iter_${Date.now()}_${iteration}`;

        this.logIterationStart(state, iteration, iterationId, context);
        await showTyping(telegramContext);

        const llmResponse = await this.llmService.generateResponse(
          state.history,
          systemPrompt,
          state.cacheSessionId,
        );
        state.history.push({ role: 'assistant', content: llmResponse, timestamp: Date.now() });

        const toolCall = parseToolCall(llmResponse);

        if (toolCall) {
          span.setAttribute(SpanAttributes.MCP_TOOL, toolCall.name);
          await this.handleToolCallResponse(toolCall, llmResponse, state, {
            ...context,
            iterationId,
          });
        } else {
          await this.handleFinalResponse(llmResponse, state, telegramContext, iterationId);
        }
      },
    );
  }

  private async handleToolCallResponse(
    toolCall: ReturnType<typeof parseToolCall>,
    llmResponse: string,
    state: AgentState,
    context: IterationContext & { iterationId: string },
  ): Promise<void> {
    const { mcpClient, telegramContext, iterationId } = context;
    const statusMessage = extractStatusMessage(llmResponse);

    if (statusMessage) {
      logger.debug('📝 Extracted STATUS message for intermediate feedback', {
        iterationId,
        statusMessage,
      });
      await handleConversationalMessage(
        telegramContext,
        { text: statusMessage, isMarkdown: false },
        iterationId,
      );
    }

    await handleToolExecution(toolCall!, state, { telegramContext, mcpClient, iterationId });
  }

  private async handleFinalResponse(
    llmResponse: string,
    state: AgentState,
    telegramContext: BotContext,
    iterationId: string,
  ): Promise<void> {
    const conversationalPart = extractConversationalPart(llmResponse);

    if (conversationalPart) {
      logger.debug('📝 Extracted conversational part (final response)', {
        iterationId,
        hasConversationalPart: true,
        textLength: conversationalPart.text.length,
        isMarkdown: conversationalPart.isMarkdown,
      });
      await handleConversationalMessage(telegramContext, conversationalPart, iterationId);
    }

    logger.info('🏁 Agent Decision: Complete', {
      iterationId,
      reasoning: 'LLM provided final response without tool call',
      responsePreview: llmResponse.substring(0, 200) + '...',
    });
    state.done = true;
    state.output = llmResponse;
  }

  private logIterationStart(
    state: AgentState,
    iteration: number,
    iterationId: string,
    context: IterationContext,
  ): void {
    const { mcpClient, systemPrompt } = context;

    logger.info('🔄 Agent Loop Iteration', {
      iterationId,
      iteration,
      maxIterations: 50,
      currentState: {
        historyEntries: state.history.length,
        toolResultsCount: state.toolResults.length,
        done: state.done,
      },
    });

    const conversationHistory = state.history
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join('\n');

    logger.info('📤 Sending to LLM', {
      iterationId,
      systemPromptPreview: systemPrompt.substring(0, 200) + '...',
      conversationPreview: conversationHistory.substring(0, 300) + '...',
      availableTools: mcpClient.tools.map((t) => t.name),
    });
  }

  async getStatus(): Promise<{ version: string; mcpToolsAvailable: number }> {
    const mcpClient = getMCPClient();
    return {
      version: '3.0.0-simple',
      mcpToolsAvailable: mcpClient?.tools.length || 0,
    };
  }
}
