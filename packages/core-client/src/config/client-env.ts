import { createFieldNormalizer } from '@eddo/core-shared/validation/field_normalization';
import { createSchemaParser, obj, oneOf } from '@eddo/core-shared/validation/schema_parser';

/**
 * Client-side environment configuration schema
 * Only includes variables that should be exposed to the browser
 */
const clientEnvDefinition = obj({ NODE_ENV: oneOf(['development', 'production', 'test']) });
export const clientEnvSchema = createSchemaParser(clientEnvDefinition, {
  normalize: createFieldNormalizer({ fields: ['NODE_ENV'], defaults: { NODE_ENV: 'development' } }),
});

/**
 * Type definition for client-side environment configuration
 */
export type ClientEnv = ReturnType<typeof clientEnvSchema.parse>;

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
