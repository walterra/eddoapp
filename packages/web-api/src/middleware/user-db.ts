import { createEnv, createUserRegistry, getUserDatabaseName } from '@eddo/core-server';
import { createMiddleware } from 'hono/factory';
import jwt from 'jsonwebtoken';

import { config } from '../config';
import { logger } from '../utils/logger';

interface JwtTokenPayload {
  userId: string;
  username: string;
  exp: number;
}

interface UserDatabaseContext {
  userId: string;
  username: string;
  userDatabaseName: string;
  userDatabaseUrl: string;
  attachmentsDatabaseName: string;
  attachmentsDatabaseUrl: string;
}

declare module 'hono' {
  interface ContextVariableMap {
    userDb: UserDatabaseContext;
  }
}

/**
 * Middleware to extract user context from JWT token and provide user-specific database information
 * This middleware should be used after JWT authentication middleware
 */
export const userDatabaseMiddleware = createMiddleware(async (c, next) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const token = authHeader.substring(7);

  try {
    // Verify JWT token
    const decoded = jwt.verify(token, config.jwtSecret) as JwtTokenPayload;

    // Initialize environment and user registry
    const env = createEnv();
    const userRegistry = createUserRegistry(env.COUCHDB_URL, env);

    // Get user from registry
    const user = await userRegistry.findByUsername(decoded.username);
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    if (user.status !== 'active') {
      return c.json({ error: 'Account is suspended' }, 403);
    }

    // Create user database context
    const userDatabaseName = getUserDatabaseName(env, decoded.username);
    // Attachments database name follows pattern: eddo_attachments_{username}
    const attachmentsDatabaseName = userDatabaseName.replace('_user_', '_attachments_');
    // Use helper to get base URL without credentials for fetch API compatibility
    const userDatabaseUrl = `${config.getCouchDbBaseUrl()}${userDatabaseName}`;
    const attachmentsDatabaseUrl = `${config.getCouchDbBaseUrl()}${attachmentsDatabaseName}`;

    const userDbContext: UserDatabaseContext = {
      userId: decoded.userId,
      username: decoded.username,
      userDatabaseName,
      userDatabaseUrl,
      attachmentsDatabaseName,
      attachmentsDatabaseUrl,
    };

    // Set user database context in Hono context
    c.set('userDb', userDbContext);

    await next();
  } catch (error) {
    logger.error({ error }, 'User database middleware error');
    return c.json({ error: 'Invalid token' }, 401);
  }
});

/**
 * Helper function to get user database context from Hono context
 */
export function getUserDatabaseContext(c: {
  get: (key: string) => UserDatabaseContext;
}): UserDatabaseContext {
  return c.get('userDb');
}

interface ProxyRequestOptions {
  method: string;
  path: string;
  body?: string;
  headers?: Record<string, string>;
}

/** Common proxy logic for CouchDB requests */
async function proxyCouchDBRequest(
  baseUrl: string,
  options: ProxyRequestOptions,
): Promise<Response> {
  const { method, path, body, headers } = options;
  const cleanPath = path.startsWith('/') ? path.substring(1) : path;
  const couchdbUrl = `${baseUrl}/${cleanPath}`;

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  const authHeader = config.getCouchDbAuthHeader();
  if (authHeader) {
    requestHeaders['Authorization'] = authHeader;
  }

  try {
    const response = await fetch(couchdbUrl, {
      method,
      headers: requestHeaders,
      body: method !== 'GET' && method !== 'HEAD' ? body : undefined,
    });

    const responseBody = await response.text();
    const filteredHeaders = new Headers();
    response.headers.forEach((value, key) => {
      if (
        !key.toLowerCase().includes('authorization') &&
        !key.toLowerCase().includes('cookie') &&
        !key.toLowerCase().includes('set-cookie')
      ) {
        filteredHeaders.set(key, value);
      }
    });

    return new Response(responseBody, {
      status: response.status,
      statusText: response.statusText,
      headers: filteredHeaders,
    });
  } catch (error) {
    logger.error({ error }, 'CouchDB proxy error');
    return new Response(JSON.stringify({ error: 'Database connection failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Helper function to proxy requests to user-specific CouchDB database
 */
export async function proxyUserCouchDBRequest(
  userDbContext: UserDatabaseContext,
  options: ProxyRequestOptions,
): Promise<Response> {
  return proxyCouchDBRequest(userDbContext.userDatabaseUrl, options);
}

/**
 * Helper function to proxy requests to user-specific attachments database
 */
export async function proxyAttachmentsCouchDBRequest(
  userDbContext: UserDatabaseContext,
  options: ProxyRequestOptions,
): Promise<Response> {
  return proxyCouchDBRequest(userDbContext.attachmentsDatabaseUrl, options);
}
