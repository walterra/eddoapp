import { createEnv, createUserRegistry } from '@eddo/core-server';
import { Context } from 'grammy';

import { logger } from '../../utils/logger.js';
import { TelegramUser } from '../../utils/user-lookup.js';

/**
 * Updates user preferences for briefing settings
 * @param user - User to update
 * @param dailyBriefing - New briefing enabled state
 */
export async function updateBriefingPreferences(
  user: TelegramUser,
  dailyBriefing: boolean,
): Promise<void> {
  const env = createEnv();
  const userRegistry = createUserRegistry(env.COUCHDB_URL, env);

  await userRegistry.update(user._id, {
    preferences: { ...user.preferences, dailyBriefing },
    updated_at: new Date().toISOString(),
  });
}

/**
 * Builds the enabled briefing success message
 * @param briefingTime - User's configured briefing time
 * @returns Formatted success message
 */
export function buildEnabledMessage(briefingTime: string): string {
  return (
    '✅ **Daily briefings enabled!**\n\n' +
    `🌅 You will receive your daily todo summary at ${briefingTime}.\n\n` +
    '**Your briefings will include:**\n' +
    "• Today's due tasks and appointments\n" +
    '• Overdue items needing attention\n' +
    '• Next actions ready to work on\n' +
    '• Active time tracking sessions\n' +
    '• Context-based priorities\n\n' +
    '💡 You can also manage this setting in the web app under Profile → Preferences.\n\n' +
    'Use `/briefing off` to disable anytime.'
  );
}

/**
 * Builds the disabled briefing success message
 * @returns Formatted success message
 */
export function buildDisabledMessage(): string {
  return (
    '✅ **Daily briefings disabled.**\n\n' +
    '📵 You will no longer receive morning todo summaries.\n\n' +
    '💡 You can enable them again anytime with `/briefing on` or in the web app under Profile → Preferences.'
  );
}

/**
 * Builds the briefing status display message
 * @param user - User to display status for
 * @returns Formatted status message
 */
export function buildStatusMessage(user: TelegramUser): string {
  const isEnabled = user.preferences?.dailyBriefing === true;
  const briefingTime = user.preferences?.briefingTime || '07:00';
  const statusEmoji = isEnabled ? '✅' : '❌';
  const statusText = isEnabled ? 'Enabled' : 'Disabled';

  const actionText = isEnabled
    ? '🌅 You will receive daily briefings with your todo summary.\n\n' +
      'Use `/briefing off` to disable.'
    : '📵 Daily briefings are currently disabled.\n\n' + 'Use `/briefing on` to enable them.';

  return (
    `📊 **Daily Briefing Status**\n\n` +
    `${statusEmoji} **Status:** ${statusText}\n` +
    `🕰 **Time:** ${briefingTime}\n\n` +
    `${actionText}\n\n` +
    `💡 You can also manage this in the web app under Profile → Preferences.`
  );
}

/**
 * Builds the briefing help/usage message
 * @returns Formatted help message
 */
export function buildHelpMessage(): string {
  return (
    '❓ **Briefing Command Usage:**\n\n' +
    '`/briefing on` - Enable daily briefings\n' +
    '`/briefing off` - Disable daily briefings\n' +
    '`/briefing now` - Generate briefing immediately\n' +
    '`/briefing recap` - Daily recap of completed tasks\n' +
    '`/briefing status` - Show current setting\n' +
    '`/briefing` - Show this help\n\n' +
    '💡 Daily briefings are sent at your preferred time with your todo summary.'
  );
}

/**
 * Builds the briefing error message
 * @returns Formatted error message
 */
export function buildBriefingErrorMessage(): string {
  return (
    '❌ **Sorry, there was an error generating your briefing.**\n\n' +
    'This could be due to:\n' +
    '• Temporary connectivity issues\n' +
    '• AI service unavailability\n' +
    '• Database access problems\n\n' +
    'Please try again in a few moments, or contact support if the problem persists.'
  );
}

/**
 * Logs briefing enable/disable action
 * @param action - 'enabled' or 'disabled'
 * @param user - User performing action
 */
export function logBriefingAction(action: 'enabled' | 'disabled', user: TelegramUser): void {
  logger.info(`Daily briefing ${action} for user`, {
    userId: user._id,
    username: user.username,
    telegramId: user.telegram_id,
  });
}

/**
 * Sends the account not linked error message
 * @param ctx - Telegram context
 */
export async function sendNotLinkedError(ctx: Context): Promise<void> {
  await ctx.reply(
    '❌ Your Telegram account is not linked to an Eddo account.\n\n' +
      'Please link your account first by:\n' +
      '1. Logging into the web app\n' +
      '2. Going to Profile → Integrations\n' +
      '3. Following the Telegram linking instructions',
  );
}

/**
 * Sends the unable to identify user error message
 * @param ctx - Telegram context
 */
export async function sendUnableToIdentifyError(ctx: Context): Promise<void> {
  await ctx.reply('❌ Unable to identify user. Please try again.');
}

/**
 * Parses command arguments from message text
 * @param text - Message text
 * @returns Array of arguments (excluding command)
 */
export function parseCommandArgs(text: string | undefined): string[] {
  return (text || '').split(' ').slice(1);
}
