/**
 * Email Sync Scheduler
 * Periodically syncs emails from IMAP folders for users with sync enabled
 */
import { createEnv, createUserRegistry, type TodoAlpha3 } from '@eddo/core-server';
import type { EmailSyncConfig } from '@eddo/core-shared';
import type nano from 'nano';

import { withSpan } from '../utils/logger.js';
import { createEmailClient, type EmailLogger } from './client.js';
import { createGoogleOAuthClient } from './oauth.js';
import { createSyncStats, incrementStat, processEmail, type SyncStats } from './sync-helpers.js';
import type { EmailItem, ImapConnectionConfig } from './types.js';

interface UserPreferences {
  emailSync?: boolean;
  emailConfig?: EmailSyncConfig;
  emailFolder?: string;
  emailSyncInterval?: number;
  emailSyncTags?: string[];
  emailLastSync?: string;
}

interface SyncUser {
  _id: string;
  username: string;
  database_name: string;
  status?: string;
  preferences?: UserPreferences;
}

/** Scheduler configuration */
export interface EmailSyncSchedulerConfig {
  checkIntervalMs: number;
  logger: EmailLogger;
  getUserDb: (dbName: string) => nano.DocumentScope<TodoAlpha3>;
}

/** Default tags for email items */
const DEFAULT_EMAIL_TAGS = ['source:email', 'gtd:next'];

/** Default sync interval in minutes */
const DEFAULT_SYNC_INTERVAL = 15;

/**
 * Determine if user needs sync based on last sync time and interval
 */
export function shouldSyncUser(preferences?: UserPreferences): boolean {
  if (!preferences?.emailSync) return false;
  if (!preferences.emailConfig) return false;

  const lastSync = preferences.emailLastSync;
  const syncInterval = preferences.emailSyncInterval || DEFAULT_SYNC_INTERVAL;

  if (!lastSync) return true;

  const lastSyncTime = new Date(lastSync).getTime();
  const now = Date.now();
  const intervalMs = syncInterval * 60 * 1000;

  return now - lastSyncTime >= intervalMs;
}

/**
 * Builds IMAP connection config from user preferences
 */
function buildImapConfig(preferences: UserPreferences): ImapConnectionConfig {
  const config = preferences.emailConfig!;
  return {
    provider: config.provider,
    oauthRefreshToken: config.oauthRefreshToken,
    oauthEmail: config.oauthEmail,
    imapHost: config.imapHost,
    imapPort: config.imapPort,
    imapUser: config.imapUser || config.oauthEmail,
    imapPassword: config.imapPassword,
    folder: preferences.emailFolder || 'eddo',
  };
}

/**
 * Gets OAuth access token for Gmail
 */
