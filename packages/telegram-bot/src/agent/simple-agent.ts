import { claudeService } from '../ai/claude.js';
import type { BotContext } from '../bot/bot.js';
import { setupMCPIntegration } from '../mcp/client.js';
import { getPersona } from '../ai/personas.js';
import { appConfig } from '../utils/config.js';
import { logger } from '../utils/logger.js';

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
  private mcpClient: Awaited<ReturnType<typeof setupMCPIntegration>> | null =
    null;
  private mcpInitialized = false;

  constructor() {
    // MCP initialization will be handled on first use
  }

  private async ensureMCPInitialized(): Promise<void> {
    if (this.mcpInitialized) {
      return;
    }

    try {
      this.mcpClient = await setupMCPIntegration();
      this.mcpInitialized = true;
      logger.info('MCP integration initialized', {
        toolCount: this.mcpClient?.tools.length || 0,
      });
    } catch (error) {
      logger.error('Failed to initialize MCP integration', { error });
      this.mcpInitialized = true; // Mark as attempted to avoid retry loops
    }
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
    // Ensure MCP is initialized before starting the agent loop
    await this.ensureMCPInitialized();

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
          done: state.done
        }
      });

      const systemPrompt = this.buildSystemPrompt();
      const conversationHistory = state.history
        .map((msg) => `${msg.role}: ${msg.content}`)
        .join('\n');

      logger.info('📤 Sending to LLM', {
        iterationId,
        systemPromptPreview: systemPrompt.substring(0, 200) + '...',
        conversationPreview: conversationHistory.substring(0, 300) + '...',
        availableTools: this.mcpClient?.tools.map((t) => t.name) || []
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

      if (toolCall) {
        logger.info('🔧 Agent Decision: Tool Call', { 
          iterationId,
          toolName: toolCall.name,
          parameters: toolCall.parameters,
          reasoning: 'LLM decided to use a tool based on the current context'
        });

        try {
          // Show appropriate action during tool execution
          await this.showAction(telegramContext, toolCall.name);
          
          const toolResult = await this.executeTool(toolCall, telegramContext);
          state.toolResults.push({
            toolName: toolCall.name,
            result: toolResult,
            timestamp: Date.now(),
          });

          logger.info('✅ Tool Execution Success', {
            iterationId,
            toolName: toolCall.name,
            resultPreview: JSON.stringify(toolResult).substring(0, 200) + '...'
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
          responsePreview: llmResponse.substring(0, 200) + '...'
        });
        
        // No tool call, agent is done
        state.done = true;
        state.output = llmResponse;
      }
    }

    // Stop periodic typing when done
    this.stopPeriodicTyping(typingInterval);

    if (iteration >= maxIterations) {
      logger.warn('Agent loop reached max iterations', { maxIterations });
      return (
        state.history[state.history.length - 1]?.content ||
        'Process completed but exceeded maximum iterations.'
      );
    }

    return state.output || 'Process completed successfully.';
  }

  private buildSystemPrompt(): string {
    const persona = getPersona(appConfig.BOT_PERSONA_ID);
    
    const toolDescriptions =
      this.mcpClient?.tools
        .map((tool) => `- ${tool.name}: ${tool.description}`)
        .join('\n') || 'No tools available';

    return `${persona.personalityPrompt}

Available tools:
${toolDescriptions}

To use a tool, respond with: TOOL_CALL: {"name": "toolName", "parameters": {...}}

If you don't need to use any tools, provide a direct response to help the user.

Always respond in character according to your personality described above.`;
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

  private async executeTool(
    toolCall: ToolCall,
    telegramContext: BotContext,
  ): Promise<unknown> {
    await this.ensureMCPInitialized();
    
    if (!this.mcpClient) {
      throw new Error('MCP client not initialized');
    }

    const tool = this.mcpClient.tools.find((t) => t.name === toolCall.name);
    if (!tool) {
      throw new Error(`Tool not found: ${toolCall.name}`);
    }

    logger.info('Executing tool', {
      toolName: tool.name,
      parameters: toolCall.parameters,
    });

    const result = await this.mcpClient.invoke(tool.name, toolCall.parameters);

    // Send progress update to user for certain tools
    if (toolCall.name.includes('create') || toolCall.name.includes('update')) {
      await telegramContext.reply(`✅ ${toolCall.name} completed successfully`);
    }

    return result;
  }

  private async showTyping(telegramContext: BotContext): Promise<void> {
    try {
      await telegramContext.replyWithChatAction('typing');
    } catch (error) {
      logger.debug('Failed to show typing indicator', { error });
    }
  }

  private async showAction(telegramContext: BotContext, toolName: string): Promise<void> {
    try {
      // Choose appropriate action based on tool type
      let action: 'typing' | 'upload_document' | 'find_location' = 'typing';
      
      if (toolName.includes('search') || toolName.includes('find') || toolName.includes('list')) {
        action = 'find_location'; // Shows "searching" indicator
      } else if (toolName.includes('create') || toolName.includes('generate') || toolName.includes('export')) {
        action = 'upload_document'; // Shows "uploading" indicator
      }
      
      await telegramContext.replyWithChatAction(action);
    } catch (error) {
      logger.debug('Failed to show action indicator', { error });
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
    await this.ensureMCPInitialized();
    return {
      version: '3.0.0-simple',
      mcpToolsAvailable: this.mcpClient?.tools.length || 0,
    };
  }
}
