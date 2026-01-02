import { Context } from 'grammy';

import {
  DAILY_BRIEFING_REQUEST_MESSAGE,
  getRecapRequestMessage,
} from '../../constants/briefing.js';
import { logger } from '../../utils/logger.js';
import { TelegramUser, lookupUserByTelegramId } from '../../utils/user-lookup.js';
import type { BotContext } from '../bot.js';
import { handleMessage } from '../handlers/message.js';
import {
  buildBriefingErrorMessage,
  buildDisabledMessage,
  buildEnabledMessage,
  buildHelpMessage,
  buildStatusMessage,
  logBriefingAction,
  parseCommandArgs,
  sendNotLinkedError,
  sendUnableToIdentifyError,
  updateBriefingPreferences,
} from './briefing-helpers.js';

type BriefingAction = 'on' | 'enable' | 'off' | 'disable' | 'status' | 'now' | 'recap';

const actionHandlers: Record<BriefingAction, (ctx: Context, user: TelegramUser) => Promise<void>> =
  {
    on: enableDailyBriefing,
    enable: enableDailyBriefing,
    off: disableDailyBriefing,
    disable: disableDailyBriefing,
    status: showBriefingStatus,
    now: generateBriefingNow,
    recap: generateBriefingRecap,
  };

function isBriefingAction(action: string): action is BriefingAction {
  return action in actionHandlers;
}

async function dispatchBriefingAction(
  ctx: Context,
  user: TelegramUser,
  args: string[],
): Promise<void> {
  if (args.length === 0) {
    await showBriefingStatus(ctx, user);
    return;
  }

  const action = args[0].toLowerCase();
  const handler = isBriefingAction(action) ? actionHandlers[action] : null;

  if (handler) {
    await handler(ctx, user);
  } else {
    await ctx.reply(buildHelpMessage());
  }
}

/**
 * Handles /briefing command to enable/disable daily briefings
 */
export async function handleBriefing(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;

  if (!telegramId) {
    await sendUnableToIdentifyError(ctx);
    return;
  }

  logger.info('Processing briefing command', { telegramId, command: ctx.message?.text });

  try {
    const user = await lookupUserByTelegramId(telegramId);
    if (!user) {
      await sendNotLinkedError(ctx);
      return;
    }

    await dispatchBriefingAction(ctx, user, parseCommandArgs(ctx.message?.text));
  } catch (error) {
    logger.error('Error processing briefing command', { telegramId, error });
    await ctx.reply(
      '❌ Sorry, there was an error processing your request. Please try again later.',
    );
  }
}

async function enableDailyBriefing(ctx: Context, user: TelegramUser): Promise<void> {
  try {
    await updateBriefingPreferences(user, true);
    logBriefingAction('enabled', user);
    await ctx.reply(buildEnabledMessage(user.preferences?.briefingTime || '07:00'));
  } catch (error) {
    logger.error('Failed to enable daily briefing', { userId: user._id, error });
    await ctx.reply(
      '❌ Failed to enable daily briefings. Please try again or check your settings in the web app.',
    );
  }
}

async function disableDailyBriefing(ctx: Context, user: TelegramUser): Promise<void> {
  try {
    await updateBriefingPreferences(user, false);
    logBriefingAction('disabled', user);
    await ctx.reply(buildDisabledMessage());
  } catch (error) {
    logger.error('Failed to disable daily briefing', { userId: user._id, error });
    await ctx.reply(
      '❌ Failed to disable daily briefings. Please try again or check your settings in the web app.',
    );
  }
}

async function showBriefingStatus(ctx: Context, user: TelegramUser): Promise<void> {
  await ctx.reply(buildStatusMessage(user));
}

async function generateBriefingNow(ctx: Context, user: TelegramUser): Promise<void> {
  try {
    logger.info('Generating on-demand briefing via agent', {
      userId: user._id,
      username: user.username,
      telegramId: user.telegram_id,
    });

    if (ctx.message) {
      ctx.message.text = DAILY_BRIEFING_REQUEST_MESSAGE;
    }

    await handleMessage(ctx as BotContext);

    logger.info('On-demand briefing generated via agent', {
      userId: user._id,
      username: user.username,
      telegramId: user.telegram_id,
    });
  } catch (error) {
    logger.error('Failed to generate on-demand briefing via agent', { userId: user._id, error });
    await ctx.reply(buildBriefingErrorMessage());
  }
}

async function generateBriefingRecap(ctx: Context, user: TelegramUser): Promise<void> {
  try {
    logger.info('Generating daily recap via agent', {
      userId: user._id,
      username: user.username,
      telegramId: user.telegram_id,
    });

    if (ctx.message) {
      ctx.message.text = getRecapRequestMessage();
    }

    await handleMessage(ctx as BotContext);

    logger.info('Daily recap generated via agent', {
      userId: user._id,
      username: user.username,
      telegramId: user.telegram_id,
    });
  } catch (error) {
    logger.error('Failed to generate daily recap via agent', { userId: user._id, error });
    await ctx.reply(
      '❌ **Sorry, there was an error generating your recap.**\n\n' +
        'This could be due to:\n' +
        '• Temporary connectivity issues\n' +
        '• AI service unavailability\n' +
        '• Database access problems\n\n' +
        'Please try again in a few moments, or contact support if the problem persists.',
    );
  }
}

/**
 * Handle the legacy /briefing_on command (for backward compatibility)
 */
export async function handleBriefingOn(ctx: Context): Promise<void> {
  // Redirect to main briefing handler with 'on' argument
  if (ctx.message) {
    ctx.message.text = '/briefing on';
  }
  await handleBriefing(ctx);
}

/**
 * Handle the legacy /briefing_off command (for backward compatibility)
 */
export async function handleBriefingOff(ctx: Context): Promise<void> {
  // Redirect to main briefing handler with 'off' argument
  if (ctx.message) {
    ctx.message.text = '/briefing off';
  }
  await handleBriefing(ctx);
}