async function getGmailAccessToken(refreshToken: string, logger: EmailLogger): Promise<string> {
  const env = createEnv();
  const oauthClient = createGoogleOAuthClient({
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    redirectUri: env.GOOGLE_REDIRECT_URI,
  });

  logger.info('Refreshing Gmail access token', {
    refreshTokenPrefix: refreshToken.substring(0, 10) + '...',
  });

  try {
    const tokens = await oauthClient.refreshAccessToken(refreshToken);
    logger.info('Got new access token', {
      hasAccessToken: !!tokens.accessToken,
      expiresIn: tokens.expiresIn,
      tokenPrefix: tokens.accessToken.substring(0, 30),
      tokenType: tokens.tokenType,
    });
    return tokens.accessToken;
  } catch (error) {
    logger.error('Failed to refresh access token', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

interface ProcessEmailsConfig {
  db: nano.DocumentScope<TodoAlpha3>;
  emails: EmailItem[];
  tags: string[];
  logger: EmailLogger;
  username: string;
}

/**
 * Process fetched emails and create todos
 */
async function processEmails(config: ProcessEmailsConfig): Promise<SyncStats> {
  const { db, emails, tags, logger, username } = config;
  const stats = createSyncStats();
  stats.fetched = emails.length;

  const emailClient = createEmailClient({}, logger);

  for (const email of emails) {
    try {
      const result = await processEmail({ db, email, tags, emailClient, logger, username });
      incrementStat(stats, result);
    } catch (error) {
      logger.error('Failed to process email', {
        subject: email.subject,
        messageId: email.messageId,
        error: error instanceof Error ? error.message : String(error),
      });
      incrementStat(stats, 'error');
    }
  }

  return stats;
}

interface SyncUserEmailsConfig {
  user: SyncUser;
  logger: EmailLogger;
  getUserDb: EmailSyncSchedulerConfig['getUserDb'];
}

/**
 * Syncs emails for a specific user
 */
async function performUserSync(config: SyncUserEmailsConfig): Promise<SyncStats> {
  const { user, logger, getUserDb } = config;
  const preferences = user.preferences!;
  const imapConfig = buildImapConfig(preferences);
  const tags = preferences.emailSyncTags || DEFAULT_EMAIL_TAGS;

  logger.info('IMAP config built', {
    provider: imapConfig.provider,
    hasRefreshToken: !!imapConfig.oauthRefreshToken,
    oauthEmail: imapConfig.oauthEmail,
    folder: imapConfig.folder,
  });

  // Get access token for Gmail OAuth
  let accessToken: string | undefined;
  if (imapConfig.provider === 'gmail' && imapConfig.oauthRefreshToken) {
    logger.info('Attempting to get access token for Gmail');
    accessToken = await getGmailAccessToken(imapConfig.oauthRefreshToken, logger);
    logger.info('Got access token', { hasToken: !!accessToken, tokenLength: accessToken?.length });
  } else {
    logger.info('Skipping OAuth token refresh', {
      provider: imapConfig.provider,
      hasRefreshToken: !!imapConfig.oauthRefreshToken,
    });
  }

  // Fetch emails from IMAP
  const emailClient = createEmailClient({}, logger);
  const emails = await emailClient.fetchEmails(imapConfig, accessToken);

  if (emails.length === 0) {
    logger.debug('No new emails to sync', { userId: user._id });
    return createSyncStats();
  }

  // Process emails and create todos (deduplication via externalId)
  const db = getUserDb(user.database_name);
  const stats = await processEmails({ db, emails, tags, logger, username: user.username });

  return stats;
}

/**
 * Wraps user sync with OpenTelemetry span
 */
async function syncUserWithSpan(config: SyncUserEmailsConfig): Promise<void> {
  const { user, logger } = config;

  const spanAttrs = {
    'user.id': user._id,
    'user.name': user.username,
    'email.folder': user.preferences?.emailFolder || 'eddo',
    'email.provider': user.preferences?.emailConfig?.provider || 'unknown',
  };

  return withSpan('email_sync_user', spanAttrs, async (span) => {
    logger.info('Starting email sync for user', {
      userId: user._id,
      username: user.username,
      folder: user.preferences?.emailFolder,
    });

    const stats = await performUserSync(config);

    span.setAttribute('email.fetched', stats.fetched);
    span.setAttribute('email.created', stats.created);
    span.setAttribute('email.skipped', stats.skipped);
    span.setAttribute('email.errors', stats.errors);
    span.setAttribute('email.result', 'success');

    logger.info('Email sync completed for user', {
      userId: user._id,
      username: user.username,
      ...stats,
    });
  });
}

/**
 * Updates user's last sync timestamp
 */
async function updateLastSyncTime(userId: string, logger: EmailLogger): Promise<void> {
  logger.info('Updating last sync time', { userId });
  try {
    const env = createEnv();
    const userRegistry = createUserRegistry(env.COUCHDB_URL, env);
    const users = await userRegistry.list();
    const user = users.find((u) => u._id === userId);

    if (user) {
      const newLastSync = new Date().toISOString();
      await userRegistry.update(userId, {
        preferences: {
          ...user.preferences,
          emailLastSync: newLastSync,
        },
      });
      logger.info('Updated last sync time', { userId, emailLastSync: newLastSync });
    } else {
      logger.warn('User not found for last sync update', { userId });
    }
  } catch (error) {
    logger.error('Failed to update last sync time', { userId, error });
  }
}

/**
 * Filter users who have email sync enabled
 */
function filterSyncEnabledUsers(users: SyncUser[]): SyncUser[] {
  return users.filter(
    (user) =>
      user.status === 'active' &&
      user.preferences?.emailSync === true &&
      user.preferences?.emailConfig != null,
  );
}

interface CheckAndSyncConfig {
  logger: EmailLogger;
  getUserDb: EmailSyncSchedulerConfig['getUserDb'];
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
          logger.error('Failed to sync emails for user', {
            userId: user._id,
            username: user.username,
            error: error instanceof Error ? error.message : String(error),
          });
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
