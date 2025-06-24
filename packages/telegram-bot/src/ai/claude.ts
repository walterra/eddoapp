import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

import { getMCPClient } from '../mcp/client.js';
import { appConfig } from '../utils/config.js';
import { logger } from '../utils/logger.js';
import { type Persona, getPersona } from './personas.js';

export interface AISession {
  id: string;
  userId: string;
  context: Array<{ role: 'user' | 'assistant'; content: string }>;
  createdAt: Date;
  lastActivity: Date;
}

export interface AIResponse {
  content: string;
  usedTools?: string[];
  sessionId?: string;
}

// Schema for structured todo extraction
export const TodoIntentSchema = z.object({
  action: z.enum([
    'create',
    'list',
    'update',
    'complete',
    'delete',
    'start_timer',
    'stop_timer',
    'get_summary',
  ]),
  title: z.string().optional(),
  description: z.string().optional(),
  context: z.string().optional(),
  due: z.string().optional(),
  tags: z.array(z.string()).optional(),
  filters: z
    .object({
      context: z.string().optional(),
      completed: z.boolean().optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    })
    .optional(),
  todoId: z.string().optional(),
});

// Schema for multiple actions in a single message
export const MultiTodoIntentSchema = z.object({
  actions: z.array(TodoIntentSchema),
  requiresSequential: z.boolean().optional(), // Whether actions must be executed in order
});

export type TodoIntent = z.infer<typeof TodoIntentSchema>;
export type MultiTodoIntent = z.infer<typeof MultiTodoIntentSchema>;

/**
 * Claude AI client for natural language processing and conversation
 */
export class ClaudeAI {
  private client: Anthropic;
  private sessions: Map<string, AISession> = new Map();
  private persona: Persona;

  constructor() {
    this.client = new Anthropic({
      apiKey: appConfig.ANTHROPIC_API_KEY,
    });
    this.persona = getPersona(appConfig.BOT_PERSONA_ID);
  }

  /**
   * Get enhanced system prompt with real-time MCP capabilities
   */
  private async getEnhancedSystemPrompt(): Promise<string> {
    try {
      const mcpClient = getMCPClient();
      if (!mcpClient.isClientConnected()) {
        return this.persona.systemPrompt;
      }

      // Get comprehensive MCP server documentation
      const serverInfo = await mcpClient.getServerInfo('all');

      return `${this.persona.systemPrompt}

## MCP Server Documentation
${serverInfo}

Use this documentation to understand the exact capabilities and parameters for each tool.`;
    } catch (error) {
      logger.warn('Failed to get MCP server info for enhanced prompt', {
        error,
      });
      return this.persona.systemPrompt;
    }
  }

  /**
   * Create or get an existing session
   */
  private getOrCreateSession(userId: string): AISession {
    const existingSession = Array.from(this.sessions.values()).find(
      (session) => session.userId === userId,
    );

    if (existingSession) {
      existingSession.lastActivity = new Date();
      return existingSession;
    }

    const newSession: AISession = {
      id: `session_${userId}_${Date.now()}`,
      userId,
      context: [],
      createdAt: new Date(),
      lastActivity: new Date(),
    };

    this.sessions.set(newSession.id, newSession);
    return newSession;
  }

