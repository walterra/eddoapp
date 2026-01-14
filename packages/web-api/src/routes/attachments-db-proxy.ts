/**
 * Proxy routes for user-specific attachments database
 * Mirrors the db-proxy.ts but routes to eddo_attachments_{username}
 */
import { Hono } from 'hono';

import {
  getUserDatabaseContext,
  proxyAttachmentsCouchDBRequest,
  userDatabaseMiddleware,
} from '../middleware/user-db';
import { withSpan } from '../utils/logger';

const attachmentsDbProxyApp = new Hono();

// Add user database middleware to all routes
attachmentsDbProxyApp.use('/*', userDatabaseMiddleware);

/** Path patterns for CouchDB operations */
const OPERATION_PATTERNS: Array<[string, string]> = [
  ['_changes', 'attachments_sync_changes'],
  ['_bulk_docs', 'attachments_sync_bulk_write'],
  ['_bulk_get', 'attachments_sync_bulk_read'],
  ['_all_docs', 'attachments_sync_all_docs'],
  ['_local/', 'attachments_sync_checkpoint'],
];

/** Method-based operations for regular documents */
const METHOD_OPERATIONS: Record<string, string> = {
  GET: 'attachments_sync_doc_read',
  PUT: 'attachments_sync_doc_write',
  POST: 'attachments_sync_doc_write',
  DELETE: 'attachments_sync_doc_delete',
};

/** Categorize CouchDB operation by path and method */
function categorizeOperation(method: string, path: string): string {
  const matchedPattern = OPERATION_PATTERNS.find(([pattern]) => path.includes(pattern));
  if (matchedPattern) return matchedPattern[1];
  return METHOD_OPERATIONS[method] ?? 'attachments_sync_request';
}

// Proxy all database requests to user-specific attachments databases
attachmentsDbProxyApp.all('/*', async (c) => {
  const path = c.req.path.replace('/api/attachments-db', '');
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
      'db.statement': path.split('?')[0],
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
      span.setAttribute('db.name', userDbContext.attachmentsDatabaseName);
      span.setAttribute('user.name', userDbContext.username);

      // Route to user-specific attachments database
      const response = await proxyAttachmentsCouchDBRequest(userDbContext, {
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

export { attachmentsDbProxyApp as attachmentsDbProxyRoutes };
