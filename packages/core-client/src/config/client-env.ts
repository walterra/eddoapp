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

  // Web Client Configuration (Vite environment variables)
  VITE_COUCHDB_API_KEY: z.string().optional(),
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
      VITE_COUCHDB_API_KEY: undefined,
    };
  }
  return result.data;
}

/**
 * Get the effective database name (with API key suffix if provided)
 * Client-side version that only uses VITE_COUCHDB_API_KEY
 */
export function getClientDbName(env: ClientEnv): string {
  const baseName = 'todos-dev'; // Hardcoded for client since server handles DB routing
  const apiKey = env.VITE_COUCHDB_API_KEY;
  return apiKey ? `${baseName}_api_${apiKey}` : baseName;
}
