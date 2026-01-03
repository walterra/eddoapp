/**
 * Helper functions for RSS sync commands
 */
import { createEnv, createUserRegistry, type RssFeedConfig } from '@eddo/core-server';
import { Context } from 'grammy';

import { logger } from '../../utils/logger.js';
import { invalidateUserCache, TelegramUser } from '../../utils/user-lookup.js';

/**
 * Update user preferences for RSS sync
 */
export async function updateRssPreferences(
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
 * Build RSS help message
 */
export function buildHelpMessage(isEnabled: boolean, feedCount: number): string {
  return (
    '📡 **RSS Feed Sync**\n\n' +
    '**Commands:**\n' +
    '`/rss on` - Enable automatic sync\n' +
    '`/rss off` - Disable automatic sync\n' +
    '`/rss add <url>` - Add a feed (autodiscovery supported)\n' +
    '`/rss list` - List subscribed feeds\n' +
    '`/rss remove <number>` - Remove feed by number\n' +
    '`/rss status` - Show current settings\n' +
    '`/rss` - Show this help\n\n' +
    '**Current Status:**\n' +
    `${isEnabled ? '✅' : '❌'} Sync: ${isEnabled ? 'Enabled' : 'Disabled'}\n` +
    `📰 Feeds: ${feedCount} subscribed\n\n` +
    '**How it works:**\n' +
    '• Add any website URL - we auto-detect the RSS feed\n' +
    '• New items become todos in "read-later" context\n' +
    '• Tagged with `gtd:someday` and `source:rss`\n' +
    '• Sync runs automatically based on your interval'
  );
}

interface RssSyncPrefs {
  isEnabled: boolean;
  feeds: RssFeedConfig[];
  syncInterval: number;
  tags: string[];
  lastSync: string | undefined;
}

function extractRssPrefs(user: TelegramUser): RssSyncPrefs {
  const prefs = user.preferences;
  return {
    isEnabled: prefs?.rssSync === true,
    feeds: prefs?.rssFeeds || [],
    syncInterval: prefs?.rssSyncInterval || 60,
    tags: prefs?.rssSyncTags || ['gtd:someday', 'source:rss'],
    lastSync: prefs?.rssLastSync,
  };
}

function getStatusFooterText(isEnabled: boolean, feedCount: number): string {
  if (isEnabled && feedCount > 0) {
    return '🔄 RSS sync is active. New items will be synced automatically.';
  }
  if (feedCount === 0) {
    return '📭 No feeds added yet.\n\nUse `/rss add <url>` to add a feed.';
  }
  return '📵 RSS sync is disabled.\n\nUse `/rss on` to enable it.';
}

/**
 * Builds status message for RSS sync configuration
 */
export function buildStatusMessage(user: TelegramUser): string {
  const prefs = extractRssPrefs(user);
  const statusEmoji = prefs.isEnabled ? '✅' : '❌';
  const statusText = prefs.isEnabled ? 'Enabled' : 'Disabled';
  const enabledFeeds = prefs.feeds.filter((f) => f.enabled).length;

  return (
    '📊 **RSS Sync Status**\n\n' +
    `${statusEmoji} **Status:** ${statusText}\n` +
    `📰 **Feeds:** ${enabledFeeds} enabled (${prefs.feeds.length} total)\n` +
    `⏱ **Interval:** Every ${prefs.syncInterval} minutes\n` +
    `🏷 **Tags:** ${prefs.tags.join(', ')}\n` +
    `📁 **Context:** read-later\n` +
    `🕰 **Last sync:** ${formatLastSync(prefs.lastSync)}\n\n` +
    getStatusFooterText(prefs.isEnabled, prefs.feeds.length)
  );
}

/**
 * Format feed list for display
 */
export function formatFeedList(feeds: RssFeedConfig[]): string {
  if (feeds.length === 0) {
    return (
      '📭 **No feeds subscribed**\n\n' +
      'Add your first feed:\n' +
      '`/rss add https://example.com`\n\n' +
      '💡 You can add any website URL - we auto-detect the RSS feed!'
    );
  }

  const feedLines = feeds.map((feed, index) => {
    const status = feed.enabled ? '✅' : '⏸️';
    const title = feed.title || 'Untitled Feed';
    const url = feed.url;
    return `${index + 1}. ${status} **${title}**\n   ${url}`;
  });

  return (
    '📰 **Subscribed Feeds**\n\n' +
    feedLines.join('\n\n') +
    '\n\n' +
    '**Commands:**\n' +
    '• `/rss remove <number>` - Remove a feed\n' +
    '• `/rss add <url>` - Add another feed'
  );
}

/**
 * Truncate URL for display
 */
export function truncateUrl(url: string, maxLength: number = 50): string {
  if (url.length <= maxLength) return url;
  return url.substring(0, maxLength - 3) + '...';
}

/**
 * Validates feed URL format
 */
export function validateFeedUrl(url: string): { valid: boolean; error?: string } {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, error: '❌ Invalid URL. Please use an HTTP or HTTPS URL.' };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: '❌ Invalid URL format. Please provide a valid URL.' };
  }
}

export interface DiscoveredFeed {
  url: string;
  title?: string;
  type: string;
}

/**
 * Discovers feed from URL using autodiscovery
 */
export async function discoverFeedFromUrl(
  url: string,
): Promise<{ feed?: DiscoveredFeed; error?: string }> {
  const { discoverFeeds } = await import('@eddo/web-api/rss');
  const result = await discoverFeeds(url);

  if (!result.success || result.feeds.length === 0) {
    return { error: result.error || 'Unknown error' };
  }

  return { feed: result.feeds[0] };
}

/**
 * Saves feed and sends success notification
 */
export async function saveFeedAndNotify(
  ctx: Context,
  user: TelegramUser,
  url: string,
  discoveredFeed: DiscoveredFeed,
): Promise<void> {
  const feeds = user.preferences?.rssFeeds || [];

  const newFeed: RssFeedConfig = {
    url,
    feedUrl: discoveredFeed.url,
    title: discoveredFeed.title,
    enabled: true,
    addedAt: new Date().toISOString(),
  };

  await updateRssPreferences(user, { rssFeeds: [...feeds, newFeed] });

  logger.info('RSS feed added for user', {
    userId: user._id,
    username: user.username,
    feedUrl: discoveredFeed.url,
    feedTitle: discoveredFeed.title,
  });

  const isEnabled = user.preferences?.rssSync === true;
  const nextSteps = isEnabled
    ? '🔄 It will be synced automatically on the next cycle.'
    : '💡 Enable sync with `/rss on` to start syncing.';

  await ctx.reply(
    '✅ **Feed added!**\n\n' +
      `📰 ${discoveredFeed.title || 'Untitled Feed'}\n` +
      `🔗 ${discoveredFeed.url}\n` +
      `📁 Type: ${discoveredFeed.type}\n\n` +
      nextSteps,
  );
}
