import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

import { claudeService } from '../ai/claude.js';
import type { BotContext } from '../bot/bot.js';
import { getMCPClient } from '../mcp/client.js';
import { logger } from '../utils/logger.js';
import {
  hasMarkdownFormatting,
  validateTelegramMarkdown,
} from '../utils/markdown.js';
import { buildSystemPrompt } from './system-prompt.js';

interface AgentState {
  input: string;
  history: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
  }>;
  done: boolean;
  output?: string;
  toolResults: Array<{ toolName: string; result: unknown; timestamp: number }>;
}

interface ToolCall {
  name: string;
  parameters: Record<string, unknown>;
}

export class SimpleAgent {
  constructor() {
    // MCP client is initialized at bot startup, not here
  }

  private getMCPClientOrThrow() {
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
  ): Promise<{ success: boolean; finalResponse?: string; error?: Error }> {
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
        responseLength: result.length,
      });

      return {
        success: true,
        finalResponse: result,
      };
    } catch (error) {
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
  }

  private async agentLoop(
    userInput: string,
    telegramContext: BotContext,
  ): Promise<string> {
    // Get MCP client (initialized at bot startup)
    const mcpClient = this.getMCPClientOrThrow();

    // Start periodic typing for long operations
    const typingInterval = this.startPeriodicTyping(telegramContext);

    const state: AgentState = {
      input: userInput,
      history: [
        {
          role: 'user',
          content: userInput,
          timestamp: Date.now(),
        },
      ],
      done: false,
      toolResults: [],
    };

    const maxIterations = 10;
    let iteration = 0;

    while (!state.done && iteration < maxIterations) {
      iteration++;
      const iterationId = `iter_${Date.now()}_${iteration}`;

      logger.info('🔄 Agent Loop Iteration', {
        iterationId,
        iteration,
        maxIterations,
        currentState: {
          historyEntries: state.history.length,
          toolResultsCount: state.toolResults.length,
          done: state.done,
        },
      });

      const systemPrompt = buildSystemPrompt(mcpClient.tools);
      const conversationHistory = state.history
        .map((msg) => `${msg.role}: ${msg.content}`)
        .join('\n');

      logger.info('📤 Sending to LLM', {
        iterationId,
        systemPromptPreview: systemPrompt.substring(0, 200) + '...',
        conversationPreview: conversationHistory.substring(0, 300) + '...',
        availableTools: mcpClient.tools.map((t) => t.name),
      });

      // Show typing before LLM call
      await this.showTyping(telegramContext);

      const llmResponse = await claudeService.generateResponse(
        conversationHistory,
        systemPrompt,
      );

      state.history.push({
        role: 'assistant',
        content: llmResponse,
        timestamp: Date.now(),
      });

      // Check if LLM wants to use a tool
      const toolCall = this.parseToolCall(llmResponse);

      // Extract conversational part (before TOOL_CALL:) and send to Telegram
      const conversationalPart = this.extractConversationalPart(llmResponse);
      if (conversationalPart) {
        try {
          const replyOptions = conversationalPart.isMarkdown
            ? { parse_mode: 'Markdown' as const }
            : {};

          await telegramContext.reply(conversationalPart.text, replyOptions);
        } catch (error) {
          logger.debug('Failed to send conversational part', { error });

          // If markdown parsing failed, retry without markdown
          if (conversationalPart.isMarkdown) {
            try {
              await telegramContext.reply(conversationalPart.text);
            } catch (fallbackError) {
              logger.debug('Failed to send fallback message', {
                fallbackError,
              });
            }
          }
        }
      }

      if (toolCall) {
        logger.info('🔧 Agent Decision: Tool Call', {
          iterationId,
          toolName: toolCall.name,
          parameters: toolCall.parameters,
          reasoning: 'LLM decided to use a tool based on the current context',
        });

        try {
          const toolResult = await this.executeTool(toolCall, telegramContext);
          state.toolResults.push({
            toolName: toolCall.name,
            result: toolResult,
            timestamp: Date.now(),
          });

          logger.info('✅ Tool Execution Success', {
            iterationId,
            toolName: toolCall.name,
            resultPreview: JSON.stringify(toolResult).substring(0, 200) + '...',
          });

          // Add tool result to conversation history
          state.history.push({
            role: 'user',
            content: `Tool "${toolCall.name}" executed successfully. Result: ${JSON.stringify(toolResult)}`,
            timestamp: Date.now(),
          });
        } catch (error) {
          logger.error('❌ Tool Execution Failed', {
            iterationId,
            toolName: toolCall.name,
            error: error instanceof Error ? error.message : String(error),
          });

          state.history.push({
            role: 'user',
            content: `Tool "${toolCall.name}" failed: ${error instanceof Error ? error.message : String(error)}`,
            timestamp: Date.now(),
          });
        }
      } else {
        logger.info('🏁 Agent Decision: Complete', {
          iterationId,
          reasoning: 'LLM provided final response without tool call',
          responsePreview: llmResponse.substring(0, 200) + '...',
        });

        // No tool call, agent is done
        state.done = true;
        state.output = llmResponse;
      }
    }

    // Stop periodic typing when done
    this.stopPeriodicTyping(typingInterval);

    // Log final AgentState to disk
    await this.logFinalAgentState(state, iteration);

    if (iteration >= maxIterations) {
      logger.warn('Agent loop reached max iterations', { maxIterations });
      return (
        state.history[state.history.length - 1]?.content ||
        'Process completed but exceeded maximum iterations.'
      );
    }

    return state.output || 'Process completed successfully.';
  }

  private async logFinalAgentState(
    state: AgentState,
    iteration: number,
  ): Promise<void> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const logDir = join(process.cwd(), 'logs', 'agent-states');
      const filename = `agent-state-${timestamp}-iter${iteration}.json`;
      const filepath = join(logDir, filename);

      await mkdir(logDir, { recursive: true });

      const logData = {
        timestamp: new Date().toISOString(),
        iteration,
        finalState: state,
        metadata: {
          totalHistoryEntries: state.history.length,
          totalToolResults: state.toolResults.length,
          completed: state.done,
          hasOutput: !!state.output,
        },
      };

      await writeFile(filepath, JSON.stringify(logData, null, 2));

      logger.info('Final AgentState logged to disk', {
        filepath,
        iteration,
        historyEntries: state.history.length,
        toolResults: state.toolResults.length,
      });
    } catch (error) {
      logger.error('Failed to log final AgentState to disk', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private parseToolCall(response: string): ToolCall | null {
    const toolCallMatch = response.match(/TOOL_CALL:\s*({.*})/);
    if (!toolCallMatch) {
      return null;
    }

    try {
      return JSON.parse(toolCallMatch[1]) as ToolCall;
    } catch (error) {
      logger.error('Failed to parse tool call', { response, error });
      return null;
    }
  }

  private extractConversationalPart(
    response: string,
  ): { text: string; isMarkdown: boolean } | null {
    // Remove any lines that start with TOOL_CALL
    const conversationalPart = response
      .split('\n')
      .filter((line) => !line.trim().startsWith('TOOL_CALL'))
      .join('\n')
      .replace(/[ \t]+/g, ' ') // Only collapse spaces and tabs, preserve newlines
      .replace(/\n\s*\n/g, '\n') // Remove extra blank lines but keep single newlines
      .trim();

    if (!conversationalPart) {
      return null;
    }

    // Check if the text has markdown formatting and validate it
    const hasMarkdown = hasMarkdownFormatting(conversationalPart);
    let isValidMarkdown = false;

    if (hasMarkdown) {
      const validation = validateTelegramMarkdown(conversationalPart);
      isValidMarkdown = validation.isValid;

      if (!isValidMarkdown) {
        logger.debug('Invalid markdown detected in conversational part', {
          error: validation.error,
          text: conversationalPart.substring(0, 100) + '...',
        });
      }
    }

    return {
      text: conversationalPart,
      isMarkdown: hasMarkdown && isValidMarkdown,
    };
  }

  private async executeTool(
    toolCall: ToolCall,
    _telegramContext: BotContext,
  ): Promise<unknown> {
    const mcpClient = this.getMCPClientOrThrow();

    const tool = mcpClient.tools.find((t) => t.name === toolCall.name);
    if (!tool) {
      throw new Error(`Tool not found: ${toolCall.name}`);
    }

    logger.info('Executing tool', {
      toolName: tool.name,
      parameters: toolCall.parameters,
    });

    const result = await mcpClient.invoke(tool.name, toolCall.parameters);

    return result;
  }

  private async showTyping(telegramContext: BotContext): Promise<void> {
    try {
      await telegramContext.replyWithChatAction('typing');
    } catch (error) {
      logger.debug('Failed to show typing indicator', { error });
    }
  }

  private startPeriodicTyping(telegramContext: BotContext): NodeJS.Timeout {
    // Telegram chat actions last ~5 seconds, so refresh every 4 seconds
    return setInterval(async () => {
      await this.showTyping(telegramContext);
    }, 4000);
  }

  private stopPeriodicTyping(interval: NodeJS.Timeout): void {
    clearInterval(interval);
  }

  async getStatus(): Promise<{
    version: string;
    mcpToolsAvailable: number;
  }> {
    const mcpClient = getMCPClient();
    return {
      version: '3.0.0-simple',
      mcpToolsAvailable: mcpClient?.tools.length || 0,
    };
  }
}
