/**
 * GitHub sync bot commands
 * Handles configuration and manual sync triggers for GitHub issue sync
 */
import { createEnv, createUserRegistry } from '@eddo/core-server';
import { Context } from 'grammy';

import { logger } from '../../utils/logger.js';
import {
  invalidateUserCache,
  lookupUserByTelegramId,
  TelegramUser,
} from '../../utils/user-lookup.js';

/**
 * Handle the /github command for GitHub sync management
 */
export async function handleGithub(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;

  if (!telegramId) {
    await ctx.reply('❌ Unable to identify user. Please try again.');
    return;
  }

  logger.info('Processing GitHub command', {
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
    const args = messageText.split(' ').slice(1); // Remove '/github' part

    if (args.length === 0) {
      await showGithubHelp(ctx, user);
      return;
    }

    const action = args[0].toLowerCase();

    switch (action) {
      case 'on':
      case 'enable':
        await enableGithubSync(ctx, user);
        break;

      case 'off':
      case 'disable':
        await disableGithubSync(ctx, user);
        break;

      case 'token':
        await setGithubToken(ctx, user, args.slice(1));
        break;

      // Manual sync removed - automatic sync runs via scheduler
      // case 'sync':
      // case 'now':
      //   await triggerManualSync(ctx, user);
      //   break;

      case 'status':
      case 'settings':
        await showGithubStatus(ctx, user);
        break;

      default:
        await showGithubHelp(ctx, user);
        break;
    }
  } catch (error) {
    logger.error('Error processing GitHub command', {
      telegramId,
      error,
    });

    await ctx.reply(
      '❌ Sorry, there was an error processing your request. Please try again later.',
    );
  }
}

/**
 * Show GitHub sync help and usage
 */
async function showGithubHelp(ctx: Context, user: TelegramUser): Promise<void> {
  const isEnabled = user.preferences?.githubSync === true;
  const hasToken = Boolean(user.preferences?.githubToken);

  await ctx.reply(
    '🐙 **GitHub Issue Sync**\n\n' +
      '**Commands:**\n' +
      '`/github on` - Enable automatic sync\n' +
      '`/github off` - Disable automatic sync\n' +
      '`/github token <token>` - Set GitHub Personal Access Token\n' +
      '`/github status` - Show current settings\n' +
      '`/github` - Show this help\n\n' +
      '**Current Status:**\n' +
      `${isEnabled ? '✅' : '❌'} Sync: ${isEnabled ? 'Enabled' : 'Disabled'}\n` +
      `${hasToken ? '🔑' : '❌'} Token: ${hasToken ? 'Set' : 'Not set'}\n\n` +
      '**Setup Instructions:**\n' +
      '1. Create a GitHub Personal Access Token at:\n' +
      '   https://github.com/settings/tokens\n' +
      '2. Select scope: `repo` (for private repos) or `public_repo`\n' +
      '3. Copy the token and set it here:\n' +
      '   `/github token ghp_your_token_here`\n' +
      '4. Enable sync: `/github on`\n\n' +
      '⚠️ **Security Note:** Your token is stored securely and only used to sync your issues. ' +
      'You can revoke it anytime at GitHub Settings.',
  );
}

/**
 * Enable GitHub sync for a user
 */
async function enableGithubSync(ctx: Context, user: TelegramUser): Promise<void> {
  try {
    // Check if token is set
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

    const env = createEnv();
    const userRegistry = createUserRegistry(env.COUCHDB_URL, env);

    const now = new Date().toISOString();

    await userRegistry.update(user._id, {
      preferences: {
        ...user.preferences,
        githubSync: true,
        // Set sync started timestamp on first enable (max lookback date)
        githubSyncStartedAt: user.preferences?.githubSyncStartedAt || now,
      },
      updated_at: now,
    });

    // Invalidate cache so next lookup gets fresh data
    invalidateUserCache(user.telegram_id);

    logger.info('GitHub sync enabled for user', {
      userId: user._id,
      username: user.username,
      telegramId: user.telegram_id,
    });

    const syncInterval = user.preferences?.githubSyncInterval || 60;
    const context = user.preferences?.githubSyncContext || 'work';

    await ctx.reply(
      '✅ **GitHub sync enabled!**\n\n' +
        `⏱ Sync interval: Every ${syncInterval} minutes\n` +
        `📁 Context: ${context}\n` +
        `🏷 Tags: ${(user.preferences?.githubSyncTags || ['github']).join(', ')}\n\n` +
        '**What gets synced:**\n' +
        '• All your GitHub issues (assigned, created, mentioned)\n' +
        '• Issue title, description, and labels\n' +
        '• Closed issues marked as completed\n' +
        '• Updates to existing issues\n\n' +
        '💡 Issues sync automatically based on your interval.\n' +
        'Use `/github off` to disable anytime.',
    );
  } catch (error) {
    logger.error('Failed to enable GitHub sync', {
      userId: user._id,
      error,
    });

    await ctx.reply(
      '❌ Failed to enable GitHub sync. Please try again or check your settings in the web app.',
    );
  }
}

/**
 * Disable GitHub sync for a user
 */
async function disableGithubSync(ctx: Context, user: TelegramUser): Promise<void> {
  try {
    const env = createEnv();
    const userRegistry = createUserRegistry(env.COUCHDB_URL, env);

    await userRegistry.update(user._id, {
      preferences: {
        ...user.preferences,
        githubSync: false,
      },
      updated_at: new Date().toISOString(),
    });

    // Invalidate cache so next lookup gets fresh data
    invalidateUserCache(user.telegram_id);

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
    logger.error('Failed to disable GitHub sync', {
      userId: user._id,
      error,
    });

    await ctx.reply(
      '❌ Failed to disable GitHub sync. Please try again or check your settings in the web app.',
    );
  }
}

/**
 * Set GitHub Personal Access Token for a user
 */
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
          '⚠️ **Security:** Treat your token like a password. ' +
          'You can revoke it anytime at GitHub Settings.',
      );
      return;
    }

    const token = args[0];

    // Basic token validation
    if (!token.startsWith('ghp_') && !token.startsWith('github_pat_')) {
      await ctx.reply(
        "⚠️ **Warning:** This doesn't look like a valid GitHub Personal Access Token.\n\n" +
          'GitHub tokens typically start with `ghp_` or `github_pat_`.\n\n' +
          'Are you sure you want to continue? Send `/github token <token>` again to confirm.',
      );
      return;
    }

    const env = createEnv();
    const userRegistry = createUserRegistry(env.COUCHDB_URL, env);

    await userRegistry.update(user._id, {
      preferences: {
        ...user.preferences,
        githubToken: token,
      },
      updated_at: new Date().toISOString(),
    });

    // Invalidate cache so next lookup gets fresh data
    invalidateUserCache(user.telegram_id);

    // Delete the message containing the token for security
    try {
      await ctx.deleteMessage();
    } catch (error) {
      logger.warn('Could not delete message with token', { error });
    }

    logger.info('GitHub token set for user (token masked)', {
      userId: user._id,
      username: user.username,
      telegramId: user.telegram_id,
      tokenPreview: `${token.substring(0, 7)}...${token.substring(token.length - 4)}`,
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
    logger.error('Failed to set GitHub token', {
      userId: user._id,
      error,
    });

    await ctx.reply(
      '❌ Failed to save GitHub token. Please try again or check your settings in the web app.',
    );
  }
}

