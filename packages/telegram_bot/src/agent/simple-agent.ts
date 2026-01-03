import type { ClaudeService } from '../ai/claude.js';
import { claudeService as defaultClaudeService } from '../ai/claude.js';
import type { BotContext } from '../bot/bot.js';
import type { MCPClient } from '../mcp/client.js';
import { getMCPClient } from '../mcp/client.js';
import { logger } from '../utils/logger.js';

import {
  type AgentState,
  extractConversationalPart,
  extractStatusMessage,
  getMCPSystemInfo,
  handleConversationalMessage,
  handleToolExecution,
  logFinalAgentState,
  parseToolCall,
} from './helpers/index.js';
import { buildSystemPrompt } from './system-prompt.js';

export type { AgentState } from './helpers/index.js';

export interface SimpleAgentConfig {
  /** Optional Claude service for dependency injection (used in testing) */
  claudeService?: ClaudeService;
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
  private claudeService: ClaudeService;

  constructor(config: SimpleAgentConfig = {}) {
    this.claudeService = config.claudeService ?? defaultClaudeService;
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
    const startTime = Date.now();

    logger.info('Starting simple agent execution', {
      userId,
      messageLength: userMessage.length,
    });

    try {
      const result = await this.agentLoop(userMessage, telegramContext);
      const duration = Date.now() - startTime;

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
    const typingInterval = this.startPeriodicTyping(telegramContext);

    const state = this.initializeState(userInput);
    const systemPrompt = await this.buildSystemPromptWithMCPInfo(mcpClient, telegramContext);
    state.systemPrompt = systemPrompt;

    const iterationContext: IterationContext = { mcpClient, telegramContext, systemPrompt };
    const result = await this.runAgentIterations(state, iterationContext);

    this.stopPeriodicTyping(typingInterval);

    return result;
  }

  private initializeState(userInput: string): AgentState {
    return {
      input: userInput,
      history: [{ role: 'user', content: userInput, timestamp: Date.now() }],
      done: false,
      toolResults: [],
    };
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
    const { mcpClient, telegramContext, systemPrompt } = context;
    const iterationId = `iter_${Date.now()}_${iteration}`;

    this.logIterationStart(state, iteration, iterationId, context);

    await this.showTyping(telegramContext);

    const llmResponse = await this.claudeService.generateResponse(state.history, systemPrompt);
    state.history.push({ role: 'assistant', content: llmResponse, timestamp: Date.now() });

    const toolCall = parseToolCall(llmResponse);

    if (toolCall) {
      // Tool call present - check for STATUS message to show user
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

      // Execute tool (no other content sent - prevents hallucination)
      await handleToolExecution(toolCall, state, { telegramContext, mcpClient, iterationId });
    } else {
      // No tool call - this is the final response, send to user
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

  private async showTyping(telegramContext: BotContext): Promise<void> {
    try {
      await telegramContext.replyWithChatAction('typing');
    } catch (error) {
      logger.debug('Failed to show typing indicator', { error });
    }
  }

  private startPeriodicTyping(telegramContext: BotContext): NodeJS.Timeout {
    return setInterval(async () => {
      await this.showTyping(telegramContext);
    }, 4000);
  }

  private stopPeriodicTyping(interval: NodeJS.Timeout): void {
    clearInterval(interval);
  }

  async getStatus(): Promise<{ version: string; mcpToolsAvailable: number }> {
    const mcpClient = getMCPClient();
    return {
      version: '3.0.0-simple',
      mcpToolsAvailable: mcpClient?.tools.length || 0,
    };
  }
}
