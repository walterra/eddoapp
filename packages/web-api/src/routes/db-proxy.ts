import { Hono } from 'hono';

import {
  getUserDatabaseContext,
  proxyUserCouchDBRequest,
  userDatabaseMiddleware,
} from '../middleware/user-db';
import { withSpan } from '../utils/logger';

const dbProxyApp = new Hono();

// Add user database middleware to all routes
dbProxyApp.use('/*', userDatabaseMiddleware);

/** Path patterns for CouchDB operations */
const OPERATION_PATTERNS: Array<[string, string]> = [
  ['_changes', 'sync_changes'],
  ['_bulk_docs', 'sync_bulk_write'],
  ['_bulk_get', 'sync_bulk_read'],
  ['_all_docs', 'sync_all_docs'],
  ['_local/', 'sync_checkpoint'],
  ['_design/', 'sync_view'],
  ['_find', 'sync_query'],
];

/** Method-based operations for regular documents */
const METHOD_OPERATIONS: Record<string, string> = {
  GET: 'sync_doc_read',
  PUT: 'sync_doc_write',
  POST: 'sync_doc_write',
  DELETE: 'sync_doc_delete',
};

/** Categorize CouchDB operation by path and method */
function categorizeOperation(method: string, path: string): string {
  const matchedPattern = OPERATION_PATTERNS.find(([pattern]) => path.includes(pattern));
  if (matchedPattern) return matchedPattern[1];
  return METHOD_OPERATIONS[method] ?? 'sync_request';
}

// Proxy all database requests to user-specific databases
dbProxyApp.all('/*', async (c) => {
  const path = c.req.path.replace('/api/db', '');
  const method = c.req.method;

  // Preserve query string
  const url = new URL(c.req.url);
  const queryString = url.search;
  const fullPath = `${path}${queryString}`;

  const operation = categorizeOperation(method, path);

  return withSpan(
    `couchdb_${operation}`,
    {
      'db.system': 'couchdb',
      'db.operation': operation,
      'http.method': method,
      'db.statement': path.split('?')[0], // Path without query params
    },
    async (span) => {
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
      span.setAttribute('db.name', userDbContext.userDatabaseName);
      span.setAttribute('user.name', userDbContext.username);

      // Route to user-specific database
      const response = await proxyUserCouchDBRequest(userDbContext, {
        method,
        path: fullPath,
        body,
        headers,
      });

      span.setAttribute('http.status_code', response.status);

      return response;
    },
  );
});

export { dbProxyApp as dbProxyRoutes };
