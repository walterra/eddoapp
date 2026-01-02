import { createEnv, createUserRegistry } from '@eddo/core-server';
import type { Bot } from 'grammy';

import type { BotContext } from '../bot/bot.js';
import {
  BRIEFING_CONTENT_MARKER,
  DAILY_BRIEFING_REQUEST_MESSAGE,
  getRecapRequestMessage,
  RECAP_CONTENT_MARKER,
} from '../constants/briefing.js';
import { logger } from '../utils/logger.js';
import type { TelegramUser } from '../utils/user-lookup.js';

import {
  executeAgentForUser,
  logSuccessfulSend,
  printIfEnabled,
  sendTelegramMessage,
  stripMarker,
} from './helpers/index.js';

interface DailyBriefingSchedulerConfig {
  bot: Bot<BotContext>;
  checkIntervalMs: number;
}

export class DailyBriefingScheduler {
  private bot: Bot<BotContext>;
  private checkIntervalMs: number;
  private intervalId: NodeJS.Timeout | null = null;
  private sentBriefingsToday: Set<string> = new Set();
  private sentRecapsToday: Set<string> = new Set();
  private currentDate: string | null = null;
  private isRunning = false;

  constructor(config: DailyBriefingSchedulerConfig) {
    this.bot = config.bot;
    this.checkIntervalMs = config.checkIntervalMs;

    logger.info('Daily briefing scheduler created', { checkIntervalMs: this.checkIntervalMs });
  }

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

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    logger.info('Daily briefing scheduler stopped');
  }

  private async checkAndSendBriefings(): Promise<void> {
    const now = new Date();
    const todayDate = now.toISOString().split('T')[0];

    if (this.currentDate !== todayDate) {
      this.sentBriefingsToday.clear();
      this.sentRecapsToday.clear();
      this.currentDate = todayDate;
      logger.info('New day detected, reset sent briefings/recaps tracker', { date: todayDate });
    }

    try {
      await this.checkAndSendUserBriefings(now);
      await this.checkAndSendUserRecaps(now);
    } catch (error) {
      logger.error('Failed to check and send daily briefings/recaps', { error });
    }
  }

  private async checkAndSendUserBriefings(now: Date): Promise<void> {
    const env = createEnv();
    const userRegistry = createUserRegistry(env.COUCHDB_URL, env);
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    try {
      const users = await userRegistry.list();
      const briefingUsers = users.filter(
        (user) =>
          user.status === 'active' && user.preferences?.dailyBriefing === true && user.telegram_id,
      );

      logger.debug('Checking briefing times for users', {
        totalUsers: users.length,
        briefingUsers: briefingUsers.length,
        currentTime: `${currentHour}:${currentMinute.toString().padStart(2, '0')}`,
      });

      for (const user of briefingUsers) {
        await this.checkUserBriefingTime(user as TelegramUser, currentHour, currentMinute);
      }
    } catch (error) {
      logger.error('Failed to check user briefing times', { error });
    }
  }

  private async checkUserBriefingTime(
    user: TelegramUser,
    currentHour: number,
    currentMinute: number,
  ): Promise<void> {
    if (this.sentBriefingsToday.has(user._id)) return;

    const briefingTime = user.preferences?.briefingTime || '07:00';
    if (!this.isWithinTimeWindow(briefingTime, currentHour, currentMinute)) return;

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

  private isWithinTimeWindow(timeStr: string, currentHour: number, currentMinute: number): boolean {
    const [userHour, userMinute] = timeStr.split(':').map(Number);
    const isRightHour = currentHour === userHour;
    const isWithinWindow = currentMinute >= userMinute && currentMinute < userMinute + 5;
    return isRightHour && isWithinWindow;
  }

  private async sendBriefingToUser(user: TelegramUser): Promise<void> {
    if (!user.telegram_id) {
      logger.warn('User has no telegram_id', { userId: user._id });
      return;
    }

    const result = await executeAgentForUser(
      user,
      DAILY_BRIEFING_REQUEST_MESSAGE,
      BRIEFING_CONTENT_MARKER,
      'briefing',
    );

    if (result.hasMarker) {
      const cleanMessage = stripMarker(result.message, BRIEFING_CONTENT_MARKER);
      await sendTelegramMessage(this.bot, {
        telegramId: user.telegram_id,
        message: cleanMessage,
        disableLinkPreview: true,
      });

      if (user.preferences?.printBriefing) {
        await printIfEnabled({
          userId: user._id,
          username: user.username,
          content: cleanMessage,
          type: 'briefing',
        });
      }

      logSuccessfulSend({
        contentType: 'briefing',
        userId: user._id,
        username: user.username,
        telegramId: user.telegram_id,
        messageLength: cleanMessage.length,
      });
    } else {
      await sendTelegramMessage(this.bot, {
        telegramId: user.telegram_id,
        message: result.message,
        disableLinkPreview: true,
      });
      logger.warn('Briefing sent without marker (printer skipped)', {
        userId: user._id,
        username: user.username,
      });
    }
  }

  private async checkAndSendUserRecaps(now: Date): Promise<void> {
    const env = createEnv();
    const userRegistry = createUserRegistry(env.COUCHDB_URL, env);
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    try {
      const users = await userRegistry.list();
      const recapUsers = users.filter(
        (user) =>
          user.status === 'active' && user.preferences?.dailyRecap === true && user.telegram_id,
      );

      logger.debug('Checking recap times for users', {
        totalUsers: users.length,
        recapUsers: recapUsers.length,
        currentTime: `${currentHour}:${currentMinute.toString().padStart(2, '0')}`,
      });

      for (const user of recapUsers) {
        await this.checkUserRecapTime(user as TelegramUser, currentHour, currentMinute);
      }
    } catch (error) {
      logger.error('Failed to check user recap times', { error });
    }
  }

  private async checkUserRecapTime(
    user: TelegramUser,
    currentHour: number,
    currentMinute: number,
  ): Promise<void> {
    if (this.sentRecapsToday.has(user._id)) return;

    const recapTime = user.preferences?.recapTime || '18:00';
    if (!this.isWithinTimeWindow(recapTime, currentHour, currentMinute)) return;

    logger.info('Sending recap to user at their preferred time', {
      userId: user._id,
      username: user.username,
      recapTime,
      currentTime: `${currentHour}:${currentMinute.toString().padStart(2, '0')}`,
    });

    try {
      await this.sendRecapToUser(user);
      this.sentRecapsToday.add(user._id);
      logger.info('Successfully sent recap to user', { userId: user._id, username: user.username });
    } catch (error) {
      logger.error('Failed to send recap to user', {
        userId: user._id,
        username: user.username,
        error,
      });
    }
  }

  private async sendRecapToUser(user: TelegramUser): Promise<void> {
    if (!user.telegram_id) {
      logger.warn('User has no telegram_id', { userId: user._id });
      return;
    }

    const result = await executeAgentForUser(
      user,
      getRecapRequestMessage(),
      RECAP_CONTENT_MARKER,
      'recap',
    );

    if (result.hasMarker) {
      const cleanMessage = stripMarker(result.message, RECAP_CONTENT_MARKER);
      await sendTelegramMessage(this.bot, { telegramId: user.telegram_id, message: cleanMessage });

      logSuccessfulSend({
        contentType: 'recap',
        userId: user._id,
        username: user.username,
        telegramId: user.telegram_id,
        messageLength: cleanMessage.length,
      });

      if (user.preferences?.printRecap) {
        await printIfEnabled({
          userId: user._id,
          username: user.username,
          content: cleanMessage,
          type: 'recap',
        });
      }
    } else {
      logger.warn('Recap did not contain expected marker, sending anyway', { userId: user._id });
      await sendTelegramMessage(this.bot, {
        telegramId: user.telegram_id,
        message: result.message,
      });
    }
  }

  getStatus(): {
    isRunning: boolean;
    currentDate: string | null;
    sentBriefingsToday: number;
    sentRecapsToday: number;
    checkIntervalMs: number;
  } {
    return {
      isRunning: this.isRunning,
      currentDate: this.currentDate,
      sentBriefingsToday: this.sentBriefingsToday.size,
      sentRecapsToday: this.sentRecapsToday.size,
      checkIntervalMs: this.checkIntervalMs,
    };
  }
}

export function createDailyBriefingScheduler(
  config: DailyBriefingSchedulerConfig,
): DailyBriefingScheduler {
  return new DailyBriefingScheduler(config);
}