/**
 * Show GitHub sync status and settings
 */
async function showGithubStatus(ctx: Context, user: TelegramUser): Promise<void> {
  const isEnabled = user.preferences?.githubSync === true;
  const hasToken = Boolean(user.preferences?.githubToken);
  const token = user.preferences?.githubToken;
  const syncInterval = user.preferences?.githubSyncInterval || 60;
  const context = user.preferences?.githubSyncContext || 'work';
  const tags = user.preferences?.githubSyncTags || ['github'];
  const lastSync = user.preferences?.githubLastSync;

  const statusEmoji = isEnabled ? '✅' : '❌';
  const statusText = isEnabled ? 'Enabled' : 'Disabled';
  const tokenStatus = hasToken
    ? `🔑 Set (${token!.substring(0, 7)}...${token!.substring(token!.length - 4)})`
    : '❌ Not set';

  const lastSyncText = lastSync
    ? new Date(lastSync).toLocaleString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Never';

  await ctx.reply(
    '📊 **GitHub Sync Status**\n\n' +
      `${statusEmoji} **Status:** ${statusText}\n` +
      `${tokenStatus}\n` +
      `⏱ **Interval:** Every ${syncInterval} minutes\n` +
      `📁 **Context:** ${context}\n` +
      `🏷 **Tags:** ${tags.join(', ')}\n` +
      `🕰 **Last sync:** ${lastSyncText}\n\n` +
      `${
        isEnabled && hasToken
          ? '🔄 GitHub sync is active. Your issues will be synced automatically.'
          : !hasToken
            ? '❌ Set your GitHub token first:\n' + '`/github token ghp_your_token_here`'
            : '📵 GitHub sync is disabled.\n\n' + 'Use `/github on` to enable it.'
      }`,
  );
}
