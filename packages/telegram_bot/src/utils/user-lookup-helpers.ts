/**
 * User lookup helper functions
 */
import type { UserPreferences } from '@eddo/core-shared';

import { logger } from './logger.js';
import type { TelegramUser } from './user-lookup.js';

interface UserRegistryUser {
  _id: string;
  username: string;
  email: string;
  telegram_id?: number | null;
  database_name: string;
  status: string;
  permissions: string[];
  created_at: string;
  updated_at: string;
  preferences: UserPreferences;
}

/**
 * Logs cache hit for user lookup
 * @param telegramId - Telegram user ID
 * @param username - Username if available
 */
export function logCacheHit(telegramId: number, username?: string): void {
  logger.debug('User lookup cache hit', { telegramId, username });
}

/**
 * Logs user not found in registry
 * @param telegramId - Telegram user ID
 */
export function logUserNotFound(telegramId: number): void {
  logger.debug('User not found in registry', { telegramId });
}

/**
 * Logs inactive user found
 * @param telegramId - Telegram user ID
 * @param username - Username
 * @param status - User status
 */
export function logInactiveUser(telegramId: number, username: string, status: string): void {
  logger.warn('User found but not active', { telegramId, username, status });
}

/**
 * Logs successful user lookup
 * @param telegramId - Telegram user ID
 * @param username - Username
 * @param userId - User document ID
 */
export function logLookupSuccess(telegramId: number, username: string, userId: string): void {
  logger.info('User lookup successful', { telegramId, username, userId });
}

/**
 * Converts registry user to TelegramUser
 * @param user - User from registry
 * @returns TelegramUser object
 */
export function toTelegramUser(user: UserRegistryUser): TelegramUser {
  return {
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
}

/**
 * Logs lookup error
 * @param telegramId - Telegram user ID
 * @param error - Error that occurred
 */
export function logLookupError(telegramId: number, error: unknown): void {
  logger.error('Error looking up user by Telegram ID', {
    telegramId,
    error: error instanceof Error ? error.message : String(error),
  });
}
