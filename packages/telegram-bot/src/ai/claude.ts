import Anthropic from '@anthropic-ai/sdk';
import { appConfig } from '../utils/config.js';
import { logger } from '../utils/logger.js';
import { z } from 'zod';

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
  action: z.enum(['create', 'list', 'update', 'complete', 'delete', 'start_timer', 'stop_timer', 'get_summary']),
  title: z.string().optional(),
  description: z.string().optional(),
  context: z.string().optional(),
  due: z.string().optional(),
  tags: z.array(z.string()).optional(),
  filters: z.object({
    context: z.string().optional(),
    completed: z.boolean().optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
  }).optional(),
  todoId: z.string().optional(),
});

export type TodoIntent = z.infer<typeof TodoIntentSchema>;

/**
 * Claude AI client for natural language processing and conversation
 */
export class ClaudeAI {
  private client: Anthropic;
  private sessions: Map<string, AISession> = new Map();
  private readonly systemPrompt = `You are Mr. Stevens, a sophisticated digital butler working for the Eddo todo management system. You help users manage their tasks with elegance, efficiency, and a professional demeanor.

Your capabilities:
- Create, read, update, and delete todos through the MCP server
- Start and stop time tracking for tasks
- Generate summaries and reports
- Parse natural language requests into structured todo operations

User contexts available: work, private, errands, shopping, calls, learning, health, home

When users make requests:
1. Parse their intent carefully
2. Extract relevant todo information (title, context, due date, etc.)
3. Use appropriate MCP tools to fulfill their request
4. Provide helpful, butler-like responses

Always be:
- Professional and courteous
- Proactive in offering assistance
- Clear about what actions you're taking
- Efficient in helping users achieve their goals

Remember: You're not just a task manager, you're a digital butler committed to making your user's life more organized and productive.`;

  constructor() {
    this.client = new Anthropic({
      apiKey: appConfig.ANTHROPIC_API_KEY,
    });
  }

  /**
   * Create or get an existing session
   */
  private getOrCreateSession(userId: string): AISession {
    const existingSession = Array.from(this.sessions.values())
      .find((session) => session.userId === userId);

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
   * Parse user message to extract todo intent
   */
  async parseUserIntent(message: string): Promise<TodoIntent | null> {
    try {
      const response = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        system: `Parse the user's message to extract todo management intent. Return JSON only.

Examples:
- "Add buy groceries to shopping for tomorrow" → {"action": "create", "title": "buy groceries", "context": "shopping", "due": "tomorrow"}
- "Show me my work tasks" → {"action": "list", "filters": {"context": "work"}}
- "Mark grocery shopping as done" → {"action": "complete", "title": "grocery shopping"}
- "Start timer for meeting prep" → {"action": "start_timer", "title": "meeting prep"}

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

      return TodoIntentSchema.parse(parsed);
    } catch (error) {
      logger.error('Failed to parse user intent', { error, message });
      return null;
    }
  }

  /**
   * Generate a conversational response
   */
  async generateResponse(
    userId: string,
    message: string,
    context?: { mcpResponse?: string; action?: string }
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

      let systemMessage = this.systemPrompt;
      
      if (context?.mcpResponse && context?.action) {
        systemMessage += `\n\nContext: You just performed "${context.action}" with this result: ${context.mcpResponse}. Now provide a helpful response to the user.`;
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
      logger.error('Failed to generate AI response', { error, userId, message });
      
      // Fallback response
      return {
        content: '🎩 My apologies, I encountered a momentary difficulty processing your request. Please try again, and I shall be delighted to assist you.',
        sessionId: session.id,
      };
    }
  }

  /**
   * Generate a quick acknowledgment while processing
   */
  generateAcknowledgment(intent: TodoIntent): string {
    const acknowledgments = {
      create: '🎩 Certainly! Let me create that todo for you...',
      list: '🎩 Of course! Let me retrieve your todos...',
      update: '🎩 Absolutely! Let me update that todo...',
      complete: '🎩 Excellent! Let me mark that as completed...',
      delete: '🎩 Very well! Let me remove that todo...',
      start_timer: '🎩 Right away! Let me start the timer...',
      stop_timer: '🎩 Certainly! Let me stop the timer...',
      get_summary: '🎩 Of course! Let me prepare your summary...',
    };

    return acknowledgments[intent.action] || '🎩 At your service! Let me handle that for you...';
  }

  /**
   * Get session statistics
   */
  getSessionStats(): { totalSessions: number; activeSessions: number } {
    const now = new Date();
    const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);
    
    const activeSessions = Array.from(this.sessions.values())
      .filter((session) => session.lastActivity > fifteenMinutesAgo).length;

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
