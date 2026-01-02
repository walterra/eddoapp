/**
 * GitHub sync bot commands
 * Handles configuration and manual sync triggers for GitHub issue sync
 */
import { Context } from 'grammy';

import { logger } from '../../utils/logger.js';
import { lookupUserByTelegramId, TelegramUser } from '../../utils/user-lookup.js';
import {
  buildHelpMessage,
  buildStatusMessage,
  isValidTokenFormat,
  maskToken,
  tryDeleteTokenMessage,
  updateGithubPreferences,
} from './github-helpers.js';

type GithubAction = 'on' | 'enable' | 'off' | 'disable' | 'status' | 'settings';

function isGithubAction(action: string): action is GithubAction {
  return ['on', 'enable', 'off', 'disable', 'status', 'settings'].includes(action);
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

function parseGithubArgs(text: string | undefined): string[] {
  return (text || '').split(' ').slice(1);
}

async function routeGithubCommand(ctx: Context, user: TelegramUser, args: string[]): Promise<void> {
  if (args.length === 0) {
    await showGithubHelp(ctx, user);
    return;
  }

  const action = args[0].toLowerCase();

  if (action === 'token') {
    await setGithubToken(ctx, user, args.slice(1));
  } else if (isGithubAction(action)) {
    await dispatchGithubAction(ctx, user, action);
  } else {
    await showGithubHelp(ctx, user);
  }
}

/**
 * Handles /github command for GitHub sync management
 */
export async function handleGithub(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;

  if (!telegramId) {
    await ctx.reply('❌ Unable to identify user. Please try again.');
    return;
  }

  logger.info('Processing GitHub command', { telegramId, command: ctx.message?.text });

  try {
    const user = await lookupUserByTelegramId(telegramId);
    if (!user) {
      await sendNotLinkedError(ctx);
      return;
    }

    await routeGithubCommand(ctx, user, parseGithubArgs(ctx.message?.text));
  } catch (error) {
    logger.error('Error processing GitHub command', { telegramId, error });
    await ctx.reply(
      '❌ Sorry, there was an error processing your request. Please try again later.',
    );
  }
}

async function dispatchGithubAction(
  ctx: Context,
  user: TelegramUser,
  action: GithubAction,
): Promise<void> {
  switch (action) {
    case 'on':
    case 'enable':
      await enableGithubSync(ctx, user);
      break;
    case 'off':
    case 'disable':
      await disableGithubSync(ctx, user);
      break;
    case 'status':
    case 'settings':
      await showGithubStatus(ctx, user);
      break;
  }
}

async function showGithubHelp(ctx: Context, user: TelegramUser): Promise<void> {
  const isEnabled = user.preferences?.githubSync === true;
  const hasToken = Boolean(user.preferences?.githubToken);
  await ctx.reply(buildHelpMessage(isEnabled, hasToken));
}

async function enableGithubSync(ctx: Context, user: TelegramUser): Promise<void> {
  try {
    if (!user.preferences?.githubToken) {
      await ctx.reply(
        '❌ **GitHub token not set!**\n\n' +
          'Before enabling sync, you need to set your GitHub Personal Access Token:\n\n' +
          '1. Create a token at: https://github.com/settings/tokens\n' +
          '2. Select scope: `repo` (for private repos)\n' +
          '3. Set it here: `/github token ghp_your_token_here`\n\n' +
          'Then run `/github on` again.',
      );
      return;
    }

    const now = new Date().toISOString();
    await updateGithubPreferences(user, {
      githubSync: true,
      githubSyncStartedAt: user.preferences?.githubSyncStartedAt || now,
    });

    logger.info('GitHub sync enabled for user', {
      userId: user._id,
      username: user.username,
      telegramId: user.telegram_id,
    });

    const syncInterval = user.preferences?.githubSyncInterval || 60;
    const tags = user.preferences?.githubSyncTags || ['github', 'gtd:next'];

    await ctx.reply(
      '✅ **GitHub sync enabled!**\n\n' +
        `⏱ Sync interval: Every ${syncInterval} minutes\n` +
        `🏷 Tags: ${tags.join(', ')}\n` +
        `📁 Context: Uses full repository path (e.g., "elastic/kibana")\n\n` +
        '**What gets synced:**\n' +
        '• All your GitHub issues (assigned, created, mentioned)\n' +
        '• Issue title, description, and labels\n' +
        '• Each repository creates its own context\n' +
        '• Closed issues marked as completed\n' +
        '• Updates to existing issues\n\n' +
        '💡 Issues sync automatically based on your interval.\n' +
        'Use `/github off` to disable anytime.',
    );
  } catch (error) {
    logger.error('Failed to enable GitHub sync', { userId: user._id, error });
    await ctx.reply('❌ Failed to enable GitHub sync. Please try again.');
  }
}

async function disableGithubSync(ctx: Context, user: TelegramUser): Promise<void> {
  try {
    await updateGithubPreferences(user, { githubSync: false });

    logger.info('GitHub sync disabled for user', {
      userId: user._id,
      username: user.username,
      telegramId: user.telegram_id,
    });

    await ctx.reply(
      '✅ **GitHub sync disabled.**\n\n' +
        '📵 Your GitHub issues will no longer be synced to Eddo.\n\n' +
        '💡 Existing synced issues will remain in your todos.\n' +
        'You can enable sync again anytime with `/github on`.',
    );
  } catch (error) {
    logger.error('Failed to disable GitHub sync', { userId: user._id, error });
    await ctx.reply('❌ Failed to disable GitHub sync. Please try again.');
  }
}

async function setGithubToken(ctx: Context, user: TelegramUser, args: string[]): Promise<void> {
  try {
    if (args.length === 0) {
      await ctx.reply(
        '❌ **No token provided!**\n\n' +
          '**Usage:** `/github token ghp_your_token_here`\n\n' +
          '**How to create a token:**\n' +
          '1. Go to: https://github.com/settings/tokens\n' +
          '2. Click "Generate new token" → "Generate new token (classic)"\n' +
          '3. Give it a name (e.g., "Eddo Sync")\n' +
          '4. Select scope: `repo` for private repos or `public_repo`\n' +
          '5. Click "Generate token"\n' +
          '6. Copy the token (starts with `ghp_`)\n' +
          '7. Set it here: `/github token ghp_your_token_here`\n\n' +
          '⚠️ **Security:** Treat your token like a password.',
      );
      return;
    }

    const token = args[0];

    if (!isValidTokenFormat(token)) {
      await ctx.reply(
        "⚠️ **Warning:** This doesn't look like a valid GitHub Personal Access Token.\n\n" +
          'GitHub tokens typically start with `ghp_` or `github_pat_`.\n\n' +
          'Are you sure you want to continue? Send `/github token <token>` again to confirm.',
      );
      return;
    }

    await updateGithubPreferences(user, { githubToken: token });
    await tryDeleteTokenMessage(ctx);

    logger.info('GitHub token set for user (token masked)', {
      userId: user._id,
      username: user.username,
      telegramId: user.telegram_id,
      tokenPreview: maskToken(token),
    });

    await ctx.reply(
      '✅ **GitHub token saved!**\n\n' +
        '🔐 Your token has been securely stored.\n' +
        '🗑 The message with your token has been deleted for security.\n\n' +
        '**Next steps:**\n' +
        '1. Enable sync: `/github on`\n' +
        '2. Or sync now: `/github sync`\n\n' +
        '💡 You can check your settings anytime with `/github status`.',
    );
  } catch (error) {
    logger.error('Failed to set GitHub token', { userId: user._id, error });
    await ctx.reply('❌ Failed to save GitHub token. Please try again.');
  }
}

async function showGithubStatus(ctx: Context, user: TelegramUser): Promise<void> {
  await ctx.reply(buildStatusMessage(user));
}
