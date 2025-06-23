import { Bot, Context, session } from 'grammy';
import { appConfig } from '../utils/config.js';
import { logger } from '../utils/logger.js';

// Define session data structure
interface SessionData {
  userId: string;
  conversationId?: string;
  lastActivity: Date;
  context: Record<string, unknown>;
}

// Extend the context with session data
type BotContext = Context & {
  session: SessionData;
};

/**
 * Create the Telegram bot instance with session support
 */
export function createBot(): Bot<BotContext> {
  const bot = new Bot<BotContext>(appConfig.TELEGRAM_BOT_TOKEN);

  // Add session middleware
  bot.use(session({
    initial: (): SessionData => ({
      userId: '',
      lastActivity: new Date(),
      context: {},
    }),
  }));

  // Add logging middleware
  bot.use(async (ctx, next) => {
    const start = Date.now();
    const userId = ctx.from?.id;
    const username = ctx.from?.username;
    const messageText = ctx.message?.text;

    logger.info('Incoming message', {
      userId,
      username,
      messageText: messageText?.substring(0, 100), // Truncate for logging
      chatId: ctx.chat?.id,
    });

    // Update session data
    if (userId) {
      ctx.session.userId = userId.toString();
      ctx.session.lastActivity = new Date();
    }

    try {
      await next();
    } catch (error) {
      logger.error('Error processing message', {
        error: error instanceof Error ? error.message : String(error),
        userId,
        username,
        messageText,
      });
      
      // Send error message to user
      await ctx.reply('Sorry, I encountered an error processing your request. Please try again.');
    }

    const duration = Date.now() - start;
    logger.info('Message processed', { userId, duration });
  });

  // Add rate limiting middleware
  const userLastMessage = new Map<number, number>();
  bot.use(async (ctx, next) => {
    const userId = ctx.from?.id;
    if (!userId) return next();

    const now = Date.now();
    const lastMessage = userLastMessage.get(userId) || 0;
    const timeDiff = now - lastMessage;

    // Rate limit: 1 message per second
    if (timeDiff < 1000) {
      logger.warn('Rate limit exceeded', { userId, timeDiff });
      await ctx.reply('Please wait a moment before sending another message.');
      return;
    }

    userLastMessage.set(userId, now);
    return next();
  });

  return bot;
}

export type { BotContext, SessionData };
