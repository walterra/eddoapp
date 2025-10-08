import { createEnv, createUserRegistry } from '@eddo/core-server';
import { Context } from 'grammy';

import {
  DAILY_BRIEFING_REQUEST_MESSAGE,
  DAILY_RECAP_REQUEST_MESSAGE,
} from '../../constants/briefing.js';
import { logger } from '../../utils/logger.js';
import {
  TelegramUser,
  lookupUserByTelegramId,
} from '../../utils/user-lookup.js';
import type { BotContext } from '../bot.js';
import { handleMessage } from '../handlers/message.js';

/**
 * Handle the /briefing command to enable/disable daily briefings
 */
export async function handleBriefing(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;

  if (!telegramId) {
    await ctx.reply('❌ Unable to identify user. Please try again.');
    return;
  }

  logger.info('Processing briefing command', {
    telegramId,
    command: ctx.message?.text,
  });

  try {
    // Look up the user
    const user = await lookupUserByTelegramId(telegramId);
    if (!user) {
      await ctx.reply(
        '❌ Your Telegram account is not linked to an Eddo account.\n\n' +
          'Please link your account first by:\n' +
          '1. Logging into the web app\n' +
          '2. Going to Profile → Integrations\n' +
          '3. Following the Telegram linking instructions',
      );
      return;
    }

    // Parse the command argument
    const messageText = ctx.message?.text || '';
    const args = messageText.split(' ').slice(1); // Remove '/briefing' part

    if (args.length === 0) {
      // Show current status and usage
      await showBriefingStatus(ctx, user);
      return;
    }

    const action = args[0].toLowerCase();

    switch (action) {
      case 'on':
      case 'enable':
        await enableDailyBriefing(ctx, user);
        break;

      case 'off':
      case 'disable':
        await disableDailyBriefing(ctx, user);
        break;

      case 'status':
        await showBriefingStatus(ctx, user);
        break;

      case 'now':
        await generateBriefingNow(ctx, user);
        break;

      case 'recap':
        await generateBriefingRecap(ctx, user);
        break;

      default:
        await ctx.reply(
          '❓ **Briefing Command Usage:**\n\n' +
            '`/briefing on` - Enable daily briefings\n' +
            '`/briefing off` - Disable daily briefings\n' +
            '`/briefing now` - Generate briefing immediately\n' +
            '`/briefing recap` - Daily recap of completed tasks\n' +
            '`/briefing status` - Show current setting\n' +
            '`/briefing` - Show this help\n\n' +
            '💡 Daily briefings are sent at your preferred time with your todo summary.',
        );
        break;
    }
  } catch (error) {
    logger.error('Error processing briefing command', {
      telegramId,
      error,
    });

    await ctx.reply(
      '❌ Sorry, there was an error processing your request. Please try again later.',
    );
  }
}

/**
 * Enable daily briefings for a user
 */
async function enableDailyBriefing(
  ctx: Context,
  user: TelegramUser,
): Promise<void> {
  try {
    const env = createEnv();
    const userRegistry = createUserRegistry(env.COUCHDB_URL, env);

    // Update user preferences
    await userRegistry.update(user._id, {
      preferences: {
        ...user.preferences,
        dailyBriefing: true,
      },
      updated_at: new Date().toISOString(),
    });

    logger.info('Daily briefing enabled for user', {
      userId: user._id,
      username: user.username,
      telegramId: user.telegram_id,
    });

    await ctx.reply(
      '✅ **Daily briefings enabled!**\n\n' +
        `🌅 You will receive your daily todo summary at ${user.preferences?.briefingTime || '07:00'}.\n\n` +
        '**Your briefings will include:**\n' +
        "• Today's due tasks and appointments\n" +
        '• Overdue items needing attention\n' +
        '• Next actions ready to work on\n' +
        '• Active time tracking sessions\n' +
        '• Context-based priorities\n\n' +
        '💡 You can also manage this setting in the web app under Profile → Preferences.\n\n' +
        'Use `/briefing off` to disable anytime.',
    );
  } catch (error) {
    logger.error('Failed to enable daily briefing', {
      userId: user._id,
      error,
    });

    await ctx.reply(
      '❌ Failed to enable daily briefings. Please try again or check your settings in the web app.',
    );
  }
}

