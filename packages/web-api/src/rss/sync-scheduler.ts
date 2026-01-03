/**
 * RSS Feed Sync Scheduler
 * Periodically syncs RSS feeds for users with sync enabled
 */
import { createEnv, createUserRegistry, type TodoAlpha3 } from '@eddo/core-server';
import type nano from 'nano';

import type { SyncLogger } from './client.js';
import { createRssClient } from './client.js';
import { createSyncStats, incrementStat, processItem, type SyncStats } from './sync-helpers.js';
import type { RssFeedConfig } from './types.js';

interface UserPreferences {
  rssSync?: boolean;
  rssFeeds?: RssFeedConfig[];
  rssSyncInterval?: number;
  rssSyncTags?: string[];
  rssLastSync?: string;
}

interface SyncUser {
  _id: string;
  username: string;
  database_name: string;
  preferences?: UserPreferences;
}

interface RssSyncSchedulerConfig {
  checkIntervalMs: number;
  logger: SyncLogger;
  getUserDb: (dbName: string) => nano.DocumentScope<TodoAlpha3>;
}

interface SyncContext {
  user: SyncUser;
  logger: SyncLogger;
  getUserDb: RssSyncSchedulerConfig['getUserDb'];
}

/**
 * Default tags for RSS items
 */
const DEFAULT_RSS_TAGS = ['gtd:someday', 'source:rss'];

/**
 * Determine if user needs sync based on last sync time and interval
 */
export function shouldSyncUser(preferences?: UserPreferences): boolean {
  if (!preferences?.rssSync) return false;
  if (!preferences.rssFeeds?.length) return false;

  const lastSync = preferences.rssLastSync;
  const syncInterval = preferences.rssSyncInterval || 60; // Default 60 minutes

  if (!lastSync) {
    // Never synced before
    return true;
  }

  const lastSyncTime = new Date(lastSync).getTime();
  const now = Date.now();
  const intervalMs = syncInterval * 60 * 1000;

  return now - lastSyncTime >= intervalMs;
}

interface ProcessFeedItemsConfig {
  ctx: SyncContext;
  feedConfig: RssFeedConfig;
  rssClient: ReturnType<typeof createRssClient>;
  tags: string[];
  stats: SyncStats;
}

/**
 * Process items from a single feed
 */
async function processFeedItems(config: ProcessFeedItemsConfig): Promise<number> {
  const { ctx, feedConfig, rssClient, tags, stats } = config;
  const db = ctx.getUserDb(ctx.user.database_name);
  const items = await rssClient.fetchFeed(feedConfig);

  for (const item of items) {
    try {
      const result = await processItem({ db, item, tags, rssClient, logger: ctx.logger });
      incrementStat(stats, result);
    } catch (error) {
      ctx.logger.error('Failed to process RSS item', {
        feedUrl: feedConfig.feedUrl,
        itemTitle: item.title,
        error: error instanceof Error ? error.message : String(error),
      });
      incrementStat(stats, 'error');
    }
  }

  return items.length;
}

/**
 * Process all items from all feeds
 */
