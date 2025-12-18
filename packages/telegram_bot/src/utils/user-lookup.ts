import { createEnv, createUserRegistry } from '@eddo/core-server';
import { UserPreferences } from '@eddo/core-shared';

import { logger } from './logger.js';

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
 * Look up a user by their Telegram ID in the user registry
 */
export async function lookupUserByTelegramId(telegramId: number): Promise<TelegramUser | null> {
  // Check cache first
  const cached = userCache.get(telegramId);
  const cacheTime = cacheTimestamps.get(telegramId);

  if (cached !== undefined && cacheTime && Date.now() - cacheTime < CACHE_TTL_MS) {
    logger.debug('User lookup cache hit', {
      telegramId,
      username: cached?.username,
    });
    return cached;
  }

  try {
    // Initialize environment and user registry
    const env = createEnv();
    const userRegistry = createUserRegistry(env.COUCHDB_URL, env);

    logger.debug('Looking up user by Telegram ID', { telegramId });

    // Query user registry
    const user = await userRegistry.findByTelegramId(telegramId);

    if (!user) {
      logger.debug('User not found in registry', { telegramId });
      // Cache negative result
      userCache.set(telegramId, null);
      cacheTimestamps.set(telegramId, Date.now());
      return null;
    }

    // Check if user is active
    if (user.status !== 'active') {
      logger.warn('User found but not active', {
        telegramId,
        username: user.username,
        status: user.status,
      });
      // Cache negative result for inactive users
      userCache.set(telegramId, null);
      cacheTimestamps.set(telegramId, Date.now());
      return null;
    }

    logger.info('User lookup successful', {
      telegramId,
      username: user.username,
      userId: user._id,
    });

    const telegramUser: TelegramUser = {
      _id: user._id,
      username: user.username,
      email: user.email,
      telegram_id: user.telegram_id!,
      database_name: user.database_name,
      status: user.status,
      permissions: user.permissions,
      created_at: user.created_at,
      updated_at: user.updated_at,
      preferences: user.preferences,
    };

    // Cache the result
    userCache.set(telegramId, telegramUser);
    cacheTimestamps.set(telegramId, Date.now());

    return telegramUser;
  } catch (error) {
    logger.error('Error looking up user by Telegram ID', {
      telegramId,
      error: error instanceof Error ? error.message : String(error),
    });
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

/**
 * Clear user cache (useful for testing or when user data changes)
 */
export function clearUserCache(): void {
  userCache.clear();
  cacheTimestamps.clear();
  logger.debug('User cache cleared');
}

/**
 * Get cache statistics (useful for monitoring)
 */
export function getCacheStats(): {
  size: number;
  entries: Array<{ telegramId: number; username?: string; cached: number }>;
} {
  const entries = [];
  for (const [telegramId, user] of userCache.entries()) {
    const cached = cacheTimestamps.get(telegramId) || 0;
    entries.push({
      telegramId,
      username: user?.username,
      cached,
    });
  }

  return {
    size: userCache.size,
    entries,
  };
}
