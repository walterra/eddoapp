import { getMCPClient } from '../mcp/client.js';
import type {
  AIResponse,
  MultiTodoIntent,
  TodoIntent,
} from '../types/ai-types.js';
import { appConfig } from '../utils/config.js';
import { logger } from '../utils/logger.js';
import { createIntentParser } from './intent-parser.js';
import { type Persona, getPersona } from './personas.js';
import { createResponseGenerator } from './response-generator.js';
import { createSessionManager } from './session-manager.js';

export type {
  AISession,
  AIResponse,
  TodoIntent,
  MultiTodoIntent,
} from '../types/ai-types.js';
export { TodoIntentSchema, MultiTodoIntentSchema } from '../types/ai-types.js';

export interface ClaudeAI {
  parseUserIntent: (
    message: string,
    lastBotMessage?: string,
  ) => Promise<TodoIntent | MultiTodoIntent | null>;
  generateResponse: (
    userId: string,
    message: string,
    context?: { mcpResponse?: string; action?: string },
  ) => Promise<AIResponse>;
  generateAcknowledgment: (intent: TodoIntent | MultiTodoIntent) => string;
  getCurrentPersona: () => Persona;
  getSessionStats: () => { totalSessions: number; activeSessions: number };
}

/**
 * Creates a Claude AI client instance for natural language processing and conversation
 */
export function createClaudeAI(): ClaudeAI {
  const apiKey = appConfig.ANTHROPIC_API_KEY;
  const persona = getPersona(appConfig.BOT_PERSONA_ID);
  const mcpClient = getMCPClient();

  const sessionManager = createSessionManager();
  const intentParser = createIntentParser(apiKey);
  const responseGenerator = createResponseGenerator(apiKey, mcpClient, persona);

  const parseUserIntent = async (
    message: string,
    lastBotMessage?: string,
  ): Promise<TodoIntent | MultiTodoIntent | null> => {
    return intentParser.parseUserIntent(message, lastBotMessage);
  };

  const generateResponse = async (
    userId: string,
    message: string,
    context?: { mcpResponse?: string; action?: string },
  ): Promise<AIResponse> => {
    sessionManager.cleanupOldSessions();
    const session = sessionManager.getOrCreateSession(userId);

    try {
      // Add user message to session context
      session.context.push({ role: 'user', content: message });

      // Keep only last 10 messages to manage context length
      if (session.context.length > 10) {
        session.context = session.context.slice(-10);
      }

      let responseText: string;

      if (context?.mcpResponse && context?.action) {
        // Handle response with MCP context
        responseText = await handleMCPResponse(
          session.context,
          context.mcpResponse,
          context.action,
        );
      } else {
        // Generate normal conversational response
        responseText = await responseGenerator.generateResponse(
          session.context,
        );
      }

      // Add assistant response to session context
      session.context.push({ role: 'assistant', content: responseText });

      logger.info('Generated AI response', {
        userId,
        sessionId: session.id,
        messageLength: message.length,
        responseLength: responseText.length,
      });

      return {
        content: responseText,
        sessionId: session.id,
      };
    } catch (error) {
      logger.error('Failed to generate AI response', {
        error,
        userId,
        message,
      });

      // Fallback response
      return {
        content: persona.fallbackMessage,
        sessionId: session.id,
      };
    }
  };

  const handleMCPResponse = async (
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    mcpResponse: string,
    action: string,
  ): Promise<string> => {
    // For list actions, preserve the actual data
    if (action.includes('list') || action === 'summary') {
      const enhancedMessages = [
        ...messages,
        {
          role: 'system' as const,
          content: `IMPORTANT: The following MCP operation has been completed successfully. The user has seen progress updates. Based on the ACTUAL results below, provide a natural conversational summary of what was found. Do NOT make up or hallucinate any data - only refer to what is actually present in the results:\n\nMCP Results:\n${mcpResponse}`,
        },
      ];
      return responseGenerator.generateResponse(enhancedMessages);
    }

    // For non-list actions, clean the response
    const cleanedResponse = cleanMCPResponse(mcpResponse, action);
    const enhancedMessages = [
      ...messages,
      {
        role: 'system' as const,
        content: `IMPORTANT: All requested actions have been successfully executed and completed. The user has already seen the progress updates. DO NOT generate any tool calls, JSON objects, or technical commands. DO NOT suggest or plan future actions. Your role now is to provide ONLY a brief, natural conversational summary acknowledging what was accomplished: ${cleanedResponse}`,
      },
    ];
    return responseGenerator.generateResponse(enhancedMessages);
  };

  const cleanMCPResponse = (mcpResponse: string, action: string): string => {
    try {
      // Remove JSON data and keep only meaningful summary information
      const lines = mcpResponse.split('\n');
      const meaningfulLines = lines.filter((line) => {
        const trimmed = line.trim();
        // Skip JSON objects, action labels, and empty lines
        return (
          trimmed &&
          !trimmed.startsWith('{') &&
          !trimmed.startsWith('}') &&
          !trimmed.startsWith('"') &&
          !trimmed.startsWith('Action ') &&
          !trimmed.includes(':\n')
        );
      });

      if (meaningfulLines.length > 0) {
        return meaningfulLines.join('. ');
      } else {
        // Extract just the action count/success info
        return `Completed ${action}`;
      }
    } catch {
      return `Completed ${action}`;
    }
  };

  const generateAcknowledgment = (
    intent: TodoIntent | MultiTodoIntent,
  ): string => {
    // Handle multi-intent
    if ('actions' in intent) {
      const actionCount = intent.actions.length;
      if (actionCount === 1) {
        return generateAcknowledgment(intent.actions[0]);
      }
      return `${persona.acknowledgmentEmoji} Excellent! Let me handle those ${actionCount} tasks for you...`;
    }

    // Handle single intent
    return (
      persona.acknowledgments[intent.action] ||
      `${persona.acknowledgmentEmoji} At your service! Let me handle that for you...`
    );
  };

  const getCurrentPersona = (): Persona => {
    return persona;
  };

  const getSessionStats = (): {
    totalSessions: number;
    activeSessions: number;
  } => {
    return sessionManager.getSessionStats();
  };

  return {
    parseUserIntent,
    generateResponse,
    generateAcknowledgment,
    getCurrentPersona,
    getSessionStats,
  };
}

// Singleton instance
let claudeAI: ClaudeAI | null = null;

/**
 * Get the singleton Claude AI instance
 */
export function getClaudeAI(): ClaudeAI {
  if (!claudeAI) {
    claudeAI = createClaudeAI();
  }
  return claudeAI;
}
