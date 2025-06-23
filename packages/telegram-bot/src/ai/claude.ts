import Anthropic from '@anthropic-ai/sdk';
import { appConfig } from '../utils/config.js';
import { logger } from '../utils/logger.js';
import { z } from 'zod';
import { getMCPClient } from '../mcp/client.js';

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

Your capabilities through the MCP server:
- **createTodo**: Create new todos with title, description, context, due date, tags, repeat interval, and links
- **listTodos**: Query todos with filters (context, completion status, date range)
- **updateTodo**: Modify existing todos (requires finding the ID first)
- **toggleTodoCompletion**: Mark todos as complete/incomplete (handles repeating todos automatically)
- **deleteTodo**: Permanently remove todos
- **startTimeTracking/stopTimeTracking**: Track time spent on tasks
- **getActiveTimeTracking**: See which todos are currently being timed

Todo Properties:
- title: Main task name (required)
- description: Detailed notes (markdown supported)
- context: GTD category (work, private, errands, shopping, calls, learning, health, home)
- due: ISO date when task should be completed (defaults to end of current day)
- tags: Labels for categorization
- repeat: Days to repeat after completion (null for no repeat)
- link: Associated URL or reference
- completed: ISO timestamp when completed (null if not done)
- active: Time tracking sessions (start/end timestamps)

Date Handling:
- Always convert natural language dates to ISO format (YYYY-MM-DDTHH:mm:ss.sssZ)
- Default time is 23:59:59.999Z if not specified
- Understand "tomorrow", "next Friday", "June 25th", "in 3 days", etc.
- Use current date as reference for relative dates

When users make requests:
1. Parse their intent carefully, understanding both explicit requests and implied needs
2. Extract all relevant information (title, context, dates, etc.)
3. Use appropriate MCP tools to fulfill their request
4. When updating/completing/deleting, first list to find the correct todo ID
5. Provide helpful, butler-like responses confirming actions taken

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
   * Get enhanced system prompt with real-time MCP capabilities
   */
  private async getEnhancedSystemPrompt(): Promise<string> {
    try {
      const mcpClient = getMCPClient();
      if (!mcpClient.isClientConnected()) {
        return this.systemPrompt;
      }

      // Get comprehensive MCP server documentation
      const serverInfo = await mcpClient.getServerInfo('all');
      
      return `${this.systemPrompt}

## MCP Server Documentation
${serverInfo}

Use this documentation to understand the exact capabilities and parameters for each tool.`;
    } catch (error) {
      logger.warn('Failed to get MCP server info for enhanced prompt', { error });
      return this.systemPrompt;
    }
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

IMPORTANT: When parsing dates, convert natural language to ISO format (YYYY-MM-DDTHH:mm:ss.sssZ):
- "tomorrow" → next day at 23:59:59.999Z
- "June 20th" or "June 20" → current/next year-06-20T23:59:59.999Z
- "next Friday" → calculate from current date
- "in 3 days" → current date + 3 days at 23:59:59.999Z
- "2025-06-25" → 2025-06-25T23:59:59.999Z
- If no time specified, default to 23:59:59.999Z

Current date for reference: ${new Date().toISOString()}

Examples:
- "Add buy groceries to shopping for tomorrow" → {"action": "create", "title": "buy groceries", "context": "shopping", "due": "${new Date(Date.now() + 86400000).toISOString().split('T')[0]}T23:59:59.999Z"}
- "Create task for June 25th" → {"action": "create", "title": "task", "due": "${new Date().getFullYear()}-06-25T23:59:59.999Z"}
- "Show me my work tasks" → {"action": "list", "filters": {"context": "work"}}
- "Show incomplete todos due this week" → {"action": "list", "filters": {"completed": false, "dateFrom": "[start of week ISO]", "dateTo": "[end of week ISO]"}}
- "Mark grocery shopping as done" → {"action": "complete", "title": "grocery shopping"}
- "Complete todo ID 2025-06-18T10:30:00.000Z" → {"action": "complete", "todoId": "2025-06-18T10:30:00.000Z"}
- "Start timer for meeting prep" → {"action": "start_timer", "title": "meeting prep"}
- "Update todo ID 2025-06-18T10:30:00.000Z title to 'New Title'" → {"action": "update", "todoId": "2025-06-18T10:30:00.000Z", "title": "New Title"}

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

      let systemMessage = await this.getEnhancedSystemPrompt();
      
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
