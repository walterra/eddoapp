import { Hono } from 'hono';

import {
  getUserDatabaseContext,
  proxyUserCouchDBRequest,
  userDatabaseMiddleware,
} from '../middleware/user-db';

const dbProxyApp = new Hono();

// Add user database middleware to all routes
dbProxyApp.use('/*', userDatabaseMiddleware);

// Proxy all database requests to user-specific databases
dbProxyApp.all('/*', async (c) => {
  const path = c.req.path.replace('/api/db', '');
  const method = c.req.method;

  // Preserve query string
  const url = new URL(c.req.url);
  const queryString = url.search; // includes the '?' prefix
  const fullPath = `${path}${queryString}`;

  // Get request body for non-GET requests
  let body: string | undefined;
  if (method !== 'GET' && method !== 'HEAD') {
    body = await c.req.text();
  }

  // Get relevant headers
  const headers: Record<string, string> = {};
  const contentType = c.req.header('Content-Type');
  if (contentType) {
    headers['Content-Type'] = contentType;
  }

  // Get user database context from middleware
  const userDbContext = getUserDatabaseContext(c);

  // Route to user-specific database
  const response = await proxyUserCouchDBRequest(userDbContext, method, fullPath, body, headers);
  return response;
});

export { dbProxyApp as dbProxyRoutes };
