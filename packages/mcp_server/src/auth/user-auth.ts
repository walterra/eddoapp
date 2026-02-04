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
function validateApiKey(
  preferences: UserAuthRecord['preferences'],
  apiKey: string | undefined,
): void {
  if (!preferences?.mcpApiKey) {
    throw createAuthError(403, 'MCP API key not configured for user');
  }

  if (!apiKey) {
    throw createAuthError(401, 'API key required (X-API-Key header)');
  }

  if (apiKey !== preferences.mcpApiKey) {
    throw createAuthError(401, 'Invalid API key');
  }
}

/** Extract and validate headers, throw if username missing */
function extractAuthHeaders(headers: Record<string, string | string[] | undefined>): {
  username: string;
  databaseName: string | undefined;
  telegramId: string | undefined;
  apiKey: string | undefined;
} {
  const username = extractHeader(headers, 'x-user-id');
  const databaseName = extractHeader(headers, 'x-database-name');
  const telegramId = extractHeader(headers, 'x-telegram-id');
  const apiKey = extractHeader(headers, 'x-api-key');

  console.log('MCP Authentication attempt', {
    username,
    databaseName,
    hasTelegramId: !!telegramId,
    hasApiKey: !!apiKey,
  });

  if (!username) {
    throw createAuthError(401, 'Username required (X-User-ID header)');
  }

  return { username, databaseName, telegramId, apiKey };
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

/** Lookup user and validate status */
async function lookupAndValidateUser(username: string, cacheKey: string): Promise<UserAuthRecord> {
  const env = createEnv();
  const userRegistry = await getUserRegistry(env);
  const user = await userRegistry.findByUsername(username);

  if (!user) {
    logUserNotFound(username);
    userValidationCache.set(cacheKey, createNegativeCacheEntry());
    throw createAuthError(401, 'Invalid username');
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
  const { username, databaseName, telegramId, apiKey } = extractAuthHeaders(headers);

  const cacheKey = createCacheKey(username, telegramId, apiKey);
  const cacheResult = checkCache(cacheKey);
  if (cacheResult.hit) return cacheResult.result!;

  try {
    const user = await lookupAndValidateUser(username, cacheKey);
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
    logAuthError(error, username);
    throw createAuthError(500, 'Authentication service error');
  }
}

export { extractHeader };
