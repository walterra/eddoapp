import { createEnv, createUserRegistry } from '@eddo/core-server';
import { UserPreferences } from '@eddo/core-shared';

import { logger } from './logger.js';
import {
  logCacheHit,
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
 * Cached user lookups to avoid repeated database queries
 */
const userCache = new Map<number, TelegramUser | null>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const cacheTimestamps = new Map<number, number>();

// Clear expired cache entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [telegramId, timestamp] of cacheTimestamps.entries()) {
    if (now - timestamp > CACHE_TTL_MS) {
      userCache.delete(telegramId);
      cacheTimestamps.delete(telegramId);
    }
  }
}, 60 * 1000); // Clean up every minute

/**
 * Invalidate cache for a specific user (call after updating user data)
 */
export function invalidateUserCache(telegramId: number): void {
  userCache.delete(telegramId);
  cacheTimestamps.delete(telegramId);
  logger.debug('User cache invalidated', { telegramId });
}

function cacheResult(telegramId: number, result: TelegramUser | null): void {
  userCache.set(telegramId, result);
  cacheTimestamps.set(telegramId, Date.now());
}

function getCachedResult(telegramId: number): { found: boolean; user: TelegramUser | null } {
  const cached = userCache.get(telegramId);
  const cacheTime = cacheTimestamps.get(telegramId);
  const isValid = cached !== undefined && cacheTime && Date.now() - cacheTime < CACHE_TTL_MS;

  if (isValid) {
    logCacheHit(telegramId, cached?.username);
    return { found: true, user: cached };
  }
  return { found: false, user: null };
}

/**
 * Looks up a user by their Telegram ID in the user registry
 */
export async function lookupUserByTelegramId(telegramId: number): Promise<TelegramUser | null> {
  const cachedResult = getCachedResult(telegramId);
  if (cachedResult.found) return cachedResult.user;

  try {
    const env = createEnv();
    const userRegistry = createUserRegistry(env.COUCHDB_URL, env);

    logger.debug('Looking up user by Telegram ID', { telegramId });

    const user = await userRegistry.findByTelegramId(telegramId);

    if (!user) {
      logUserNotFound(telegramId);
      cacheResult(telegramId, null);
      return null;
    }

    if (user.status !== 'active') {
      logInactiveUser(telegramId, user.username, user.status);
      cacheResult(telegramId, null);
      return null;
    }

    logLookupSuccess(telegramId, user.username, user._id);
    const telegramUser = toTelegramUser(user);
    cacheResult(telegramId, telegramUser);
    return telegramUser;
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
