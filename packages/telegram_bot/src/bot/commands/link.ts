import { appConfig } from '../../utils/config.js';
import { logger } from '../../utils/logger.js';
import { BotContext } from '../bot.js';
import {
  CONNECTION_ERROR_MESSAGE,
  extractLinkCode,
  getErrorMessage,
  getSuccessMessage,
  LINK_HELP_MESSAGE,
  logLinkError,
  logLinkFailure,
  logLinkSuccess,
  UNLINK_MESSAGE,
} from './link-helpers.js';

/**
 * Call web API to link account
 */
async function callLinkApi(
  linkCode: string,
  userId: number | undefined,
): Promise<{ ok: boolean; status: number; data: Record<string, string> }> {
  const response = await fetch(`${appConfig.WEB_API_BASE_URL}/api/auth/link-telegram`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ linkCode, telegramId: userId }),
  });

  const data = await response.json();
  return { ok: response.ok, status: response.status, data };
}

/**
 * Handle the /link command to link Telegram account to web user
 */
export async function handleLink(ctx: BotContext): Promise<void> {
  const userId = ctx.from?.id;
  const firstName = ctx.from?.first_name || 'User';

  logger.info('User requested account linking', { userId, firstName });

  const linkCode = extractLinkCode(ctx.message?.text || '');

  if (!linkCode) {
    await ctx.reply(LINK_HELP_MESSAGE, { parse_mode: 'Markdown' });
    return;
  }

  try {
    const { ok, status, data } = await callLinkApi(linkCode, userId);

    if (!ok) {
      logLinkFailure(userId, linkCode, status, data.error);
      await ctx.reply(getErrorMessage(status, data.error), { parse_mode: 'Markdown' });
      return;
    }

    logLinkSuccess(userId, data.username, linkCode);
    await ctx.reply(getSuccessMessage(firstName, data.username), { parse_mode: 'Markdown' });
  } catch (error) {
    logLinkError(error, userId, linkCode);
    await ctx.reply(CONNECTION_ERROR_MESSAGE, { parse_mode: 'Markdown' });
  }
}

/**
 * Handle the /unlink command to unlink Telegram account
 */
export async function handleUnlink(ctx: BotContext): Promise<void> {
  const userId = ctx.from?.id;
  const firstName = ctx.from?.first_name || 'User';

  logger.info('User requested account unlinking', { userId, firstName });
  await ctx.reply(UNLINK_MESSAGE, { parse_mode: 'Markdown' });
}
