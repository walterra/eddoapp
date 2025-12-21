/**
 * GitHub Issue Sync Scheduler
 * Periodically syncs GitHub issues for users with sync enabled
 */
import { createEnv, createUserRegistry, type TodoAlpha3 } from '@eddo/core-server';
import type nano from 'nano';

import { createGithubClient } from './client.js';
import { findTodoByExternalId, shouldSyncUser } from './sync-utils.js';
import type { GithubIssue } from './types.js';

interface GithubSyncSchedulerConfig {
  checkIntervalMs: number; // How often to check for users needing sync
  logger: {
    info: (msg: string, meta?: unknown) => void;
    warn: (msg: string, meta?: unknown) => void;
    error: (msg: string, meta?: unknown) => void;
    debug: (msg: string, meta?: unknown) => void;
  };
  getUserDb: (dbName: string) => nano.DocumentScope<TodoAlpha3>;
}

export class GithubSyncScheduler {
  private checkIntervalMs: number;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private logger: GithubSyncSchedulerConfig['logger'];
  private getUserDb: GithubSyncSchedulerConfig['getUserDb'];

  constructor(config: GithubSyncSchedulerConfig) {
    this.checkIntervalMs = config.checkIntervalMs;
    this.logger = config.logger;
    this.getUserDb = config.getUserDb;

    this.logger.info('GitHub sync scheduler created', {
      checkIntervalMs: this.checkIntervalMs,
    });
  }

  /**
   * Start the GitHub sync scheduler
   */
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

  /**
   * Stop the GitHub sync scheduler
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    this.logger.info('GitHub sync scheduler stopped');
  }

  /**
   * Check all users and sync those who need it
   */
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
        const needsSync = shouldSyncUser(user.preferences);

        if (needsSync) {
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
      }
    } catch (error) {
      this.logger.error('Failed to check users for GitHub sync', { error });
    }
  }

  /**
   * Sync GitHub issues for a specific user
   */
  private async syncUserIssues(user: {
    _id: string;
    username: string;
    database_name: string;
    preferences?: {
      githubToken?: string | null;
      githubSyncTags?: string[];
      githubLastSync?: string;
      githubSyncStartedAt?: string;
    };
  }): Promise<void> {
    const token = user.preferences?.githubToken;
    if (!token) {
      this.logger.warn('User has GitHub sync enabled but no token', {
        userId: user._id,
      });
      return;
    }

    const isInitialSync = !user.preferences?.githubLastSync;

    this.logger.info('Starting GitHub sync for user', {
      userId: user._id,
      username: user.username,
      isInitialSync,
    });

    try {
      const githubClient = createGithubClient({ token }, this.logger);

      // On initial sync, only fetch open issues
      // On subsequent syncs, fetch issues updated since sync was enabled (max lookback)
      const syncStartedAt = user.preferences?.githubSyncStartedAt;

      const issues = await githubClient.fetchUserIssues({
        state: isInitialSync ? 'open' : 'all',
        since: isInitialSync ? undefined : syncStartedAt,
      });

      const tags = user.preferences?.githubSyncTags || ['github'];
      const db = this.getUserDb(user.database_name);

      // Process each issue
      let created = 0;
      let updated = 0;
      let completed = 0;

      for (const issue of issues) {
        // Use full repository path as context
        // e.g., "walterra/d3-milestones", "elastic/kibana"
        const context = issue.repository.full_name;

        const result = await this.processIssue(db, issue, context, tags, githubClient);
        if (result === 'created') created++;
        else if (result === 'updated') updated++;
        else if (result === 'completed') completed++;
      }

      // Update last sync timestamp
      await this.updateLastSyncTime(user._id);

      this.logger.info('Successfully synced GitHub issues for user', {
        userId: user._id,
        username: user.username,
        isInitialSync,
        issueState: isInitialSync ? 'open' : 'all',
        since: isInitialSync ? 'none' : syncStartedAt || 'none',
        totalIssues: issues.length,
        created,
        updated,
        completed,
      });
    } catch (error) {
      this.logger.error('Failed to sync GitHub issues', {
        userId: user._id,
        username: user.username,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Process a single GitHub issue (create or update todo)
   */
  private async processIssue(
    db: nano.DocumentScope<TodoAlpha3>,
    issue: GithubIssue,
    context: string,
    tags: string[],
    githubClient: ReturnType<typeof createGithubClient>,
  ): Promise<'created' | 'updated' | 'completed' | 'unchanged'> {
    const externalId = githubClient.generateExternalId(issue);

    // Check if todo already exists
    const existingTodo = await findTodoByExternalId(db, externalId, this.logger);

    if (!existingTodo) {
      // Create new todo
      const newTodo = githubClient.mapIssueToTodo(issue, context, tags);
      await db.insert(newTodo as TodoAlpha3);
      return 'created';
    }

    // Check if issue was closed
    if (issue.state === 'closed' && !existingTodo.completed) {
      await db.insert({
        ...existingTodo,
        completed: issue.closed_at || new Date().toISOString(),
      });
      return 'completed';
    }

    // Check if issue needs update (title or description changed)
    const needsUpdate =
      existingTodo.title !== issue.title || existingTodo.description !== (issue.body || '');

    if (needsUpdate) {
      await db.insert({
        ...existingTodo,
        title: issue.title,
        description: issue.body || '',
      });
      return 'updated';
    }

    return 'unchanged';
  }

  /**
   * Update user's last sync timestamp
   */
  private async updateLastSyncTime(userId: string): Promise<void> {
    try {
      const env = createEnv();
      const userRegistry = createUserRegistry(env.COUCHDB_URL, env);

      // Get current user to merge preferences
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
      this.logger.error('Failed to update last sync time', {
        userId,
        error,
      });
      // Non-fatal error, don't throw
    }
  }

  /**
   * Get scheduler status
   */
  getStatus(): {
    isRunning: boolean;
    checkIntervalMs: number;
  } {
    return {
      isRunning: this.isRunning,
      checkIntervalMs: this.checkIntervalMs,
    };
  }
}

/**
 * Factory function to create a GitHub sync scheduler
 */
export function createGithubSyncScheduler(config: GithubSyncSchedulerConfig): GithubSyncScheduler {
  return new GithubSyncScheduler(config);
}
