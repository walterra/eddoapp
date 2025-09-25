import { createEnv, createUserRegistry } from '@eddo/core-server';
import type { Bot } from 'grammy';

import { SimpleAgent } from '../agent/simple-agent.js';
import type { BotContext } from '../bot/bot.js';
import type { MCPClient } from '../mcp/client.js';
import { extractUserContextForMCP } from '../mcp/user-context.js';
import { logger } from '../utils/logger.js';
import type { TelegramUser } from '../utils/user-lookup.js';

interface DailyBriefingSchedulerConfig {
  bot: Bot<BotContext>;
  mcpClient: MCPClient;
  briefingHour: number; // Hour in 24-hour format (e.g., 7 for 7 AM)
  checkIntervalMs: number; // How often to check for briefing time
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

    logger.info('Generating briefing for user via agent', {
      userId: user._id,
      username: user.username,
      telegramId: user.telegram_id,
    });

    try {
      // Generate briefing content using the agent
      const agent = new SimpleAgent();

      const briefingRequestMessage =
        'Generate a daily briefing for me including todays tasks, overdue items, next actions, waiting items, and active time tracking.';

      // Create a minimal bot context for the agent
      const mockContext = {
        from: { id: user.telegram_id },
        message: { text: briefingRequestMessage },
      } as any; // Type assertion for simplified mock

      const result = await agent.execute(
        briefingRequestMessage,
        user._id,
        mockContext,
      );
      const briefingMessage =
        result.finalResponse || '❌ Failed to generate briefing';

      // Send the briefing via Telegram
      await this.bot.api.sendMessage(user.telegram_id, briefingMessage, {
        parse_mode: 'Markdown',
        link_preview_options: { is_disabled: true },
      });

      logger.info('Daily briefing sent successfully via agent', {
        userId: user._id,
        username: user.username,
        telegramId: user.telegram_id,
        outputLength: briefingMessage.length,
      });
    } catch (error) {
      logger.error('Failed to generate or send briefing via agent', {
        userId: user._id,
        username: user.username,
        error,
      });
      throw error;
    }
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
