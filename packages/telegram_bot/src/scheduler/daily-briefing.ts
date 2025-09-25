import { createEnv, createUserRegistry } from '@eddo/core-server';
import type { Bot } from 'grammy';

import { claudeService } from '../ai/claude.js';
import type { BotContext } from '../bot/bot.js';
import { MCPClient } from '../mcp/client.js';
import { logger } from '../utils/logger.js';
import { TelegramUser } from '../utils/user-lookup.js';

interface DailyBriefingSchedulerConfig {
  bot: Bot<BotContext>;
  mcpClient: MCPClient;
  briefingHour: number; // Hour in 24-hour format (e.g., 7 for 7 AM)
  checkIntervalMs: number; // How often to check for briefing time
}

interface BriefingContext {
  user: TelegramUser;
  today: string; // ISO date string
  now: string; // ISO timestamp
}

interface TodoItem {
  title: string;
  description?: string;
  due?: string;
  context?: string;
  tags?: string[];
}

interface BriefingData {
  todayTasks: TodoItem[];
  overdueTasks: TodoItem[];
  nextActions: TodoItem[];
  waitingItems: TodoItem[];
  activeTracking: { title?: string; duration?: string } | null;
  yesterdayCompleted: TodoItem[];
}

export class DailyBriefingScheduler {
  private bot: Bot<BotContext>;
  private mcpClient: MCPClient;
  private briefingHour: number;
  private checkIntervalMs: number;
  private intervalId: NodeJS.Timeout | null = null;
  private lastBriefingDate: string | null = null;
  private isRunning = false;

  constructor(config: DailyBriefingSchedulerConfig) {
    this.bot = config.bot;
    this.mcpClient = config.mcpClient;
    this.briefingHour = config.briefingHour;
    this.checkIntervalMs = config.checkIntervalMs;

    logger.info('Daily briefing scheduler created', {
      briefingHour: this.briefingHour,
      checkIntervalMs: this.checkIntervalMs,
    });
  }

  /**
   * Start the daily briefing scheduler
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Daily briefing scheduler is already running');
      return;
    }

    this.isRunning = true;
    this.intervalId = setInterval(() => {
      this.checkAndSendBriefings().catch((error) => {
        logger.error('Error in daily briefing check', { error });
      });
    }, this.checkIntervalMs);

    logger.info('Daily briefing scheduler started');
  }

  /**
   * Stop the daily briefing scheduler
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    logger.info('Daily briefing scheduler stopped');
  }

  /**
   * Check if it's time to send briefings and send them
   */
  private async checkAndSendBriefings(): Promise<void> {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const todayDate = now.toISOString().split('T')[0];

    // Check if it's the right hour and within first 5 minutes
    if (currentHour !== this.briefingHour || currentMinute >= 5) {
      return;
    }

    // Prevent multiple briefings on the same day
    if (this.lastBriefingDate === todayDate) {
      return;
    }

    logger.info('Time to send daily briefings', {
      hour: currentHour,
      minute: currentMinute,
      date: todayDate,
    });

    try {
      await this.sendDailyBriefings();
      this.lastBriefingDate = todayDate;
    } catch (error) {
      logger.error('Failed to send daily briefings', { error });
    }
  }

  /**
   * Send daily briefings to all users with briefings enabled
   */
  private async sendDailyBriefings(): Promise<void> {
    const env = createEnv();
    const userRegistry = createUserRegistry(env.COUCHDB_URL, env);

    // Get all active users
    const users = await userRegistry.list();
    const briefingUsers = users.filter(
      (user) =>
        user.status === 'active' &&
        user.telegram_id &&
        user.preferences?.dailyBriefing === true,
    );

    if (briefingUsers.length === 0) {
      logger.info('No users have daily briefings enabled');
      return;
    }

    logger.info(`Sending daily briefings to ${briefingUsers.length} users`);

    // Send briefings in parallel but with some delay to avoid rate limits
    for (const user of briefingUsers) {
      try {
        // Convert user registry entry to TelegramUser
        const telegramUser: TelegramUser = {
          _id: user._id,
          username: user.username,
          email: user.email,
          telegram_id: user.telegram_id!,
          database_name: user.database_name,
          status: user.status,
          permissions: user.permissions,
          created_at: user.created_at,
          updated_at: user.updated_at,
          preferences: user.preferences,
        };

        await this.sendBriefingToUser(telegramUser);
        // Small delay between users to avoid Telegram rate limits
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        logger.error('Failed to send briefing to user', {
          userId: user._id,
          username: user.username,
          error,
        });
      }
    }
  }

