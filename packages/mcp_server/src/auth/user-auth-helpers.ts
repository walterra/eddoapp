/**
 * Helper functions for user authentication
 */
import type { MCPAuthResult } from './user-auth.js';

/**
 * Create an authentication error Response
 */
export function createAuthError(status: number, statusText: string): Response {
  return new Response(null, { status, statusText });
}

/**
 * Extract header value from headers object (handles both string and string[] types)
 */
export function extractHeader(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string | undefined {
  const value = headers[name] || headers[name.toLowerCase()];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

/**
 * Cache entry for user validation results
 */
export interface ValidationCacheEntry {
  valid: boolean;
  user?: MCPAuthResult;
  timestamp: number;
}

/**
 * Create a cache key from username and telegram ID
 */
export function createCacheKey(
  apiKey: string,
  telegramId: string | undefined,
  databaseName: string | undefined,
): string {
  return `${apiKey}:${telegramId || 'no_telegram'}:${databaseName || 'no_database'}`;
}

/**
 * Check if cache entry is still valid
 */
export function isCacheValid(entry: ValidationCacheEntry | undefined, ttlMs: number): boolean {
  if (!entry) return false;
  return Date.now() - entry.timestamp < ttlMs;
}

/**
 * Create a negative cache entry
 */
export function createNegativeCacheEntry(): ValidationCacheEntry {
  return { valid: false, timestamp: Date.now() };
}

/**
 * Create a positive cache entry
 */
export function createPositiveCacheEntry(user: MCPAuthResult): ValidationCacheEntry {
  return { valid: true, user, timestamp: Date.now() };
}

/**
 * Log authentication success
 */
export function logAuthSuccess(user: MCPAuthResult): void {
  console.log('User authentication successful', {
    username: user.username,
    userId: user.userId,
    databaseName: user.dbName,
  });
}

/**
 * Log authentication failure for user not found
 */
export function logUserNotFound(identifier: string, identifierType: 'username' | 'apiKey'): void {
  console.warn('User not found for identifier', { identifierType, identifier });
}

/**
 * Log authentication failure for inactive user
 */
export function logUserInactive(username: string, status: string): void {
  console.warn('User found but not active', { username, status });
}

/**
 * Log header mismatch warning
 */
export function logHeaderMismatch(
  field: string,
  provided: string | number,
  actual: string | number,
): void {
  console.warn(`${field} mismatch in headers`, { provided, actual });
}

/**
 * Log authentication error
 */
export function logAuthError(
  error: unknown,
  identifier: string,
  identifierType: 'username' | 'apiKey',
): void {
  console.error('Error during user authentication', {
    error: error instanceof Error ? error.message : String(error),
    identifier,
    identifierType,
  });
}
