/**
 * Helper functions for GitHub sync commands
 */
import { createEnv, createUserRegistry } from '@eddo/core-server';
import { Context } from 'grammy';

import { logger } from '../../utils/logger.js';
import { invalidateUserCache, TelegramUser } from '../../utils/user-lookup.js';

/**
 * Update user preferences for GitHub sync
 */
export async function updateGithubPreferences(
  user: TelegramUser,
  updates: Record<string, unknown>,
): Promise<void> {
  const env = createEnv();
  const userRegistry = createUserRegistry(env.COUCHDB_URL, env);

  await userRegistry.update(user._id, {
    preferences: { ...user.preferences, ...updates },
    updated_at: new Date().toISOString(),
  });

  invalidateUserCache(user.telegram_id);
}

/**
 * Validate GitHub token format
 */
export function isValidTokenFormat(token: string): boolean {
  return token.startsWith('ghp_') || token.startsWith('github_pat_');
}

/**
 * Mask token for display
 */
export function maskToken(token: string): string {
  return `${token.substring(0, 7)}...${token.substring(token.length - 4)}`;
}

/**
 * Format last sync date for display
 */
export function formatLastSync(lastSync: string | undefined): string {
  if (!lastSync) return 'Never';

  return new Date(lastSync).toLocaleString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Build GitHub help message
 */
export function buildHelpMessage(isEnabled: boolean, hasToken: boolean): string {
  return (
    '🐙 **GitHub Issue Sync**\n\n' +
    '**Commands:**\n' +
    '`/github on` - Enable automatic sync\n' +
    '`/github off` - Disable automatic sync\n' +
    '`/github token <token>` - Set GitHub Personal Access Token\n' +
    '`/github status` - Show current settings\n' +
    '`/github` - Show this help\n\n' +
    '**Current Status:**\n' +
    `${isEnabled ? '✅' : '❌'} Sync: ${isEnabled ? 'Enabled' : 'Disabled'}\n` +
    `${hasToken ? '🔑' : '❌'} Token: ${hasToken ? 'Set' : 'Not set'}\n` +
    `📁 Context: Each repo uses its full path (e.g., elastic/kibana)\n\n` +
    '**Setup Instructions:**\n' +
    '1. Create a GitHub Personal Access Token at:\n' +
    '   https://github.com/settings/tokens\n' +
    '2. Select scope: `repo` (for private repos) or `public_repo`\n' +
    '3. Copy the token and set it here:\n' +
    '   `/github token ghp_your_token_here`\n' +
    '4. Enable sync: `/github on`\n\n' +
    '⚠️ **Security Note:** Your token is stored securely and only used to sync your issues. ' +
    'You can revoke it anytime at GitHub Settings.'
  );
}

/**
 * Build status message
 */
export function buildStatusMessage(user: TelegramUser): string {
  const isEnabled = user.preferences?.githubSync === true;
  const hasToken = Boolean(user.preferences?.githubToken);
  const token = user.preferences?.githubToken;
  const syncInterval = user.preferences?.githubSyncInterval || 60;
  const tags = user.preferences?.githubSyncTags || ['github', 'gtd:next'];
  const lastSync = user.preferences?.githubLastSync;

  const statusEmoji = isEnabled ? '✅' : '❌';
  const statusText = isEnabled ? 'Enabled' : 'Disabled';
  const tokenStatus = hasToken ? `🔑 Set (${maskToken(token!)})` : '❌ Not set';
  const lastSyncText = formatLastSync(lastSync);

  let footerText: string;
  if (isEnabled && hasToken) {
    footerText = '🔄 GitHub sync is active. Your issues will be synced automatically.';
  } else if (!hasToken) {
    footerText = '❌ Set your GitHub token first:\n`/github token ghp_your_token_here`';
  } else {
    footerText = '📵 GitHub sync is disabled.\n\nUse `/github on` to enable it.';
  }

  return (
    '📊 **GitHub Sync Status**\n\n' +
    `${statusEmoji} **Status:** ${statusText}\n` +
    `${tokenStatus}\n` +
    `⏱ **Interval:** Every ${syncInterval} minutes\n` +
    `🏷 **Tags:** ${tags.join(', ')}\n` +
    `📁 **Context:** Full repository path (auto)\n` +
    `🕰 **Last sync:** ${lastSyncText}\n\n` +
    footerText
  );
}

/**
 * Try to delete message containing token for security
 */
export async function tryDeleteTokenMessage(ctx: Context): Promise<void> {
  try {
    await ctx.deleteMessage();
  } catch (error) {
    logger.warn('Could not delete message with token', { error });
  }
}
