import { appConfig } from '../../utils/config.js';
import { logger } from '../../utils/logger.js';
import {
  isTelegramUserAuthorized,
  lookupUserByTelegramId,
} from '../../utils/user-lookup.js';
import type { BotContext } from '../bot.js';

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
    // First failure or outside window, reset
    authFailures.set(userId, {
      count: 1,
      firstFailure: now,
      lastFailure: now,
    });
  } else {
    // Increment failure count within window
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

  // Check if user has exceeded failure limit and is still in penalty period
  if (
    record.count >= MAX_AUTH_FAILURES &&
    now - record.lastFailure < RATE_LIMIT_DURATION_MS
  ) {
    return true;
  }

  return false;
}

// Helper function to generate linking instructions
function generateLinkingInstructions(userId: number): string {
  return (
    `📱 Your Telegram ID: ${userId}\n\n` +
    '🔗 To link your account:\n' +
    '1. Go to the web app and log in\n' +
    '2. Click "Profile" in the header\n' +
    '3. Go to "Integrations" tab\n' +
    '4. Enter your Telegram ID above\n' +
    '5. Follow the linking instructions\n\n'
  );
}

// Export for testing
export {
  authFailures,
  MAX_AUTH_FAILURES,
  AUTH_FAILURE_WINDOW_MS,
  RATE_LIMIT_DURATION_MS,
  generateLinkingInstructions,
};

export async function isUserAuthorized(userId: number): Promise<boolean> {
  try {
    return await isTelegramUserAuthorized(userId);
  } catch (error) {
    logger.error('Error checking user authorization', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    // Default to deny access on error for security
    return false;
  }
}

export async function authMiddleware(
  ctx: BotContext,
  next: () => Promise<void>,
): Promise<void> {
  const userId = ctx.from?.id;
  const username = ctx.from?.username;

  if (!userId) {
    logger.warn('Authentication failed: No user ID available', {
      chat: ctx.chat?.id,
      messageText: ctx.message?.text,
    });
    await ctx.reply('❌ Unable to verify your identity. Please try again.');
    return;
  }

  if (!(await isUserAuthorized(userId))) {
    // Check if user is rate limited due to previous auth failures
    if (isRateLimited(userId)) {
      logger.warn('Rate limited user attempted access', {
        userId,
        ...(appConfig.TELEGRAM_LOG_USER_DETAILS ? { username } : {}),
        chatId: ctx.chat?.id,
        messageText: ctx.message?.text,
        failureRecord: authFailures.get(userId),
      });

      await ctx.reply(
        '⏰ Too many unauthorized attempts. Please wait 15 minutes before trying again.\n\n' +
          generateLinkingInstructions(userId) +
          'If you believe this is an error, please contact the bot administrator.',
      );
      return;
    }
    // Record the auth failure for rate limiting
    recordAuthFailure(userId);

    const failureRecord = authFailures.get(userId);
    const isNowRateLimited = isRateLimited(userId);

    logger.warn('Unauthorized access attempt', {
      userId,
      ...(appConfig.TELEGRAM_LOG_USER_DETAILS
        ? {
            username,
            firstName: ctx.from?.first_name,
            lastName: ctx.from?.last_name,
          }
        : {}),
      chatId: ctx.chat?.id,
      messageText: ctx.message?.text,
      authMethod: 'user_registry',
      failureCount: failureRecord?.count,
      rateLimited: isNowRateLimited,
    });

    if (isNowRateLimited) {
      await ctx.reply(
        '🚫 Too many unauthorized attempts. Access has been temporarily restricted.\n\n' +
          generateLinkingInstructions(userId) +
          'Please wait 15 minutes before trying again. If you believe this is an error, please contact the bot administrator.',
      );
    } else {
      const remainingAttempts = MAX_AUTH_FAILURES - (failureRecord?.count || 0);
      await ctx.reply(
        '🚫 Unauthorized: You are not allowed to use this bot.\n\n' +
          generateLinkingInstructions(userId) +
          `${remainingAttempts} attempts remaining before temporary restriction.\n\n` +
          'If you believe this is an error, please contact the bot administrator.',
      );
    }
    return;
  }

  // User is authorized, populate session with user data
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
    // Continue anyway - auth already passed
  }

  // User is authorized, proceed to next middleware/handler
  await next();
}
