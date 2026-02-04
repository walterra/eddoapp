import { createEnv, createTestUserRegistry, createUserRegistry } from '@eddo/core-server';
import {
  createAuthError,
  createCacheKey,
  createNegativeCacheEntry,
  createPositiveCacheEntry,
  extractHeader,
  isCacheValid,
  logAuthError,
  logAuthSuccess,
  logHeaderMismatch,
  logUserInactive,
  logUserNotFound,
  type ValidationCacheEntry,
} from './user-auth-helpers.js';

/**
 * Authentication result for MCP server
 */
export interface MCPAuthResult {
  userId: string;
  dbName: string;
  username: string;
}

const userValidationCache = new Map<string, ValidationCacheEntry>();
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

// Clear expired cache entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [cacheKey, cache] of userValidationCache.entries()) {
    if (now - cache.timestamp > CACHE_TTL_MS) {
      userValidationCache.delete(cacheKey);
    }
  }
}, 60 * 1000);

/**
 * Check cached validation result
 */
function checkCache(cacheKey: string): { hit: boolean; result?: MCPAuthResult } {
  const cached = userValidationCache.get(cacheKey);
  if (!isCacheValid(cached, CACHE_TTL_MS)) {
    return { hit: false };
  }

  if (!cached!.valid) {
    throw createAuthError(401, 'Invalid user (cached)');
  }

  console.log('User authentication cache hit', { username: cached!.user?.username });
  return { hit: true, result: cached!.user };
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
async function lookupAndValidateUserByApiKey(
  apiKey: string,
  cacheKey: string,
): Promise<UserAuthRecord> {
  const env = createEnv();
  const userRegistry = await getUserRegistry(env);
  const user = await userRegistry.findByMcpApiKey(apiKey);

  if (!user) {
    logUserNotFound(maskApiKey(apiKey), 'apiKey');
    userValidationCache.set(cacheKey, createNegativeCacheEntry());
    throw createAuthError(401, 'Invalid API key');
  }

  if (user.status !== 'active') {
    logUserInactive(user.username, user.status);
    userValidationCache.set(cacheKey, createNegativeCacheEntry());
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

  const cacheKey = createCacheKey(apiKey, telegramId, databaseName);
  const cacheResult = checkCache(cacheKey);
  if (cacheResult.hit) return cacheResult.result!;

  try {
    const user = await lookupAndValidateUserByApiKey(apiKey, cacheKey);
    validateHeaderConsistency(user, databaseName, telegramId);
    validateApiKey(user.preferences, apiKey);

    const authResult: MCPAuthResult = {
      userId: user._id,
      dbName: user.database_name,
      username: user.username,
    };

    logAuthSuccess(authResult);
    userValidationCache.set(cacheKey, createPositiveCacheEntry(authResult));
    return authResult;
  } catch (error) {
    if (error instanceof Response) throw error;
    logAuthError(error, maskApiKey(apiKey), 'apiKey');
    throw createAuthError(500, 'Authentication service error');
  }
}

export { extractHeader };