  /**
   * Clean up old sessions (older than 1 hour)
   */
  private cleanupOldSessions(): void {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.lastActivity < oneHourAgo) {
        this.sessions.delete(sessionId);
      }
    }
  }

  /**
   * Parse user message to extract todo intent(s)
   */
  async parseUserIntent(
    message: string,
    lastBotMessage?: string,
  ): Promise<TodoIntent | MultiTodoIntent | null> {
    try {
      const response = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        system: `Parse the user's message to extract todo management intent(s). Return JSON only.

${
  lastBotMessage
    ? `CONTEXT: The bot's last response was: "${lastBotMessage}"

Consider this context when parsing the user's current message. If the user is responding with contextual phrases like "continue", "yes please", "do it", "proceed", "yes delete these todos", "confirm", "go ahead", etc., interpret their intent based on what the bot previously suggested or offered.

For contextual confirmations:
- If the bot previously listed todos and suggested deletion, "yes delete these todos" → multiple delete actions
- If the bot previously offered to create multiple todos, "yes please" → multiple create actions  
- If the bot previously suggested an update, "confirm" → update action
- Extract the specific action details from the bot's previous message and create the appropriate intent(s)`
    : ''
}

You can return either:
1. Single action: {"action": "create", "title": "task", ...}
2. Multiple actions: {"actions": [{"action": "create", "title": "task1"}, {"action": "create", "title": "task2"}], "requiresSequential": true}

Use multiple actions format when:
- Creating multiple todos at once
- Need to search then update/complete/delete a todo
- Need to perform related actions in sequence
- Batch operations requested
- User confirms a bulk operation from previous context

Set "requiresSequential": true when actions depend on each other (e.g., search for ID then update that ID).
Set "requiresSequential": false (or omit) when actions are independent.

CRITICAL: You MUST only use these exact action values:
- create
- list  
- update
- complete
- delete
- start_timer
- stop_timer
- get_summary

DO NOT use variations like "create_multiple", "bulk_delete", "help", or any other values. Use the multiple actions format instead.

IMPORTANT: When parsing dates, convert natural language to ISO format (YYYY-MM-DDTHH:mm:ss.sssZ):
- "tomorrow" → next day at 23:59:59.999Z
- "June 20th" or "June 20" → current/next year-06-20T23:59:59.999Z
- "next Friday" → calculate from current date
- "in 3 days" → current date + 3 days at 23:59:59.999Z
- "2025-06-25" → 2025-06-25T23:59:59.999Z
- If no time specified, default to 23:59:59.999Z

Current date for reference: ${new Date().toISOString()}

Examples:
Single actions:
- "Add buy groceries to shopping for tomorrow" → {"action": "create", "title": "buy groceries", "context": "shopping", "due": "${new Date(Date.now() + 86400000).toISOString().split('T')[0]}T23:59:59.999Z"}
- "Show me my work tasks" → {"action": "list", "filters": {"context": "work"}}

Multiple actions:
- "Create buy groceries and walk dog todos" → {"actions": [{"action": "create", "title": "buy groceries"}, {"action": "create", "title": "walk dog"}], "requiresSequential": false}
- "Find my grocery shopping todo and mark it complete" → {"actions": [{"action": "list", "filters": {"title": "grocery shopping"}}, {"action": "complete", "title": "grocery shopping"}], "requiresSequential": true}
- "Delete all todos with health context" → {"actions": [{"action": "list", "filters": {"context": "health"}}, {"action": "delete", "context": "health"}], "requiresSequential": true}
- "Create 3 work todos: meeting prep, email review, and status report" → {"actions": [{"action": "create", "title": "meeting prep", "context": "work"}, {"action": "create", "title": "email review", "context": "work"}, {"action": "create", "title": "status report", "context": "work"}], "requiresSequential": false}

Contextual confirmations (when lastBotMessage contains context):
- If bot suggested: "I found 3 health todos. Should I delete them?" and user says "yes delete these todos" → {"actions": [{"action": "list", "filters": {"context": "health"}}, {"action": "delete", "context": "health"}], "requiresSequential": true}
- If bot offered: "Should I create these todos for you?" and user says "yes please" → extract the specific todos from lastBotMessage and create multiple create actions

Available contexts: work, private, errands, shopping, calls, learning, health, home
Default context: private
Default due: end of current day (23:59:59.999Z)

If the message is not about todo management, return null.`,
        messages: [
          {
            role: 'user',
            content: message,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        return null;
      }

      const parsed = JSON.parse(content.text);
      if (parsed === null) {
        return null;
      }

      // Try to parse as multi-intent first, then fall back to single intent
      try {
        return MultiTodoIntentSchema.parse(parsed);
      } catch {
        return TodoIntentSchema.parse(parsed);
      }
    } catch (error) {
      logger.error('Failed to parse user intent', { error, message });

      // If it's a Zod validation error, it means Claude tried to parse a todo request but used invalid values
      if (
        error &&
        typeof error === 'object' &&
        'name' in error &&
        error.name === 'ZodError'
      ) {
        // Extract the specific validation issue for better error messaging
        const zodError = error as { issues?: Array<{ message: string; received?: string; path?: string[] }> };
        const firstIssue = zodError.issues?.[0];
        
        if (firstIssue?.received && firstIssue.path?.includes('action')) {
          throw new Error(
            `I tried to use "${firstIssue.received}" as an action, but that's not valid. I can only use: create, list, update, complete, delete, start_timer, stop_timer, get_summary. Please rephrase your request.`,
          );
        }
        
        throw new Error(
          `I had trouble understanding your todo request format. ${firstIssue?.message || 'Please try rephrasing your request.'}`,
        );
      }

      return null;
    }
  }

  /**
   * Generate a conversational response
   */
  async generateResponse(
    userId: string,
    message: string,
    context?: { mcpResponse?: string; action?: string },
  ): Promise<AIResponse> {
    this.cleanupOldSessions();
    const session = this.getOrCreateSession(userId);

    try {
      // Add user message to session context
      session.context.push({ role: 'user', content: message });

      // Keep only last 10 messages to manage context length
      if (session.context.length > 10) {
        session.context = session.context.slice(-10);
      }

      let systemMessage = await this.getEnhancedSystemPrompt();

      if (context?.mcpResponse && context?.action) {
        // For list actions, preserve the actual data so Claude can provide accurate information
        if (context.action.includes('list') || context.action === 'summary') {
          systemMessage += `\n\nIMPORTANT: The following MCP operation has been completed successfully. The user has seen progress updates. Based on the ACTUAL results below, provide a natural conversational summary of what was found. Do NOT make up or hallucinate any data - only refer to what is actually present in the results:\n\nMCP Results:\n${context.mcpResponse}`;
        } else {
          // For non-list actions, use existing cleaning logic
          let cleanedResponse = context.mcpResponse;
          try {
            // Remove JSON data and keep only meaningful summary information
            const lines = context.mcpResponse.split('\n');
            const meaningfulLines = lines.filter(line => {
              const trimmed = line.trim();
              // Skip JSON objects, action labels, and empty lines
              return trimmed && 
                     !trimmed.startsWith('{') && 
                     !trimmed.startsWith('}') && 
                     !trimmed.startsWith('"') &&
                     !trimmed.startsWith('Action ') &&
                     !trimmed.includes(':\n');
            });
            
            if (meaningfulLines.length > 0) {
              cleanedResponse = meaningfulLines.join('. ');
            } else {
              // Extract just the action count/success info
              cleanedResponse = `Completed ${context.action}`;
            }
          } catch {
            cleanedResponse = `Completed ${context.action}`;
          }
          
          systemMessage += `\n\nIMPORTANT: All requested actions have been successfully executed and completed. The user has already seen the progress updates. DO NOT generate any tool calls, JSON objects, or technical commands. DO NOT suggest or plan future actions. Your role now is to provide ONLY a brief, natural conversational summary acknowledging what was accomplished: ${cleanedResponse}`;
        }
      }

      const response = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        system: systemMessage,
        messages: session.context,
      });

      const assistantContent = response.content[0];
      if (assistantContent.type !== 'text') {
        throw new Error('Unexpected response type from Claude');
      }

      const responseText = assistantContent.text;

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
        content: this.persona.fallbackMessage,
        sessionId: session.id,
      };
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
    const now = new Date();
    const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);

    const activeSessions = Array.from(this.sessions.values()).filter(
      (session) => session.lastActivity > fifteenMinutesAgo,
    ).length;

    return {
      totalSessions: this.sessions.size,
      activeSessions,
    };
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
