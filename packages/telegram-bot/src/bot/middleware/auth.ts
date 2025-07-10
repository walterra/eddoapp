import { Context } from 'grammy';

import { allowedUsers } from '../../utils/config';
import { logger } from '../../utils/logger';

export function isUserAuthorized(userId: number): boolean {
  // If no users are configured, deny all access for security
  if (allowedUsers.size === 0) {
    return false;
  }

  return allowedUsers.has(userId);
}

export async function authMiddleware(
  ctx: Context,
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

  if (!isUserAuthorized(userId)) {
    logger.warn('Unauthorized access attempt', {
      userId,
      username,
      firstName: ctx.from?.first_name,
      lastName: ctx.from?.last_name,
      chatId: ctx.chat?.id,
      messageText: ctx.message?.text,
      allowedUsersCount: allowedUsers.size,
    });

    await ctx.reply(
      '🚫 Unauthorized: You are not allowed to use this bot.\n\n' +
        'If you believe this is an error, please contact the bot administrator.',
    );
    return;
  }

  // User is authorized, proceed to next middleware/handler
  await next();
}
