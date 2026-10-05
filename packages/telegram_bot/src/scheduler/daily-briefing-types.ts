import type { Bot } from 'grammy';

import type { BotContext } from '../bot/bot.js';

export interface DailyBriefingSchedulerConfig {
  bot: Bot<BotContext>;
  checkIntervalMs: number;
}

export interface DailyBriefingSchedulerStatus {
  isRunning: boolean;
  currentDatesByTimeZone: Record<string, string>;
  sentBriefingsToday: number;
  sentRecapsToday: number;
  checkIntervalMs: number;
}
