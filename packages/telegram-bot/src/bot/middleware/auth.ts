import { Context } from 'grammy';

import { allowedUsers } from '../../utils/config';

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

  if (!userId) {
    await ctx.reply('❌ Unable to verify your identity. Please try again.');
    return;
  }

  if (!isUserAuthorized(userId)) {
    await ctx.reply(
      '🚫 Unauthorized: You are not allowed to use this bot.\n\n' +
        'If you believe this is an error, please contact the bot administrator.',
    );
    return;
  }

  // User is authorized, proceed to next middleware/handler
  await next();
}