/**
 * Disable daily briefings for a user
 */
async function disableDailyBriefing(
  ctx: Context,
  user: TelegramUser,
): Promise<void> {
  try {
    const env = createEnv();
    const userRegistry = createUserRegistry(env.COUCHDB_URL, env);

    // Update user preferences
    await userRegistry.update(user._id, {
      preferences: {
        ...user.preferences,
        dailyBriefing: false,
      },
      updated_at: new Date().toISOString(),
    });

    logger.info('Daily briefing disabled for user', {
      userId: user._id,
      username: user.username,
      telegramId: user.telegram_id,
    });

    await ctx.reply(
      '✅ **Daily briefings disabled.**\n\n' +
        '📵 You will no longer receive morning todo summaries.\n\n' +
        '💡 You can enable them again anytime with `/briefing on` or in the web app under Profile → Preferences.',
    );
  } catch (error) {
    logger.error('Failed to disable daily briefing', {
      userId: user._id,
      error,
    });

    await ctx.reply(
      '❌ Failed to disable daily briefings. Please try again or check your settings in the web app.',
    );
  }
}

/**
 * Show current briefing status for a user
 */
async function showBriefingStatus(
  ctx: Context,
  user: TelegramUser,
): Promise<void> {
  const isEnabled = user.preferences?.dailyBriefing === true;
  const briefingTime = user.preferences?.briefingTime || '07:00';

  const statusEmoji = isEnabled ? '✅' : '❌';
  const statusText = isEnabled ? 'Enabled' : 'Disabled';

  await ctx.reply(
    `📊 **Daily Briefing Status**\n\n` +
      `${statusEmoji} **Status:** ${statusText}\n` +
      `🕰 **Time:** ${briefingTime}\n\n` +
      `${
        isEnabled
          ? '🌅 You will receive daily briefings with your todo summary.\n\n' +
            'Use `/briefing off` to disable.'
          : '📵 Daily briefings are currently disabled.\n\n' +
            'Use `/briefing on` to enable them.'
      }\n\n` +
      `💡 You can also manage this in the web app under Profile → Preferences.`,
  );
}

/**
 * Generate and send a briefing immediately for a user using the agent
 */
async function generateBriefingNow(
  ctx: Context,
  user: TelegramUser,
): Promise<void> {
  try {
    logger.info('Generating on-demand briefing via agent', {
      userId: user._id,
      username: user.username,
      telegramId: user.telegram_id,
    });

    // Use the agent to generate a briefing by modifying the context message
    if (ctx.message) {
      ctx.message.text = DAILY_BRIEFING_REQUEST_MESSAGE;
    }

    await handleMessage(ctx as BotContext); // Type cast for briefing context

    logger.info('On-demand briefing generated via agent', {
      userId: user._id,
      username: user.username,
      telegramId: user.telegram_id,
    });
  } catch (error) {
    logger.error('Failed to generate on-demand briefing via agent', {
      userId: user._id,
      error,
    });

    await ctx.reply(
      '❌ **Sorry, there was an error generating your briefing.**\n\n' +
        'This could be due to:\n' +
        '• Temporary connectivity issues\n' +
        '• AI service unavailability\n' +
        '• Database access problems\n\n' +
        'Please try again in a few moments, or contact support if the problem persists.',
    );
  }
}

/**
 * Generate and send a daily recap immediately for a user using the agent
 */
async function generateBriefingRecap(
  ctx: Context,
  user: TelegramUser,
): Promise<void> {
  try {
    logger.info('Generating daily recap via agent', {
      userId: user._id,
      username: user.username,
      telegramId: user.telegram_id,
    });

    // Use the agent to generate a recap by modifying the context message
    if (ctx.message) {
      ctx.message.text = DAILY_RECAP_REQUEST_MESSAGE;
    }

    await handleMessage(ctx as BotContext);

    logger.info('Daily recap generated via agent', {
      userId: user._id,
      username: user.username,
      telegramId: user.telegram_id,
    });
  } catch (error) {
    logger.error('Failed to generate daily recap via agent', {
      userId: user._id,
      error,
    });

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
