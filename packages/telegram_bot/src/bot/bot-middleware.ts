/**
 * Bot middleware functions
 */
import { Context } from 'grammy';

import { logger } from '../utils/logger.js';

interface SessionContext extends Context {
  session: {
    userId: string;
    lastActivity: Date;
    context: Record<string, unknown>;
    lastBotMessage?: string;
  };
}

/**
 * Creates the logging middleware for incoming messages
 */
export function createLoggingMiddleware<T extends SessionContext>() {
  return async (ctx: T, next: () => Promise<void>) => {
    const start = Date.now();
    const userId = ctx.from?.id;
    const username = ctx.from?.username;
    const messageText = ctx.message?.text;

    logger.info('Incoming message', {
      userId,
      username,
      messageText: messageText?.substring(0, 100),
      chatId: ctx.chat?.id,
    });

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
      await ctx.reply('Sorry, I encountered an error processing your request. Please try again.');
    }

    const duration = Date.now() - start;
    logger.info('Message processed', { userId, duration });
  };
}

/**
 * Creates the rate limiting middleware
 * @param rateMs - Minimum time between messages in milliseconds
 */
export function createRateLimitMiddleware<T extends Context>(rateMs = 1000) {
  const userLastMessage = new Map<number, number>();

  return async (ctx: T, next: () => Promise<void>) => {
    const userId = ctx.from?.id;
    if (!userId) return next();

    const now = Date.now();
    const lastMessage = userLastMessage.get(userId) || 0;
    const timeDiff = now - lastMessage;

    if (timeDiff < rateMs) {
      logger.warn('Rate limit exceeded', { userId, timeDiff });
      await ctx.reply('Please wait a moment before sending another message.');
      return;
    }

    userLastMessage.set(userId, now);
    return next();
  };
}
