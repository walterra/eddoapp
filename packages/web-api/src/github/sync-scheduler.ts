/**
 * GitHub Issue Sync Scheduler
 * Periodically syncs GitHub issues for users with sync enabled
 */
import { createEnv, createUserRegistry, type TodoAlpha3 } from '@eddo/core-server';
import type nano from 'nano';

import { createGithubClient } from './client.js';
import { isRateLimitError, type RateLimitError } from './rate-limit.js';
import { hasTodoChanged, processIssue, type SyncLogger } from './sync-helpers.js';
import { shouldSyncUser } from './sync-utils.js';

// Re-export for tests
export { hasTodoChanged };

interface UserPreferences {
  githubToken?: string | null;
  githubSync?: boolean;
  githubSyncTags?: string[];
  githubLastSync?: string;
  githubSyncStartedAt?: string;
}

interface SyncUser {
  _id: string;
  username: string;
  database_name: string;
  preferences?: UserPreferences;
}

interface GithubSyncSchedulerConfig {
  checkIntervalMs: number;
  logger: SyncLogger;
  getUserDb: (dbName: string) => nano.DocumentScope<TodoAlpha3>;
}

/**
 * Sync GitHub issues for a specific user
 */
async function performUserSync(
  user: SyncUser,
  logger: SyncLogger,
  getUserDb: GithubSyncSchedulerConfig['getUserDb'],
  forceResync = false,
): Promise<void> {
  const token = user.preferences?.githubToken;
  if (!token) {
    logger.warn('User has GitHub sync enabled but no token', { userId: user._id });
    return;
  }

  const isInitialSync = forceResync || !user.preferences?.githubLastSync;

  logger.info('Starting GitHub sync for user', {
    userId: user._id,
    username: user.username,
    isInitialSync,
  });

  const githubClient = createGithubClient({ token }, logger);
  const lastSync = user.preferences?.githubLastSync;

  const issues = await githubClient.fetchUserIssues({
    state: isInitialSync ? 'open' : 'all',
    since: isInitialSync ? undefined : lastSync,
  });

  const tags = user.preferences?.githubSyncTags || ['github', 'gtd:next'];
  const db = getUserDb(user.database_name);

  let created = 0;
  let updated = 0;
  let completed = 0;

  for (const issue of issues) {
    const context = issue.repository.full_name;
    const result = await processIssue({
      db,
      issue,
      context,
      tags,
      githubClient,
      forceResync,
      logger,
    });

    if (result === 'created') created++;
    else if (result === 'updated') updated++;
    else if (result === 'completed') completed++;
  }

  logger.info('Successfully synced GitHub issues for user', {
    userId: user._id,
    username: user.username,
    isInitialSync,
    issueState: isInitialSync ? 'open' : 'all',
    since: isInitialSync ? 'none' : lastSync || 'none',
    totalIssues: issues.length,
    created,
    updated,
    completed,
  });
}

export class GithubSyncScheduler {
  private checkIntervalMs: number;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private logger: SyncLogger;
  private getUserDb: GithubSyncSchedulerConfig['getUserDb'];

  constructor(config: GithubSyncSchedulerConfig) {
    this.checkIntervalMs = config.checkIntervalMs;
    this.logger = config.logger;
    this.getUserDb = config.getUserDb;

    this.logger.info('GitHub sync scheduler created', {
      checkIntervalMs: this.checkIntervalMs,
    });
  }

  start(): void {
    if (this.isRunning) {
      this.logger.warn('GitHub sync scheduler is already running');
      return;
    }

    this.isRunning = true;
    this.intervalId = setInterval(() => {
      this.checkAndSyncUsers().catch((error) => {
        this.logger.error('Error in GitHub sync check', { error });
      });
    }, this.checkIntervalMs);

    this.logger.info('GitHub sync scheduler started');
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    this.logger.info('GitHub sync scheduler stopped');
  }

  private async checkAndSyncUsers(): Promise<void> {
    const env = createEnv();
    const userRegistry = createUserRegistry(env.COUCHDB_URL, env);

    try {
      const users = await userRegistry.list();
      const syncEnabledUsers = users.filter(
        (user) =>
          user.status === 'active' &&
          user.preferences?.githubSync === true &&
          user.preferences?.githubToken,
      );

      this.logger.debug('Checking GitHub sync for users', {
        totalUsers: users.length,
        syncEnabledUsers: syncEnabledUsers.length,
      });

      for (const user of syncEnabledUsers) {
        if (!shouldSyncUser(user.preferences)) continue;

        try {
          await this.syncUserIssues(user);
        } catch (error) {
          this.logger.error('Failed to sync GitHub issues for user', {
            userId: user._id,
            username: user.username,
            error,
          });
        }
      }
    } catch (error) {
      this.logger.error('Failed to check users for GitHub sync', { error });
    }
  }

  public async syncUser(userId: string, forceResync = false): Promise<void> {
    const env = createEnv();
    const userRegistry = createUserRegistry(env.COUCHDB_URL, env);
    const users = await userRegistry.list();
    const user = users.find((u) => u._id === userId);

    if (!user) throw new Error(`User not found: ${userId}`);
    if (!user.preferences?.githubSync) throw new Error('GitHub sync not enabled for user');

    await this.syncUserIssues(user, forceResync);
  }

  private async syncUserIssues(user: SyncUser, forceResync = false): Promise<void> {
    try {
      await performUserSync(user, this.logger, this.getUserDb, forceResync);
      await this.updateLastSyncTime(user._id);
    } catch (error) {
      if (isRateLimitError(error)) {
        const rateLimitError = error as RateLimitError;
        this.logger.warn('GitHub sync hit rate limit', {
          userId: user._id,
          username: user.username,
          error: rateLimitError.message,
          resetTime: rateLimitError.resetTime,
          rateLimitInfo: rateLimitError.rateLimitInfo,
        });
        throw rateLimitError;
      }

      this.logger.error('Failed to sync GitHub issues', {
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
            githubLastSync: new Date().toISOString(),
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

export function createGithubSyncScheduler(config: GithubSyncSchedulerConfig): GithubSyncScheduler {
  return new GithubSyncScheduler(config);
}
