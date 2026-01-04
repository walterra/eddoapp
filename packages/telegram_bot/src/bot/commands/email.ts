/**
 * Email sync bot commands
 * Handles configuration for email to todo sync
 */
import { Context } from 'grammy';

import { logger } from '../../utils/logger.js';
import { lookupUserByTelegramId, TelegramUser } from '../../utils/user-lookup.js';
import {
  buildHelpMessage,
  buildStatusMessage,
  extractEmailPrefs,
  generateGmailAuthUrl,
  updateEmailPreferences,
  validateFolderName,
} from './email-helpers.js';

type EmailAction = 'on' | 'enable' | 'off' | 'disable' | 'status' | 'auth';

function isEmailAction(action: string): action is EmailAction {
  return ['on', 'enable', 'off', 'disable', 'status', 'auth'].includes(action);
}

async function sendNotLinkedError(ctx: Context): Promise<void> {
  await ctx.reply(
    '❌ Your Telegram account is not linked to an Eddo account.\n\n' +
      'Please link your account first by:\n' +
      '1. Logging into the web app\n' +
      '2. Going to Profile → Integrations\n' +
      '3. Following the Telegram linking instructions',
  );
}

function parseEmailArgs(text: string | undefined): string[] {
  return (text || '').split(' ').slice(1);
}

async function routeEmailCommand(ctx: Context, user: TelegramUser, args: string[]): Promise<void> {
  if (args.length === 0) {
    await showEmailHelp(ctx, user);
    return;
  }

  const action = args[0].toLowerCase();

  if (action === 'folder') {
    await setEmailFolder(ctx, user, args.slice(1));
  } else if (isEmailAction(action)) {
    await dispatchEmailAction(ctx, user, action);
  } else {
    await showEmailHelp(ctx, user);
  }
}

/**
 * Handles /email command for email sync management
 */
export async function handleEmail(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;

  if (!telegramId) {
    await ctx.reply('❌ Unable to identify user. Please try again.');
    return;
  }

  logger.info('Processing email command', { telegramId, command: ctx.message?.text });

  try {
    const user = await lookupUserByTelegramId(telegramId);
    if (!user) {
      await sendNotLinkedError(ctx);
      return;
    }

    await routeEmailCommand(ctx, user, parseEmailArgs(ctx.message?.text));
  } catch (error) {
    logger.error('Error processing email command', { telegramId, error });
    await ctx.reply(
      '❌ Sorry, there was an error processing your request. Please try again later.',
    );
  }
}

async function dispatchEmailAction(
  ctx: Context,
  user: TelegramUser,
  action: EmailAction,
): Promise<void> {
  switch (action) {
    case 'on':
    case 'enable':
      await enableEmailSync(ctx, user);
      break;
    case 'off':
    case 'disable':
      await disableEmailSync(ctx, user);
      break;
    case 'status':
      await showEmailStatus(ctx, user);
      break;
    case 'auth':
      await startGmailAuth(ctx, user);
      break;
  }
}

async function showEmailHelp(ctx: Context, user: TelegramUser): Promise<void> {
  const prefs = extractEmailPrefs(user);
  await ctx.reply(buildHelpMessage(prefs.isEnabled, prefs.isConfigured));
}

async function enableEmailSync(ctx: Context, user: TelegramUser): Promise<void> {
  try {
    const prefs = extractEmailPrefs(user);

    if (!prefs.isConfigured) {
      await ctx.reply(
        '❌ **Email not configured!**\n\n' +
          'Before enabling sync, you need to connect your Gmail account:\n\n' +
          '`/email auth`\n\n' +
          'Then run `/email on` again.',
      );
      return;
    }

    await updateEmailPreferences(user, { emailSync: true });

    logger.info('Email sync enabled for user', {
      userId: user._id,
      username: user.username,
      telegramId: user.telegram_id,
      provider: prefs.provider,
    });

    await ctx.reply(
      '✅ **Email sync enabled!**\n\n' +
        `📬 Account: ${prefs.email || 'Connected'}\n` +
        `📁 Folder: ${prefs.folder}\n` +
        `⏱ Interval: Every ${prefs.syncInterval} minutes\n` +
        `🏷 Tags: ${prefs.tags.join(', ')}\n\n` +
        '**What happens:**\n' +
        `• Emails in your "${prefs.folder}" folder become todos\n` +
        '• Synced emails are marked as read\n' +
        '• Duplicates are skipped\n\n' +
        '💡 Use `/email off` to disable anytime.',
    );
  } catch (error) {
    logger.error('Failed to enable email sync', { userId: user._id, error });
    await ctx.reply('❌ Failed to enable email sync. Please try again.');
  }
}

