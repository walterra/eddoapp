import { createEnv, createTestUserRegistry, createUserRegistry } from '@eddo/core-server';

/**
 * Authentication result for MCP server
 */
export interface MCPAuthResult {
  userId: string;
  dbName: string;
  username: string;
}

/**
 * Cached user validations to avoid repeated database queries
 */
const userValidationCache = new Map<
  string,
  { valid: boolean; user?: MCPAuthResult; timestamp: number }
>();
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

// Clear expired cache entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [_cacheKey, cache] of userValidationCache.entries()) {
    if (now - cache.timestamp > CACHE_TTL_MS) {
      userValidationCache.delete(_cacheKey);
    }
  }
}, 60 * 1000); // Clean up every minute

/**
 * Validate user context from MCP headers (for microservice-to-microservice communication)
 * This doesn't "authenticate" but validates that the user context is valid
 */
export async function validateUserContext(
  headers: Record<string, string | string[] | undefined>,
): Promise<MCPAuthResult> {
  // Extract authentication headers
  const username = extractHeader(headers, 'x-user-id');
  const databaseName = extractHeader(headers, 'x-database-name');
  const telegramId = extractHeader(headers, 'x-telegram-id');

  console.log('MCP Authentication attempt', {
    username,
    databaseName,
    hasTelegramId: !!telegramId,
  });

  if (!username) {
    throw new Response(null, {
      status: 401,
      statusText: 'Username required (X-User-ID header)',
    });
  }

  // Use username as cache key
  const cacheKey = `${username}:${telegramId || 'no_telegram'}`;
  const cached = userValidationCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    if (!cached.valid) {
      throw new Response(null, {
        status: 401,
        statusText: 'Invalid user (cached)',
      });
    }
    console.log('User authentication cache hit', {
      username: cached.user?.username,
    });
    return cached.user!;
  }

  try {
    // Initialize environment and user registry
    const env = createEnv();
    const userRegistry =
      env.NODE_ENV === 'test'
        ? await createTestUserRegistry(env.COUCHDB_URL, env)
        : createUserRegistry(env.COUCHDB_URL, env);

    // Look up user by username
    const user = await userRegistry.findByUsername(username);

    if (!user) {
      console.warn('User not found for username', { username });
      // Cache negative result
      userValidationCache.set(cacheKey, {
        valid: false,
        timestamp: Date.now(),
      });
      throw new Response(null, {
        status: 401,
        statusText: 'Invalid username',
      });
    }

    // Check if user is active
    if (user.status !== 'active') {
      console.warn('User found but not active', {
        username: user.username,
        status: user.status,
      });
      // Cache negative result
      userValidationCache.set(cacheKey, {
        valid: false,
        timestamp: Date.now(),
      });
      throw new Response(null, {
        status: 403,
        statusText: 'User account is not active',
      });
    }

    // Validate consistency if user provided additional headers
    if (databaseName && databaseName !== user.database_name) {
      console.warn('Database name mismatch in headers', {
        provided: databaseName,
        actual: user.database_name,
      });
      throw new Response(null, {
        status: 400,
        statusText: 'Database name mismatch in headers',
      });
    }

    if (telegramId && user.telegram_id && parseInt(telegramId) !== user.telegram_id) {
      console.warn('Telegram ID mismatch in headers', {
        provided: telegramId,
        actual: user.telegram_id,
      });
      throw new Response(null, {
        status: 400,
        statusText: 'Telegram ID mismatch in headers',
      });
    }

    console.log('User authentication successful', {
      username: user.username,
      userId: user._id,
      databaseName: user.database_name,
    });

    const authResult: MCPAuthResult = {
      userId: user._id,
      dbName: user.database_name,
      username: user.username,
    };

    // Cache the successful result
    userValidationCache.set(cacheKey, {
      valid: true,
      user: authResult,
      timestamp: Date.now(),
    });

    return authResult;
  } catch (error) {
    // If it's already a Response (our custom error), re-throw it
    if (error instanceof Response) {
      throw error;
    }

    console.error('Error during user authentication', {
      error: error instanceof Error ? error.message : String(error),
      username,
    });

    throw new Response(null, {
      status: 500,
      statusText: 'Authentication service error',
    });
  }
}

/**
 * Extract header value from headers object (handles both string and string[] types)
 */
function extractHeader(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string | undefined {
  const value = headers[name] || headers[name.toLowerCase()];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}
