import { createEnv, createUserRegistry } from '@eddo/core-server';
import type { Bot } from 'grammy';

import { SimpleAgent } from '../agent/simple-agent.js';
import type { BotContext } from '../bot/bot.js';
import {
  BRIEFING_CONTENT_MARKER,
  DAILY_BRIEFING_REQUEST_MESSAGE,
} from '../constants/briefing.js';
import { logger } from '../utils/logger.js';
import type { TelegramUser } from '../utils/user-lookup.js';

interface DailyBriefingSchedulerConfig {
  bot: Bot<BotContext>;
  checkIntervalMs: number; // How often to check for briefing time
}

export class DailyBriefingScheduler {
  private bot: Bot<BotContext>;
  private checkIntervalMs: number;
  private intervalId: NodeJS.Timeout | null = null;
  private sentBriefingsToday: Set<string> = new Set(); // Track sent briefings by user ID per day
  private currentDate: string | null = null; // Track current date to reset sent briefings
  private isRunning = false;

  constructor(config: DailyBriefingSchedulerConfig) {
    this.bot = config.bot;
    this.checkIntervalMs = config.checkIntervalMs;

    logger.info('Daily briefing scheduler created', {
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
    const todayDate = now.toISOString().split('T')[0];

    // Reset sent briefings if it's a new day
    if (this.currentDate !== todayDate) {
      this.sentBriefingsToday.clear();
      this.currentDate = todayDate;
      logger.info('New day detected, reset sent briefings tracker', {
        date: todayDate,
      });
    }

    try {
      await this.checkAndSendUserBriefings(now);
    } catch (error) {
      logger.error('Failed to check and send daily briefings', { error });
    }
  }

  /**
   * Check each user's briefing time and send if it's time
   */
  private async checkAndSendUserBriefings(now: Date): Promise<void> {
    const env = createEnv();
    const userRegistry = createUserRegistry(env.COUCHDB_URL, env);
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    try {
      // Get all active users with briefings enabled
      const users = await userRegistry.list();
      const briefingUsers = users.filter(
        (user) =>
          user.status === 'active' &&
          user.preferences?.dailyBriefing === true &&
          user.telegram_id,
      );

      logger.debug('Checking briefing times for users', {
        totalUsers: users.length,
        briefingUsers: briefingUsers.length,
        currentTime: `${currentHour}:${currentMinute.toString().padStart(2, '0')}`,
      });

      // Check each user's individual briefing time
      for (const user of briefingUsers) {
        // Type assertion is safe because we filtered for users with telegram_id
        await this.checkUserBriefingTime(
          user as TelegramUser,
          currentHour,
          currentMinute,
        );
      }
    } catch (error) {
      logger.error('Failed to check user briefing times', { error });
    }
  }

  /**
   * Check if it's time to send a briefing to a specific user
   */
  private async checkUserBriefingTime(
    user: TelegramUser,
    currentHour: number,
    currentMinute: number,
  ): Promise<void> {
    // Skip if already sent briefing to this user today
    if (this.sentBriefingsToday.has(user._id)) {
      return;
    }

    // Parse user's briefing time (format: "HH:MM")
    const briefingTime = user.preferences?.briefingTime || '07:00';
    const [userHour, userMinute] = briefingTime.split(':').map(Number);

    // Check if it's the right time for this user (within 5-minute window)
    const isRightHour = currentHour === userHour;
    const isWithinWindow =
      currentMinute >= userMinute && currentMinute < userMinute + 5;

    if (isRightHour && isWithinWindow) {
      logger.info('Sending briefing to user at their preferred time', {
        userId: user._id,
        username: user.username,
        briefingTime,
        currentTime: `${currentHour}:${currentMinute.toString().padStart(2, '0')}`,
      });

      try {
        await this.sendBriefingToUser(user);
        this.sentBriefingsToday.add(user._id);

        logger.info('Successfully sent briefing to user', {
          userId: user._id,
          username: user.username,
        });
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
   * Send daily briefings to all users with briefings enabled (LEGACY - kept for backward compatibility)
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

      const briefingRequestMessage = DAILY_BRIEFING_REQUEST_MESSAGE;

      // Create a minimal bot context for the agent
      const mockContext = {
        from: { id: user.telegram_id },
        message: { text: briefingRequestMessage },
      } as BotContext; // Type assertion for simplified mock

      const result = await agent.execute(
        briefingRequestMessage,
        user._id,
        mockContext,
      );
      const briefingMessage =
        result.finalResponse || '❌ Failed to generate briefing';

      // Check if briefing contains the marker (indicates actual briefing content)
      const hasBriefingMarker = briefingMessage.includes(
        BRIEFING_CONTENT_MARKER,
      );

      if (hasBriefingMarker) {
        // Strip the marker before sending to Telegram and printing
        const briefingWithoutMarker = briefingMessage.replaceAll(
          BRIEFING_CONTENT_MARKER,
          '',
        );

        // Send to Telegram
        await this.bot.api.sendMessage(
          user.telegram_id,
          briefingWithoutMarker,
          {
            parse_mode: 'Markdown',
            link_preview_options: { is_disabled: true },
          },
        );

        // Auto-print to thermal printer if enabled (both globally and for user)
        const userWantsPrinting = user.preferences?.printBriefing === true;

        if (userWantsPrinting) {
          try {
            // Dynamic import to avoid loading printer dependencies if not enabled
            const printerModule = await import('@eddo/printer-service');

            if (printerModule.appConfig.PRINTER_ENABLED) {
              logger.info('🖨️ Printing scheduled briefing to thermal printer', {
                userId: user._id,
                username: user.username,
              });

              // Format content for thermal printer
              const formattedContent = printerModule.formatBriefingForPrint(
                briefingWithoutMarker,
              );

              await printerModule.printBriefing({
                content: formattedContent,
                userId: user._id,
                timestamp: new Date().toISOString(),
              });

              logger.info('✅ Scheduled briefing printed successfully');
            } else {
              logger.debug(
                '🖨️ Printer globally disabled (PRINTER_ENABLED=false)',
              );
            }
          } catch (printerError) {
            // Don't fail scheduled briefing if print fails
            logger.error('❌ Failed to print scheduled briefing (non-fatal)', {
              error:
                printerError instanceof Error
                  ? printerError.message
                  : String(printerError),
            });
          }
        } else {
          logger.debug('🖨️ User has printing disabled, skipping print', {
            userId: user._id,
          });
        }

        logger.info('Daily briefing sent successfully via agent', {
          userId: user._id,
          username: user.username,
          telegramId: user.telegram_id,
          outputLength: briefingWithoutMarker.length,
        });
      } else {
        // No marker found - just send the message as-is (fallback)
        await this.bot.api.sendMessage(user.telegram_id, briefingMessage, {
          parse_mode: 'Markdown',
          link_preview_options: { is_disabled: true },
        });

        logger.warn('Briefing sent without marker (printer skipped)', {
          userId: user._id,
          username: user.username,
        });
      }
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
    currentDate: string | null;
    sentBriefingsToday: number;
    checkIntervalMs: number;
  } {
    return {
      isRunning: this.isRunning,
      currentDate: this.currentDate,
      sentBriefingsToday: this.sentBriefingsToday.size,
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