  /**
   * Send a daily briefing to a specific user
   */
  private async sendBriefingToUser(user: TelegramUser): Promise<void> {
    if (!user.telegram_id) {
      logger.warn('User has no telegram_id', { userId: user._id });
      return;
    }

    const now = new Date();
    const today = now.toISOString().split('T')[0];

    const briefingContext: BriefingContext = {
      user,
      today,
      now: now.toISOString(),
    };

    logger.info('Generating briefing for user', {
      userId: user._id,
      username: user.username,
      telegramId: user.telegram_id,
    });

    try {
      // Generate briefing content using the AI agent
      const briefingMessage =
        await this.generateBriefingContent(briefingContext);

      // Send the briefing via Telegram
      await this.bot.api.sendMessage(user.telegram_id, briefingMessage, {
        parse_mode: 'Markdown',
        link_preview_options: { is_disabled: true },
      });

      logger.info('Daily briefing sent successfully', {
        userId: user._id,
        username: user.username,
        telegramId: user.telegram_id,
      });
    } catch (error) {
      logger.error('Failed to generate or send briefing', {
        userId: user._id,
        username: user.username,
        error,
      });
      throw error;
    }
  }

  /**
   * Generate briefing content for a user using AI with context data
   */
  private async generateBriefingContent(
    context: BriefingContext,
  ): Promise<string> {
    try {
      // 1. Fetch necessary context data from database
      const briefingData = await this.fetchBriefingContextData(context);

      // 2. Generate LLM briefing using AI service with system prompt
      return await this.generateAIBriefing(context, briefingData);
    } catch (error) {
      logger.error('Failed to generate briefing content', {
        userId: context.user._id,
        error,
      });

      // Fallback to a simple briefing if generation fails
      return this.generateFallbackBriefing(context);
    }
  }

  /**
   * Fetch context data needed for briefing generation
   */
  private async fetchBriefingContextData(
    context: BriefingContext,
  ): Promise<BriefingData> {
    const userContext = {
      username: context.user.username,
      databaseName: context.user.database_name,
      telegramId: context.user.telegram_id,
    };

    try {
      // Get today's tasks (due today)
      const todayTasks = await this.mcpClient.invoke(
        'listTodos',
        {
          dateFrom: context.today,
          dateTo: context.today,
          completed: false,
        },
        userContext,
      );

      // Get overdue tasks (due before today and not completed)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const overdueDate = yesterday.toISOString().split('T')[0];

      const overdueTasks = await this.mcpClient.invoke(
        'listTodos',
        {
          dateTo: overdueDate,
          completed: false,
        },
        userContext,
      );

      // Get next actions (gtd:next tagged items)
      const nextActions = await this.mcpClient.invoke(
        'listTodos',
        {
          tags: ['gtd:next'],
          completed: false,
        },
        userContext,
      );

      // Get waiting items (gtd:waiting tagged items)
      const waitingItems = await this.mcpClient.invoke(
        'listTodos',
        {
          tags: ['gtd:waiting'],
          completed: false,
        },
        userContext,
      );

      // Get active time tracking
      const activeTracking = await this.mcpClient.invoke(
        'getActiveTimeTracking',
        {},
        userContext,
      );

      // Get yesterday's completed tasks for summary
      const yesterdayCompleted = await this.mcpClient.invoke(
        'listTodos',
        {
          dateFrom: overdueDate,
          dateTo: overdueDate,
          completed: true,
        },
        userContext,
      );

      return {
        todayTasks: (todayTasks as TodoItem[]) || ([] as TodoItem[]),
        overdueTasks: (overdueTasks as TodoItem[]) || ([] as TodoItem[]),
        nextActions: (nextActions as TodoItem[]) || ([] as TodoItem[]),
        waitingItems: (waitingItems as TodoItem[]) || ([] as TodoItem[]),
        activeTracking: activeTracking || null,
        yesterdayCompleted:
          (yesterdayCompleted as TodoItem[]) || ([] as TodoItem[]),
      };
    } catch (error) {
      logger.warn('Some briefing data could not be retrieved', { error });
      return {
        todayTasks: [] as TodoItem[],
        overdueTasks: [] as TodoItem[],
        nextActions: [] as TodoItem[],
        waitingItems: [] as TodoItem[],
        activeTracking: null,
        yesterdayCompleted: [] as TodoItem[],
      };
    }
  }

