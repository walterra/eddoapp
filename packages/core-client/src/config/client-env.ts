import { z } from 'zod';

/**
 * Client-side environment configuration schema
 * Only includes variables that should be exposed to the browser
 */
export const clientEnvSchema = z.object({
  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

/**
 * Type definition for client-side environment configuration
 */
export type ClientEnv = z.infer<typeof clientEnvSchema>;

/**
 * Validate and parse client-side environment configuration
 * Uses safe parsing with defaults for missing variables
 */
export function validateClientEnv(env: unknown): ClientEnv {
  const result = clientEnvSchema.safeParse(env);
  if (!result.success) {
    console.warn('Client environment validation failed, using defaults:', result.error.message);
    return {
      NODE_ENV: 'development',
    };
  }
  return result.data;
}

/**
 * Get database prefix based on environment
 */
function getDbPrefix(env: ClientEnv): string {
  return env.NODE_ENV === 'test' ? 'eddo_test' : 'eddo';
}

/**
 * Sanitize username for database naming
 */
function sanitizeUsername(username: string): string {
  return username.toLowerCase().replace(/[^a-z0-9_]/g, '_');
}

/**
 * Get the user-specific database name for PouchDB
 * This should match the server-side pattern: {prefix}_user_{username}
 */
export function getUserDbName(username: string, env: ClientEnv): string {
  const prefix = getDbPrefix(env);
  const sanitizedUsername = sanitizeUsername(username);
  return `${prefix}_user_${sanitizedUsername}`;
}

/**
 * Get the user-specific attachments database name
 * Pattern: {prefix}_attachments_{username}
 */
export function getAttachmentsDbName(username: string, env: ClientEnv): string {
  const prefix = getDbPrefix(env);
  const sanitizedUsername = sanitizeUsername(username);
  return `${prefix}_attachments_${sanitizedUsername}`;
}