async function disableEmailSync(ctx: Context, user: TelegramUser): Promise<void> {
  try {
    await updateEmailPreferences(user, { emailSync: false });

    logger.info('Email sync disabled for user', {
      userId: user._id,
      username: user.username,
      telegramId: user.telegram_id,
    });

    await ctx.reply(
      '✅ **Email sync disabled.**\n\n' +
        '📵 Your emails will no longer be synced to Eddo.\n\n' +
        '💡 Your account connection is preserved.\n' +
        'You can enable sync again anytime with `/email on`.',
    );
  } catch (error) {
    logger.error('Failed to disable email sync', { userId: user._id, error });
    await ctx.reply('❌ Failed to disable email sync. Please try again.');
  }
}

async function startGmailAuth(ctx: Context, user: TelegramUser): Promise<void> {
  try {
    const chatId = ctx.chat?.id;
    if (!chatId) {
      await ctx.reply('❌ Unable to identify chat. Please try again.');
      return;
    }

    await ctx.reply('🔐 Generating Gmail authorization link...');

    const authUrl = await generateGmailAuthUrl(user._id, chatId);

    if (!authUrl) {
      await ctx.reply(
        '❌ **Gmail OAuth not configured**\n\n' +
          'The server administrator needs to set up Google OAuth credentials.\n\n' +
          'Required environment variables:\n' +
          '• `GOOGLE_CLIENT_ID`\n' +
          '• `GOOGLE_CLIENT_SECRET`\n' +
          '• `GOOGLE_REDIRECT_URI`',
      );
      return;
    }

    logger.info('Gmail auth URL generated for user', {
      userId: user._id,
      username: user.username,
      telegramId: user.telegram_id,
    });

    await ctx.reply(
      '🔐 **Connect your Gmail account**\n\n' +
        'Click the link below to authorize Eddo to access your Gmail:\n\n' +
        `[Authorize Gmail](${authUrl})\n\n` +
        '**What happens:**\n' +
        "• You'll be redirected to Google's sign-in page\n" +
        '• Grant Eddo permission to read your emails\n' +
        "• You'll be redirected back and notified here\n\n" +
        '⏰ This link expires in 10 minutes.\n\n' +
        '🔒 We only access emails in your "Eddo" folder/label.',
      { parse_mode: 'Markdown' },
    );
  } catch (error) {
    logger.error('Failed to start Gmail auth', { userId: user._id, error });
    await ctx.reply('❌ Failed to generate authorization link. Please try again.');
  }
}

async function setEmailFolder(ctx: Context, user: TelegramUser, args: string[]): Promise<void> {
  if (args.length === 0) {
    const prefs = extractEmailPrefs(user);
    await ctx.reply(
      `📁 **Current folder:** ${prefs.folder}\n\n` +
        '**Usage:** `/email folder <name>`\n\n' +
        'Examples:\n' +
        '• `/email folder Eddo`\n' +
        '• `/email folder INBOX/Eddo`\n' +
        '• `/email folder To-Process`',
    );
    return;
  }

  const folder = args.join(' ').trim();
  const validation = validateFolderName(folder);

  if (!validation.valid) {
    await ctx.reply(validation.error!);
    return;
  }

  try {
    await updateEmailPreferences(user, { emailFolder: folder });

    logger.info('Email folder updated for user', {
      userId: user._id,
      username: user.username,
      folder,
    });

    await ctx.reply(
      '✅ **Folder updated!**\n\n' +
        `📁 Now syncing from: **${folder}**\n\n` +
        '💡 Make sure this folder/label exists in your email client.\n' +
        'For Gmail, create a label with this exact name.',
    );
  } catch (error) {
    logger.error('Failed to update email folder', { userId: user._id, folder, error });
    await ctx.reply('❌ Failed to update folder. Please try again.');
  }
}

async function showEmailStatus(ctx: Context, user: TelegramUser): Promise<void> {
  await ctx.reply(buildStatusMessage(user));
}
