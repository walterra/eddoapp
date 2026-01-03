/**
 * RSS sync bot commands
 * Handles configuration for RSS feed sync
 */
import { Context } from 'grammy';

import { logger } from '../../utils/logger.js';
import { lookupUserByTelegramId, TelegramUser } from '../../utils/user-lookup.js';
import {
  buildHelpMessage,
  buildStatusMessage,
  discoverFeedFromUrl,
  formatFeedList,
  saveFeedAndNotify,
  updateRssPreferences,
  validateFeedUrl,
} from './rss-helpers.js';

type RssAction = 'on' | 'enable' | 'off' | 'disable' | 'status' | 'list';

function isRssAction(action: string): action is RssAction {
  return ['on', 'enable', 'off', 'disable', 'status', 'list'].includes(action);
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

function parseRssArgs(text: string | undefined): string[] {
  return (text || '').split(' ').slice(1);
}

async function routeRssCommand(ctx: Context, user: TelegramUser, args: string[]): Promise<void> {
  if (args.length === 0) {
    await showRssHelp(ctx, user);
    return;
  }

  const action = args[0].toLowerCase();

  if (action === 'add') {
    await addRssFeed(ctx, user, args.slice(1));
  } else if (action === 'remove') {
    await removeRssFeed(ctx, user, args.slice(1));
  } else if (isRssAction(action)) {
    await dispatchRssAction(ctx, user, action);
  } else {
    await showRssHelp(ctx, user);
  }
}

/**
 * Handles /rss command for RSS sync management
 */
export async function handleRss(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;

  if (!telegramId) {
    await ctx.reply('❌ Unable to identify user. Please try again.');
    return;
  }

  logger.info('Processing RSS command', { telegramId, command: ctx.message?.text });

  try {
    const user = await lookupUserByTelegramId(telegramId);
    if (!user) {
      await sendNotLinkedError(ctx);
      return;
    }

    await routeRssCommand(ctx, user, parseRssArgs(ctx.message?.text));
  } catch (error) {
    logger.error('Error processing RSS command', { telegramId, error });
    await ctx.reply(
      '❌ Sorry, there was an error processing your request. Please try again later.',
    );
  }
}

async function dispatchRssAction(
  ctx: Context,
  user: TelegramUser,
  action: RssAction,
): Promise<void> {
  switch (action) {
    case 'on':
    case 'enable':
      await enableRssSync(ctx, user);
      break;
    case 'off':
    case 'disable':
      await disableRssSync(ctx, user);
      break;
    case 'status':
      await showRssStatus(ctx, user);
      break;
    case 'list':
      await listRssFeeds(ctx, user);
      break;
  }
}

async function showRssHelp(ctx: Context, user: TelegramUser): Promise<void> {
  const isEnabled = user.preferences?.rssSync === true;
  const feedCount = user.preferences?.rssFeeds?.length || 0;
  await ctx.reply(buildHelpMessage(isEnabled, feedCount));
}

async function enableRssSync(ctx: Context, user: TelegramUser): Promise<void> {
  try {
    const feeds = user.preferences?.rssFeeds || [];

    if (feeds.length === 0) {
      await ctx.reply(
        '❌ **No feeds added!**\n\n' +
          'Before enabling sync, you need to add at least one feed:\n\n' +
          '`/rss add https://example.com`\n\n' +
          '💡 You can add any website URL - we auto-detect the RSS feed!\n\n' +
          'Then run `/rss on` again.',
      );
      return;
    }

    await updateRssPreferences(user, { rssSync: true });

    logger.info('RSS sync enabled for user', {
      userId: user._id,
      username: user.username,
      telegramId: user.telegram_id,
      feedCount: feeds.length,
    });

    const syncInterval = user.preferences?.rssSyncInterval || 60;
    const tags = user.preferences?.rssSyncTags || ['gtd:someday', 'source:rss'];

    await ctx.reply(
      '✅ **RSS sync enabled!**\n\n' +
        `📰 Syncing ${feeds.length} feed(s)\n` +
        `⏱ Interval: Every ${syncInterval} minutes\n` +
        `🏷 Tags: ${tags.join(', ')}\n` +
        `📁 Context: read-later\n\n` +
        '**What happens:**\n' +
        '• New feed items become todos automatically\n' +
        '• Duplicates are skipped\n' +
        "• Complete manually when you're done reading\n\n" +
        '💡 Use `/rss off` to disable anytime.',
    );
  } catch (error) {
    logger.error('Failed to enable RSS sync', { userId: user._id, error });
    await ctx.reply('❌ Failed to enable RSS sync. Please try again.');
  }
}

async function disableRssSync(ctx: Context, user: TelegramUser): Promise<void> {
  try {
    await updateRssPreferences(user, { rssSync: false });

    logger.info('RSS sync disabled for user', {
      userId: user._id,
      username: user.username,
      telegramId: user.telegram_id,
    });

    await ctx.reply(
      '✅ **RSS sync disabled.**\n\n' +
        '📵 Your RSS feeds will no longer be synced to Eddo.\n\n' +
        '💡 Your feed subscriptions are preserved.\n' +
        'You can enable sync again anytime with `/rss on`.',
    );
  } catch (error) {
    logger.error('Failed to disable RSS sync', { userId: user._id, error });
    await ctx.reply('❌ Failed to disable RSS sync. Please try again.');
  }
}

async function addRssFeed(ctx: Context, user: TelegramUser, args: string[]): Promise<void> {
  if (args.length === 0) {
    await ctx.reply(
      '❌ **No URL provided!**\n\n' +
        '**Usage:** `/rss add https://example.com`\n\n' +
        '💡 You can add any website URL - we auto-detect the RSS feed!',
    );
    return;
  }

  const url = args[0];
  const validation = validateFeedUrl(url);
  if (!validation.valid) {
    await ctx.reply(validation.error!);
    return;
  }

  await ctx.reply('🔍 Discovering RSS feed...');

  try {
    const { feed, error } = await discoverFeedFromUrl(url);

    if (!feed) {
      await ctx.reply(
        '❌ **No RSS feed found**\n\n' +
          `Could not find an RSS feed at: ${url}\n\n` +
          `Error: ${error}\n\n` +
          '💡 Try adding the direct feed URL if you know it.',
      );
      return;
    }

    const feeds = user.preferences?.rssFeeds || [];
    const existingFeed = feeds.find((f) => f.feedUrl === feed.url);
    if (existingFeed) {
      await ctx.reply(
        '⚠️ **Feed already subscribed!**\n\n' +
          `${existingFeed.title || feed.url}\n\n` +
          '💡 Use `/rss list` to see all your feeds.',
      );
      return;
    }

    await saveFeedAndNotify(ctx, user, url, feed);
  } catch (error) {
    logger.error('Failed to add RSS feed', { userId: user._id, url, error });
    await ctx.reply(
      '❌ **Failed to add feed**\n\n' +
        `Could not add: ${url}\n\n` +
        'Please check the URL and try again.',
    );
  }
}

async function removeRssFeed(ctx: Context, user: TelegramUser, args: string[]): Promise<void> {
  if (args.length === 0) {
    await ctx.reply(
      '❌ **No feed number provided!**\n\n' +
        '**Usage:** `/rss remove <number>`\n\n' +
        'First, use `/rss list` to see your feeds with their numbers.',
    );
    return;
  }

  const indexStr = args[0];
  const index = parseInt(indexStr, 10);

  if (isNaN(index) || index < 1) {
    await ctx.reply('❌ Invalid feed number. Use `/rss list` to see available feeds.');
    return;
  }

  const feeds = user.preferences?.rssFeeds || [];

  if (index > feeds.length) {
    await ctx.reply(
      `❌ Feed #${index} not found.\n\n` +
        `You have ${feeds.length} feed(s). Use \`/rss list\` to see them.`,
    );
    return;
  }

  const removedFeed = feeds[index - 1];
  const updatedFeeds = feeds.filter((_, i) => i !== index - 1);

  try {
    await updateRssPreferences(user, { rssFeeds: updatedFeeds });

    logger.info('RSS feed removed for user', {
      userId: user._id,
      username: user.username,
      removedFeed: removedFeed.feedUrl,
    });

    await ctx.reply(
      '✅ **Feed removed!**\n\n' +
        `📰 ${removedFeed.title || 'Untitled Feed'}\n` +
        `🔗 ${removedFeed.url}\n\n` +
        `💡 You now have ${updatedFeeds.length} feed(s).`,
    );
  } catch (error) {
    logger.error('Failed to remove RSS feed', { userId: user._id, index, error });
    await ctx.reply('❌ Failed to remove feed. Please try again.');
  }
}

async function listRssFeeds(ctx: Context, user: TelegramUser): Promise<void> {
  const feeds = user.preferences?.rssFeeds || [];
  await ctx.reply(formatFeedList(feeds));
}

async function showRssStatus(ctx: Context, user: TelegramUser): Promise<void> {
  await ctx.reply(buildStatusMessage(user));
}