  /**
   * Generate AI-powered briefing using Claude with system prompt and context data
   */
  private async generateAIBriefing(
    context: BriefingContext,
    briefingData: BriefingData,
  ): Promise<string> {
    const { user, today } = context;
    const {
      todayTasks,
      overdueTasks,
      nextActions,
      waitingItems,
      activeTracking,
      yesterdayCompleted,
    } = briefingData;

    // Create system prompt for GTD-focused daily briefing
    const systemPrompt = `You are a GTD (Getting Things Done) productivity coach providing daily briefings to help users stay organized and motivated.

Your role:
- Provide personalized, encouraging daily briefings
- Use GTD methodology principles
- Be concise but comprehensive
- Use appropriate emojis for visual clarity
- Format in Telegram Markdown
- End with a motivational note

Guidelines:
- Start with a warm, personalized greeting
- Prioritize overdue items first (these need immediate attention)
- Highlight today's scheduled tasks
- Show ready-to-work next actions
- Mention items waiting for others
- Include active time tracking if present
- Reference yesterday's accomplishments if any
- Provide actionable insights, not just lists
- Keep total length under 1000 characters for readability
- Use bullet points and clear sections
- Include a brief motivational closing`;

    // Prepare context data for the AI
    const contextData = {
      username: user.username,
      date: today,
      todayTasks: todayTasks.length,
      todayTaskTitles: todayTasks.slice(0, 5).map((t: TodoItem) => t.title),
      overdueTasks: overdueTasks.length,
      overdueTaskTitles: overdueTasks.slice(0, 3).map((t: TodoItem) => t.title),
      nextActions: nextActions.length,
      nextActionTitles: nextActions.slice(0, 3).map((t: TodoItem) => t.title),
      waitingItems: waitingItems.length,
      waitingItemTitles: waitingItems.slice(0, 2).map((t: TodoItem) => t.title),
      activeTracking: activeTracking
        ? { title: activeTracking.title, duration: activeTracking.duration }
        : null,
      yesterdayCompleted: yesterdayCompleted.length,
    };

    // Create the conversation input with structured data
    const conversationInput = `Generate a daily briefing for ${user.username} for ${new Date(
      today,
    ).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    })}.

Context data:
${JSON.stringify(contextData, null, 2)}

Please create a comprehensive but concise daily briefing following GTD principles. Focus on actionable insights and maintain an encouraging, productive tone.`;

    try {
      const briefing = await claudeService.generateResponse(
        conversationInput,
        systemPrompt,
      );

      logger.info('AI briefing generated successfully', {
        userId: user._id,
        briefingLength: briefing.length,
      });

      return briefing;
    } catch (error) {
      logger.error('Failed to generate AI briefing', {
        userId: user._id,
        error,
      });

      // Re-throw to let caller handle fallback
      throw error;
    }
  }

  /**
   * Generate a simple fallback briefing if AI generation fails
   */
  private generateFallbackBriefing(context: BriefingContext): string {
    return `🌅 **Good Morning, ${context.user.username}!**

Your daily briefing for ${context.today}:

📋 **Quick Summary:**
- Check your todos for today's tasks
- Review any overdue items
- Focus on your next actions

💪 **Ready to make today productive!**

_This is a simplified briefing. The AI-generated summary is temporarily unavailable._`;
  }

  /**
   * Get scheduler status
   */
  getStatus(): {
    isRunning: boolean;
    briefingHour: number;
    lastBriefingDate: string | null;
    checkIntervalMs: number;
  } {
    return {
      isRunning: this.isRunning,
      briefingHour: this.briefingHour,
      lastBriefingDate: this.lastBriefingDate,
      checkIntervalMs: this.checkIntervalMs,
    };
  }
}

/**
 * Factory function to create a daily briefing scheduler
 */
export function createDailyBriefingScheduler(
  config: DailyBriefingSchedulerConfig,
): DailyBriefingScheduler {
  return new DailyBriefingScheduler(config);
}
