import { Bot, Context, session } from 'grammy';

import { appConfig } from '../utils/config.js';
import type { TelegramUser } from '../utils/user-lookup.js';
import { createLoggingMiddleware, createRateLimitMiddleware } from './bot-middleware.js';
import { authMiddleware } from './middleware/auth.js';

interface SessionData {
  userId: string;
  conversationId?: string;
  lastActivity: Date;
  context: Record<string, unknown>;
  lastBotMessage?: string;
  user?: TelegramUser;
}

type BotContext = Context & {
  session: SessionData;
};

function createInitialSession(): SessionData {
  return { userId: '', lastActivity: new Date(), context: {} };
}

/**
 * Creates the Telegram bot instance with session support
 */
export function createBot(): Bot<BotContext> {
  const bot = new Bot<BotContext>(appConfig.TELEGRAM_BOT_TOKEN);

  bot.use(session({ initial: createInitialSession }));
  bot.use(authMiddleware);
  bot.use(createLoggingMiddleware<BotContext>());
  bot.use(createRateLimitMiddleware<BotContext>(1000));

  return bot;
}

export type { BotContext };
