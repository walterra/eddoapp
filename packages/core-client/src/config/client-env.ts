import { z } from 'zod';

/**
 * Client-side environment configuration schema
 * Only includes variables that should be exposed to the browser
 */
export const clientEnvSchema = z.object({
  // Node environment
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
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
    console.warn(
      'Client environment validation failed, using defaults:',
      result.error.message,
    );
    return {
      NODE_ENV: 'development',
    };
  }
  return result.data;
}

/**
 * Get the user-specific database name for PouchDB
 * This should match the server-side pattern: {prefix}_user_{username}
 */
export function getUserDbName(username: string, env: ClientEnv): string {
  // For now, use 'eddo' as the default prefix to match server behavior
  // In the future, this could be configurable via environment
  const prefix = env.NODE_ENV === 'test' ? 'eddo_test' : 'eddo';
  // Sanitize username to match server-side sanitization
  const sanitizedUsername = username.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  return `${prefix}_user_${sanitizedUsername}`;
}
