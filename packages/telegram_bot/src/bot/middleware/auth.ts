import { appConfig } from '../../utils/config.js';
import { logger } from '../../utils/logger.js';
import { isTelegramUserAuthorized, lookupUserByTelegramId } from '../../utils/user-lookup.js';
import type { BotContext } from '../bot.js';
import {
  buildRateLimitedMessage,
  buildRateLimitExceededMessage,
  buildUnauthorizedMessage,
  extractUserDetails,
  generateLinkingInstructions,
} from './auth-helpers.js';

interface AuthFailureRecord {
  count: number;
  firstFailure: number;
  lastFailure: number;
}

// Rate limiting configuration
const AUTH_FAILURE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MAX_AUTH_FAILURES = 5; // Max failures per window
const RATE_LIMIT_DURATION_MS = 15 * 60 * 1000; // 15 minutes penalty

// Track auth failures per user ID
const authFailures = new Map<number, AuthFailureRecord>();

// Clean up old failure records periodically
setInterval(() => {
  const now = Date.now();
  for (const [userId, record] of authFailures.entries()) {
    if (now - record.lastFailure > RATE_LIMIT_DURATION_MS) {
      authFailures.delete(userId);
    }
  }
}, 60 * 1000); // Clean up every minute

export function recordAuthFailure(userId: number): void {
  const now = Date.now();
  const existing = authFailures.get(userId);

  if (!existing || now - existing.firstFailure > AUTH_FAILURE_WINDOW_MS) {
    authFailures.set(userId, { count: 1, firstFailure: now, lastFailure: now });
  } else {
    authFailures.set(userId, {
      count: existing.count + 1,
      firstFailure: existing.firstFailure,
      lastFailure: now,
    });
  }
}

export function isRateLimited(userId: number): boolean {
  const record = authFailures.get(userId);
  if (!record) return false;

  const now = Date.now();
  return record.count >= MAX_AUTH_FAILURES && now - record.lastFailure < RATE_LIMIT_DURATION_MS;
}

// Export for testing
export {
  AUTH_FAILURE_WINDOW_MS,
  authFailures,
  generateLinkingInstructions,
  MAX_AUTH_FAILURES,
  RATE_LIMIT_DURATION_MS,
};

export async function isUserAuthorized(userId: number): Promise<boolean> {
  try {
    return await isTelegramUserAuthorized(userId);
  } catch (error) {
    logger.error('Error checking user authorization', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

async function handleRateLimitedUser(ctx: BotContext, userId: number): Promise<void> {
  logger.warn('Rate limited user attempted access', {
    userId,
    ...(appConfig.TELEGRAM_LOG_USER_DETAILS ? { username: ctx.from?.username } : {}),
    chatId: ctx.chat?.id,
    messageText: ctx.message?.text,
    failureRecord: authFailures.get(userId),
  });
  await ctx.reply(buildRateLimitedMessage(userId));
}

async function handleUnauthorizedUser(ctx: BotContext, userId: number): Promise<void> {
  recordAuthFailure(userId);
  const failureRecord = authFailures.get(userId);
  const isNowRateLimited = isRateLimited(userId);

  logger.warn('Unauthorized access attempt', {
    userId,
    ...extractUserDetails(ctx, appConfig.TELEGRAM_LOG_USER_DETAILS),
    chatId: ctx.chat?.id,
    messageText: ctx.message?.text,
    authMethod: 'user_registry',
    failureCount: failureRecord?.count,
    rateLimited: isNowRateLimited,
  });

  if (isNowRateLimited) {
    await ctx.reply(buildRateLimitExceededMessage(userId));
  } else {
    const remainingAttempts = MAX_AUTH_FAILURES - (failureRecord?.count || 0);
    await ctx.reply(buildUnauthorizedMessage(userId, remainingAttempts));
  }
}

async function populateUserSession(ctx: BotContext, userId: number): Promise<void> {
  try {
    const user = await lookupUserByTelegramId(userId);
    if (user) {
      ctx.session.user = user;
      logger.debug('User data populated in session', {
        telegramId: userId,
        username: user.username,
      });
    }
  } catch (error) {
    logger.error('Error populating user data in session', {
      telegramId: userId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function authMiddleware(ctx: BotContext, next: () => Promise<void>): Promise<void> {
  const userId = ctx.from?.id;

  if (!userId) {
    logger.warn('Authentication failed: No user ID available', {
      chat: ctx.chat?.id,
      messageText: ctx.message?.text,
    });
    await ctx.reply('❌ Unable to verify your identity. Please try again.');
    return;
  }

  if (!(await isUserAuthorized(userId))) {
    if (isRateLimited(userId)) {
      await handleRateLimitedUser(ctx, userId);
    } else {
      await handleUnauthorizedUser(ctx, userId);
    }
    return;
  }

  await populateUserSession(ctx, userId);
  await next();
}
