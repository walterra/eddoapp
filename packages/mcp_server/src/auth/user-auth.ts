import { createEnv, createTestUserRegistry, createUserRegistry } from '@eddo/core-server';
import {
  createAuthError,
  extractHeader,
  logAuthError,
  logAuthSuccess,
  logHeaderMismatch,
  logUserInactive,
  logUserNotFound,
} from './user-auth-helpers.js';

/**
 * Authentication result for MCP server
 */
export interface MCPAuthResult {
  userId: string;
  dbName: string;
  username: string;
  timezone?: string;
}

/**
 * Get user registry based on environment
 */
async function getUserRegistry(env: ReturnType<typeof createEnv>) {
  return env.NODE_ENV === 'test'
    ? await createTestUserRegistry(env.COUCHDB_URL, env)
    : createUserRegistry(env.COUCHDB_URL, env);
}

/**
 * Validate header consistency with user data
 */
function validateHeaderConsistency(
  user: { database_name: string; telegram_id?: number },
  databaseName: string | undefined,
  telegramId: string | undefined,
): void {
  if (databaseName && databaseName !== user.database_name) {
    logHeaderMismatch('Database name', databaseName, user.database_name);
    throw createAuthError(400, 'Database name mismatch in headers');
  }

  if (telegramId && user.telegram_id && parseInt(telegramId) !== user.telegram_id) {
    logHeaderMismatch('Telegram ID', telegramId, user.telegram_id);
    throw createAuthError(400, 'Telegram ID mismatch in headers');
  }
}

/** Validate API key against stored preference */
function validateApiKey(preferences: UserAuthRecord['preferences'], apiKey: string): void {
  if (!preferences?.mcpApiKey) {
    throw createAuthError(403, 'MCP API key not configured for user');
  }

  if (apiKey !== preferences.mcpApiKey) {
    throw createAuthError(401, 'Invalid API key');
  }
}

/** Extract and validate headers, throw if API key missing */
function extractAuthHeaders(headers: Record<string, string | string[] | undefined>): {
  apiKey: string;
  databaseName: string | undefined;
  telegramId: string | undefined;
} {
  const databaseName = extractHeader(headers, 'X-Database-Name');
  const telegramId = extractHeader(headers, 'X-Telegram-ID');
  const apiKeyHeader = extractHeader(headers, 'X-API-Key');
  const authHeader = extractHeader(headers, 'Authorization');
  const bearerToken = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1];
  const apiKey = apiKeyHeader || bearerToken;

  console.log('MCP Authentication attempt', {
    databaseName,
    hasTelegramId: !!telegramId,
    hasApiKey: !!apiKey,
  });

  if (!apiKey) {
    throw createAuthError(401, 'API key required (Authorization or X-API-Key header)');
  }

  return { apiKey, databaseName, telegramId };
}

/** User record fields needed for MCP auth */
interface UserAuthRecord {
  _id: string;
  database_name: string;
  username: string;
  telegram_id?: number;
  preferences?: {
    mcpApiKey?: string | null;
    timezone?: string;
  };
}

/** Mask API key for logs */
function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 8) {
    return '***';
  }
  return `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
}

/** Lookup user and validate status */
async function lookupAndValidateUserByApiKey(apiKey: string): Promise<UserAuthRecord> {
  const env = createEnv();
  const userRegistry = await getUserRegistry(env);
  const user = await userRegistry.findByMcpApiKey(apiKey);

  if (!user) {
    logUserNotFound(maskApiKey(apiKey), 'apiKey');
    throw createAuthError(401, 'Invalid API key');
  }

  if (user.status !== 'active') {
    logUserInactive(user.username, user.status);
    throw createAuthError(403, 'User account is not active');
  }

  return user;
}

/**
 * Validate user context from MCP headers (for microservice-to-microservice communication)
 */
export async function validateUserContext(
  headers: Record<string, string | string[] | undefined>,
): Promise<MCPAuthResult> {
  const { apiKey, databaseName, telegramId } = extractAuthHeaders(headers);

  try {
    const user = await lookupAndValidateUserByApiKey(apiKey);
    validateHeaderConsistency(user, databaseName, telegramId);
    validateApiKey(user.preferences, apiKey);

    const authResult: MCPAuthResult = {
      userId: user._id,
      dbName: user.database_name,
      username: user.username,
      timezone: user.preferences?.timezone,
    };

    logAuthSuccess(authResult);
    return authResult;
  } catch (error) {
    if (error instanceof Response) throw error;
    logAuthError(error, maskApiKey(apiKey), 'apiKey');
    throw createAuthError(500, 'Authentication service error');
  }
}

export { extractHeader };
