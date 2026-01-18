/**
 * Email Sync Scheduler
 * Periodically syncs emails from IMAP folders for users with sync enabled
 */
import { createEnv, createUserRegistry, type TodoAlpha3 } from '@eddo/core-server';
import type nano from 'nano';

import { withSpan } from '../utils/logger.js';
import type { EmailLogger } from './client.js';
import {
  disableEmailSyncWithError,
  filterSyncEnabledUsers,
  OAuthInvalidGrantError,
  shouldSyncUser,
  syncUserWithSpan,
  updateLastSyncTime,
} from './user-sync-operations.js';

/** Scheduler configuration */
export interface EmailSyncSchedulerConfig {
  checkIntervalMs: number;
  logger: EmailLogger;
  getUserDb: (dbName: string) => nano.DocumentScope<TodoAlpha3>;
}

// Re-export shouldSyncUser for backward compatibility
export { shouldSyncUser } from './user-sync-operations.js';

interface CheckAndSyncConfig {
  logger: EmailLogger;
  getUserDb: EmailSyncSchedulerConfig['getUserDb'];
}

/** Handle user sync error - disable sync for OAuth errors, log others */
async function handleUserSyncError(
  error: unknown,
  user: { _id: string; username: string },
  logger: EmailLogger,
): Promise<void> {
  if (error instanceof OAuthInvalidGrantError) {
    logger.warn('Disabling email sync due to invalid OAuth token', {
      userId: user._id,
      username: user.username,
    });
    await disableEmailSyncWithError(user._id, error.message, logger);
    return;
  }

  logger.error('Failed to sync emails for user', {
    userId: user._id,
    username: user.username,
    error: error instanceof Error ? error.message : String(error),
  });
}

/**
 * Check and sync all eligible users
 */
async function checkAndSyncAllUsers(config: CheckAndSyncConfig): Promise<void> {
  const { logger, getUserDb } = config;

  return withSpan('email_sync_check', {}, async (span) => {
    const env = createEnv();
    const userRegistry = createUserRegistry(env.COUCHDB_URL, env);

    try {
      const users = await userRegistry.list();
      const syncEnabledUsers = filterSyncEnabledUsers(users);

      span.setAttribute('email.total_users', users.length);
      span.setAttribute('email.sync_enabled_users', syncEnabledUsers.length);

      logger.debug('Checking email sync for users', {
        totalUsers: users.length,
        syncEnabledUsers: syncEnabledUsers.length,
      });

      let syncedCount = 0;
      for (const user of syncEnabledUsers) {
        if (!shouldSyncUser(user.preferences)) continue;

        try {
          await syncUserWithSpan({ user, logger, getUserDb });
          await updateLastSyncTime(user._id, logger);
          syncedCount++;
        } catch (error) {
          await handleUserSyncError(error, user, logger);
        }
      }

      span.setAttribute('email.users_synced', syncedCount);
      span.setAttribute('email.result', 'success');
    } catch (error) {
      span.setAttribute('email.result', 'error');
      logger.error('Failed to check users for email sync', { error });
    }
  });
}

/**
 * Sync a specific user by ID
 */
async function syncSpecificUser(
  userId: string,
  logger: EmailLogger,
  getUserDb: EmailSyncSchedulerConfig['getUserDb'],
): Promise<void> {
  const env = createEnv();
  const userRegistry = createUserRegistry(env.COUCHDB_URL, env);
  const users = await userRegistry.list();
  const user = users.find((u) => u._id === userId);

  if (!user) throw new Error(`User not found: ${userId}`);
  if (!user.preferences?.emailSync) throw new Error('Email sync not enabled for user');
  if (!user.preferences?.emailConfig) throw new Error('Email not configured for user');

  await syncUserWithSpan({ user, logger, getUserDb });
  await updateLastSyncTime(userId, logger);
}

/**
 * Email Sync Scheduler
 * Manages periodic email sync for all users with sync enabled
 */
export function createEmailSyncScheduler(config: EmailSyncSchedulerConfig) {
  const { checkIntervalMs, logger, getUserDb } = config;
  let intervalId: NodeJS.Timeout | null = null;
  let isRunning = false;

  logger.info('Email sync scheduler created', { checkIntervalMs });

  return {
    start(): void {
      if (isRunning) {
        logger.warn('Email sync scheduler is already running');
        return;
      }

      isRunning = true;
      intervalId = setInterval(() => {
        checkAndSyncAllUsers({ logger, getUserDb }).catch((error) => {
          logger.error('Error in email sync check', { error });
        });
      }, checkIntervalMs);

      logger.info('Email sync scheduler started');
    },

    stop(): void {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
      isRunning = false;
      logger.info('Email sync scheduler stopped');
    },

    async syncUser(userId: string): Promise<void> {
      await syncSpecificUser(userId, logger, getUserDb);
    },

    getStatus(): { isRunning: boolean; checkIntervalMs: number } {
      return { isRunning, checkIntervalMs };
    },
  };
}

export type EmailSyncScheduler = ReturnType<typeof createEmailSyncScheduler>;
