/**
 * User sync operations for email scheduler
 */
import { createEnv, createUserRegistry, type TodoAlpha3 } from '@eddo/core-server';
import type { EmailSyncConfig } from '@eddo/core-shared';
import type nano from 'nano';

import { withSpan } from '../utils/logger.js';
import { createEmailClient, type EmailLogger } from './client.js';
import { createGoogleOAuthClient } from './oauth.js';
import {
  createSyncStats,
  incrementStat,
  markTodoAsMoved,
  processEmail,
  type SyncStats,
} from './sync-helpers.js';
import type { EmailItem, ImapConnectionConfig } from './types.js';

export interface UserPreferences {
  emailSync?: boolean;
  emailConfig?: EmailSyncConfig;
  emailFolder?: string;
  emailSyncInterval?: number;
  emailSyncTags?: string[];
  emailLastSync?: string;
}

export interface SyncUser {
  _id: string;
  username: string;
  database_name: string;
  status?: string;
  preferences?: UserPreferences;
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
export function buildImapConfig(preferences: UserPreferences): ImapConnectionConfig {
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
export async function getGmailAccessToken(
  refreshToken: string,
  logger: EmailLogger,
): Promise<string> {
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

/** Result of processing emails including UIDs to move */
interface ProcessEmailsResult {
  stats: SyncStats;
  toMove: Array<{ uid: number; todoId: string }>;
}

/**
 * Process fetched emails and create todos
 */
export async function processEmails(config: ProcessEmailsConfig): Promise<ProcessEmailsResult> {
  const { db, emails, tags, logger, username } = config;
  const stats = createSyncStats();
  stats.fetched = emails.length;
  const toMove: Array<{ uid: number; todoId: string }> = [];

  const emailClient = createEmailClient({}, logger);

  for (const email of emails) {
    try {
      const result = await processEmail({ db, email, tags, emailClient, logger, username });
      incrementStat(stats, result);

      if ((result.status === 'created' || result.status === 'needs_move') && result.todoId) {
        toMove.push({ uid: result.uid, todoId: result.todoId });
      }
    } catch (error) {
      logger.error('Failed to process email', {
        subject: email.subject,
        messageId: email.messageId,
        error: error instanceof Error ? error.message : String(error),
      });
      incrementStat(stats, { status: 'error' });
    }
  }

  return { stats, toMove };
}

/** Config for moving processed emails */
interface MoveProcessedConfig {
  emailClient: ReturnType<typeof createEmailClient>;
  imapConfig: ImapConnectionConfig;
  accessToken: string | undefined;
  toMove: Array<{ uid: number; todoId: string }>;
  db: nano.DocumentScope<TodoAlpha3>;
  logger: EmailLogger;
}

/**
 * Move processed emails and mark todos as moved
 */
export async function moveProcessedEmails(
  config: MoveProcessedConfig,
): Promise<{ moved: number; failed: number }> {
  const { emailClient, imapConfig, accessToken, toMove, db, logger } = config;

  if (toMove.length === 0) return { moved: 0, failed: 0 };

  const uids = toMove.map((item) => item.uid);
  const moveResult = await emailClient.moveToProcessed(imapConfig, uids, accessToken);

  const movedSet = new Set(moveResult.moved);
  let markedCount = 0;

  for (const item of toMove) {
    if (movedSet.has(item.uid)) {
      const marked = await markTodoAsMoved(db, item.todoId, logger);
      if (marked) markedCount++;
    }
  }

  logger.info('Move results', {
    attempted: uids.length,
    moved: moveResult.moved.length,
    failed: moveResult.failed.length,
    todosMarked: markedCount,
  });

  return { moved: moveResult.moved.length, failed: moveResult.failed.length };
}

/**
 * Gets OAuth access token if needed
 */
export async function getAccessTokenIfNeeded(
  imapConfig: ImapConnectionConfig,
  logger: EmailLogger,
): Promise<string | undefined> {
  if (imapConfig.provider === 'gmail' && imapConfig.oauthRefreshToken) {
    logger.info('Attempting to get access token for Gmail');
    const token = await getGmailAccessToken(imapConfig.oauthRefreshToken, logger);
    logger.info('Got access token', { hasToken: !!token, tokenLength: token?.length });
    return token;
  }
  logger.info('Skipping OAuth token refresh', {
    provider: imapConfig.provider,
    hasRefreshToken: !!imapConfig.oauthRefreshToken,
  });
  return undefined;
}

interface PerformUserSyncConfig {
  user: SyncUser;
  logger: EmailLogger;
  getUserDb: (dbName: string) => nano.DocumentScope<TodoAlpha3>;
}

/**
 * Syncs emails for a specific user
 */
export async function performUserSync(config: PerformUserSyncConfig): Promise<SyncStats> {
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

  const accessToken = await getAccessTokenIfNeeded(imapConfig, logger);

  const emailClient = createEmailClient({}, logger);
  const emails = await emailClient.fetchEmails(imapConfig, accessToken);

  if (emails.length === 0) {
    logger.debug('No new emails to sync', { userId: user._id });
    return createSyncStats();
  }

  const db = getUserDb(user.database_name);
  const { stats, toMove } = await processEmails({
    db,
    emails,
    tags,
    logger,
    username: user.username,
  });

  await moveProcessedEmails({ emailClient, imapConfig, accessToken, toMove, db, logger });

  return stats;
}

/**
 * Wraps user sync with OpenTelemetry span
 */
export async function syncUserWithSpan(config: PerformUserSyncConfig): Promise<void> {
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
export async function updateLastSyncTime(userId: string, logger: EmailLogger): Promise<void> {
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
export function filterSyncEnabledUsers(users: SyncUser[]): SyncUser[] {
  return users.filter(
    (user) =>
      user.status === 'active' &&
      user.preferences?.emailSync === true &&
      user.preferences?.emailConfig != null,
  );
}
