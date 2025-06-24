import Anthropic from '@anthropic-ai/sdk';
import { getMCPClient } from '../mcp/client.js';
import { appConfig } from '../utils/config.js';
import { logger } from '../utils/logger.js';
import { type Persona, getPersona } from './personas.js';
import { SessionManager } from './session-manager.js';
import { IntentParser } from './intent-parser.js';
import { ResponseGenerator } from './response-generator.js';
import type { AIResponse, TodoIntent, MultiTodoIntent } from '../types/ai-types.js';

/**
 * Claude AI client for natural language processing and conversation
 */
export class ClaudeAI {
  private sessionManager: SessionManager;
  private intentParser: IntentParser;
  private responseGenerator: ResponseGenerator;
  private persona: Persona;

  constructor() {
    const apiKey = appConfig.ANTHROPIC_API_KEY;
    this.persona = getPersona(appConfig.BOT_PERSONA_ID);
    const mcpClient = getMCPClient();
    
    this.sessionManager = new SessionManager();
    this.intentParser = new IntentParser(apiKey, mcpClient, this.persona);
    this.responseGenerator = new ResponseGenerator(apiKey, mcpClient, this.persona);
  }

  /**
   * Parse user message to extract todo intent(s)
   */
  async parseUserIntent(
    message: string,
    lastBotMessage?: string,
  ): Promise<TodoIntent | MultiTodoIntent | null> {
    const context = lastBotMessage
      ? `CONTEXT: The bot's last response was: "${lastBotMessage}"
        
        Consider this context when parsing the user's current message. If the user is responding with contextual phrases like "continue", "yes please", "do it", "proceed", "yes delete these todos", "confirm", "go ahead", etc., interpret their intent based on what the bot previously suggested or offered.`
      : undefined;

    const result = await this.intentParser.parseUserIntent(message, context);
    
    if (result.error) {
      logger.error('Failed to parse user intent', { error: result.error, message });
      
      // Handle specific Zod validation errors
      if (result.error.includes('Invalid action')) {
        throw new Error(
          `I tried to use an invalid action. I can only use: create, list, update, complete, delete, start_timer, stop_timer, get_summary. Please rephrase your request.`,
        );
      }
      
      throw new Error(
        `I had trouble understanding your todo request format. ${result.error || 'Please try rephrasing your request.'}`,
      );
    }
    
    return result.parsed || null;
  }

  /**
   * Generate a conversational response
   */
  async generateResponse(
    userId: string,
    message: string,
    context?: { mcpResponse?: string; action?: string },
  ): Promise<AIResponse> {
    this.sessionManager.cleanupOldSessions();
    const session = this.sessionManager.getOrCreateSession(userId);

    try {
      // Add user message to session
      session.messages.push({ role: 'user', content: message });

      // Keep only last 10 messages
      if (session.messages.length > 10) {
        session.messages = session.messages.slice(-10);
      }

      let responseText: string;
      
      if (context?.mcpResponse && context?.action) {
        // Handle response with MCP context
        responseText = await this.handleMCPResponse(
          session.messages,
          context.mcpResponse,
          context.action
        );
      } else {
        // Generate normal conversational response
        responseText = await this.responseGenerator.generateResponse(session.messages);
      }

      // Add assistant response to session
      session.messages.push({ role: 'assistant', content: responseText });

      logger.info('Generated AI response', {
        userId,
        messageLength: message.length,
        responseLength: responseText.length,
      });

      return {
        response: responseText,
      };
    } catch (error) {
      logger.error('Failed to generate AI response', {
        error,
        userId,
        message,
      });

      return {
        response: this.persona.fallbackMessage,
      };
    }
  }

  /**
   * Handle response generation with MCP context
   */
  private async handleMCPResponse(
    messages: any[],
    mcpResponse: string,
    action: string
  ): Promise<string> {
    // For list actions, preserve the actual data
    if (action.includes('list') || action === 'summary') {
      const enhancedMessages = [
        ...messages,
        {
          role: 'system',
          content: `IMPORTANT: The following MCP operation has been completed successfully. The user has seen progress updates. Based on the ACTUAL results below, provide a natural conversational summary of what was found. Do NOT make up or hallucinate any data - only refer to what is actually present in the results:\n\nMCP Results:\n${mcpResponse}`,
        },
      ];
      return this.responseGenerator.generateResponse(enhancedMessages);
    }

    // For non-list actions, clean the response
    const cleanedResponse = this.cleanMCPResponse(mcpResponse, action);
    const enhancedMessages = [
      ...messages,
      {
        role: 'system',
        content: `IMPORTANT: All requested actions have been successfully executed and completed. The user has already seen the progress updates. DO NOT generate any tool calls, JSON objects, or technical commands. DO NOT suggest or plan future actions. Your role now is to provide ONLY a brief, natural conversational summary acknowledging what was accomplished: ${cleanedResponse}`,
      },
    ];
    return this.responseGenerator.generateResponse(enhancedMessages);
  }

  /**
   * Clean MCP response for non-list actions
   */
  private cleanMCPResponse(mcpResponse: string, action: string): string {
    try {
      const lines = mcpResponse.split('\n');
      const meaningfulLines = lines.filter(line => {
        const trimmed = line.trim();
        return trimmed && 
               !trimmed.startsWith('{') && 
               !trimmed.startsWith('}') && 
               !trimmed.startsWith('"') &&
               !trimmed.startsWith('Action ') &&
               !trimmed.includes(':\n');
      });
      
      if (meaningfulLines.length > 0) {
        return meaningfulLines.join('. ');
      }
      return `Completed ${action}`;
    } catch {
      return `Completed ${action}`;
    }
  }

  /**
   * Generate a quick acknowledgment while processing
   */
  generateAcknowledgment(intent: TodoIntent | MultiTodoIntent): string {
    // Handle multi-intent
    if ('actions' in intent) {
      const actionCount = intent.actions.length;
      if (actionCount === 1) {
        return this.generateAcknowledgment(intent.actions[0]);
      }
      return `${this.persona.acknowledgmentEmoji} Excellent! Let me handle those ${actionCount} tasks for you...`;
    }

    // Handle single intent
    return (
      this.persona.acknowledgments[intent.action] ||
      `${this.persona.acknowledgmentEmoji} At your service! Let me handle that for you...`
    );
  }

  /**
   * Get current persona information
   */
  getPersona(): Persona {
    return this.persona;
  }

  /**
   * Get session statistics
   */
  getSessionStats(): { totalSessions: number; activeSessions: number } {
    return this.sessionManager.getSessionStats();
  }
}

// Singleton instance
let claudeAI: ClaudeAI | null = null;

/**
 * Get the singleton Claude AI instance
 */
export function getClaudeAI(): ClaudeAI {
  if (!claudeAI) {
    claudeAI = new ClaudeAI();
  }
  return claudeAI;
}