import { type Env } from '../config/env';

/**
 * Generate environment-aware database names for consistent naming across production and testing
 */

/**
 * Get the base database prefix based on environment
 */
export function getDatabasePrefix(env: Env): string {
  const basePrefix =
    env.NODE_ENV === 'test' ? env.DATABASE_TEST_PREFIX : env.DATABASE_PREFIX;
  return basePrefix;
}

/**
 * Get the user registry database name
 */
export function getUserRegistryDatabaseName(env: Env): string {
  const prefix = getDatabasePrefix(env);
  return `${prefix}_user_registry`;
}

/**
 * Get the user-specific database name
 */
export function getUserDatabaseName(env: Env, username: string): string {
  const prefix = getDatabasePrefix(env);
  // Sanitize username to ensure valid database name
  const sanitizedUsername = sanitizeUsername(username);
  return `${prefix}_user_${sanitizedUsername}`;
}

/**
 * Extract username from user database name
 */
export function extractUsernameFromDatabaseName(
  databaseName: string,
  env: Env,
): string | null {
  const productionPrefix = env.DATABASE_PREFIX;
  const testPrefix = env.DATABASE_TEST_PREFIX;

  const patterns = [
    new RegExp(`^${productionPrefix}_user_(.+)$`),
    new RegExp(`^${testPrefix}_user_(.+)$`),
  ];

  for (const pattern of patterns) {
    const match = databaseName.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

/**
 * Check if a database name is a user database
 */
export function isUserDatabase(databaseName: string, env: Env): boolean {
  const productionPrefix = env.DATABASE_PREFIX;
  const testPrefix = env.DATABASE_TEST_PREFIX;

  const pattern = new RegExp(`^(?:${productionPrefix}|${testPrefix})_user_.+$`);
  return pattern.test(databaseName);
}

/**
 * Check if a database name is the user registry
 */
export function isUserRegistryDatabase(
  databaseName: string,
  env: Env,
): boolean {
  const productionPrefix = env.DATABASE_PREFIX;
  const testPrefix = env.DATABASE_TEST_PREFIX;

  const pattern = new RegExp(
    `^(?:${productionPrefix}|${testPrefix})_user_registry$`,
  );
  return pattern.test(databaseName);
}

/**
 * Sanitize username to ensure valid database name
 * CouchDB database names must match: ^[a-z][a-z0-9_$()+/-]*$
 */
export function sanitizeUsername(username: string): string {
  return username
    .toLowerCase()
    .replace(/[^a-z0-9_$()+/-]/g, '_')
    .replace(/^[^a-z]/, 'u_') // Ensure starts with letter
    .substring(0, 50); // Limit length
}

/**
 * Generate a unique linking code for Telegram user linking
 */
export function generateLinkingCode(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}${random}`.toUpperCase();
}

/**
 * Get all database names for a user (registry + user database)
 */
export function getAllUserDatabaseNames(env: Env, username: string): string[] {
  return [getUserRegistryDatabaseName(env), getUserDatabaseName(env, username)];
}

/**
 * Get database configuration for user registry
 */
export function getUserRegistryDatabaseConfig(env: Env) {
  return {
    url: env.COUCHDB_URL,
    dbName: getUserRegistryDatabaseName(env),
    fullUrl: `${env.COUCHDB_URL}/${getUserRegistryDatabaseName(env)}`,
  };
}

/**
 * Get database configuration for user-specific database
 */
export function getUserDatabaseConfig(env: Env, username: string) {
  const dbName = getUserDatabaseName(env, username);
  return {
    url: env.COUCHDB_URL,
    dbName,
    fullUrl: `${env.COUCHDB_URL}/${dbName}`,
  };
}
