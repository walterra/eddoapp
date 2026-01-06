import { createEnv, createUserRegistry } from '@eddo/core-server';
import { UserPreferences } from '@eddo/core-shared';

import { logger } from './logger.js';
import {
  logInactiveUser,
  logLookupError,
  logLookupSuccess,
  logUserNotFound,
  toTelegramUser,
} from './user-lookup-helpers.js';

/**
 * User lookup result from the user registry
 */
export interface TelegramUser {
  _id: string;
  username: string;
  email: string;
  telegram_id: number;
  database_name: string;
  status: string;
  permissions: string[];
  created_at: string;
  updated_at: string;
  preferences: UserPreferences;
}

/**
 * No-op for backwards compatibility (cache was removed for simplicity)
 * @deprecated Cache no longer used - this function does nothing
 */
export function invalidateUserCache(_telegramId: number): void {
  // No-op: cache removed for simplicity, fresh data fetched on each lookup
}

/**
 * Looks up a user by their Telegram ID in the user registry
 */
export async function lookupUserByTelegramId(telegramId: number): Promise<TelegramUser | null> {
  try {
    const env = createEnv();
    const userRegistry = createUserRegistry(env.COUCHDB_URL, env);

    logger.debug('Looking up user by Telegram ID', { telegramId });

    const user = await userRegistry.findByTelegramId(telegramId);

    if (!user) {
      logUserNotFound(telegramId);
      return null;
    }

    if (user.status !== 'active') {
      logInactiveUser(telegramId, user.username, user.status);
      return null;
    }

    logLookupSuccess(telegramId, user.username, user._id);
    return toTelegramUser(user);
  } catch (error) {
    logLookupError(telegramId, error);
    return null;
  }
}

/**
 * Check if a Telegram user is authorized to use the bot
 */
export async function isTelegramUserAuthorized(telegramId: number): Promise<boolean> {
  const user = await lookupUserByTelegramId(telegramId);
  return user !== null;
}

/**
 * Get user context for MCP operations
 */
export async function getUserContextForMCP(telegramId: number): Promise<{
  username: string;
  databaseName: string;
} | null> {
  const user = await lookupUserByTelegramId(telegramId);

  if (!user) {
    return null;
  }

  return {
    username: user.username,
    databaseName: user.database_name,
  };
}