async function processAllFeeds(
  ctx: SyncContext,
  feeds: RssFeedConfig[],
): Promise<{ stats: SyncStats; totalItems: number }> {
  const tags = ctx.user.preferences?.rssSyncTags || DEFAULT_RSS_TAGS;
  const stats = createSyncStats();
  let totalItems = 0;

  const rssClient = createRssClient({}, ctx.logger);
  const enabledFeeds = feeds.filter((f) => f.enabled);

  for (const feedConfig of enabledFeeds) {
    try {
      const itemCount = await processFeedItems({ ctx, feedConfig, rssClient, tags, stats });
      totalItems += itemCount;
    } catch (error) {
      ctx.logger.error('Failed to fetch RSS feed', {
        feedUrl: feedConfig.feedUrl,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { stats, totalItems };
}

/**
 * Syncs RSS feeds for a specific user
 */
async function performUserSync(
  user: SyncUser,
  logger: SyncLogger,
  getUserDb: RssSyncSchedulerConfig['getUserDb'],
): Promise<void> {
  const feeds = user.preferences?.rssFeeds?.filter((f) => f.enabled) || [];

  if (feeds.length === 0) {
    logger.debug('No enabled feeds for user', { userId: user._id });
    return;
  }

  logger.info('Starting RSS sync for user', {
    userId: user._id,
    username: user.username,
    feedCount: feeds.length,
  });

  const { stats, totalItems } = await processAllFeeds({ user, logger, getUserDb }, feeds);

  logger.info('RSS sync completed for user', {
    userId: user._id,
    username: user.username,
    totalItems,
    created: stats.created,
    skipped: stats.skipped,
    errors: stats.errors,
  });
}

export class RssSyncScheduler {
  private checkIntervalMs: number;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private logger: SyncLogger;
  private getUserDb: RssSyncSchedulerConfig['getUserDb'];

  constructor(config: RssSyncSchedulerConfig) {
    this.checkIntervalMs = config.checkIntervalMs;
    this.logger = config.logger;
    this.getUserDb = config.getUserDb;

    this.logger.info('RSS sync scheduler created', {
      checkIntervalMs: this.checkIntervalMs,
    });
  }

  start(): void {
    if (this.isRunning) {
      this.logger.warn('RSS sync scheduler is already running');
      return;
    }

    this.isRunning = true;
    this.intervalId = setInterval(() => {
      this.checkAndSyncUsers().catch((error) => {
        this.logger.error('Error in RSS sync check', { error });
      });
    }, this.checkIntervalMs);

    this.logger.info('RSS sync scheduler started');
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    this.logger.info('RSS sync scheduler stopped');
  }

  private async checkAndSyncUsers(): Promise<void> {
    const env = createEnv();
    const userRegistry = createUserRegistry(env.COUCHDB_URL, env);

    try {
      const users = await userRegistry.list();
      const syncEnabledUsers = users.filter(
        (user) =>
          user.status === 'active' &&
          user.preferences?.rssSync === true &&
          user.preferences?.rssFeeds?.some((f) => f.enabled),
      );

      this.logger.debug('Checking RSS sync for users', {
        totalUsers: users.length,
        syncEnabledUsers: syncEnabledUsers.length,
      });

      for (const user of syncEnabledUsers) {
        if (!shouldSyncUser(user.preferences)) continue;

        try {
          await this.syncUserFeeds(user);
        } catch (error) {
          this.logger.error('Failed to sync RSS feeds for user', {
            userId: user._id,
            username: user.username,
            error,
          });
        }
      }
    } catch (error) {
      this.logger.error('Failed to check users for RSS sync', { error });
    }
  }

  public async syncUser(userId: string): Promise<void> {
    const env = createEnv();
    const userRegistry = createUserRegistry(env.COUCHDB_URL, env);
    const users = await userRegistry.list();
    const user = users.find((u) => u._id === userId);

    if (!user) throw new Error(`User not found: ${userId}`);
    if (!user.preferences?.rssSync) throw new Error('RSS sync not enabled for user');

    await this.syncUserFeeds(user);
  }

  private async syncUserFeeds(user: SyncUser): Promise<void> {
    try {
      await performUserSync(user, this.logger, this.getUserDb);
      await this.updateLastSyncTime(user._id);
    } catch (error) {
      this.logger.error('Failed to sync RSS feeds', {
        userId: user._id,
        username: user.username,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async updateLastSyncTime(userId: string): Promise<void> {
    try {
      const env = createEnv();
      const userRegistry = createUserRegistry(env.COUCHDB_URL, env);

      const users = await userRegistry.list();
      const user = users.find((u) => u._id === userId);

      if (user) {
        await userRegistry.update(userId, {
          preferences: {
            ...user.preferences,
            rssLastSync: new Date().toISOString(),
          },
        });
      }
    } catch (error) {
      this.logger.error('Failed to update last sync time', { userId, error });
    }
  }

  getStatus(): { isRunning: boolean; checkIntervalMs: number } {
    return {
      isRunning: this.isRunning,
      checkIntervalMs: this.checkIntervalMs,
    };
  }
}

export function createRssSyncScheduler(config: RssSyncSchedulerConfig): RssSyncScheduler {
  return new RssSyncScheduler(config);
}
