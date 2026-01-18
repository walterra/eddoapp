/**
 * Search API routes using ES|QL.
 * Provides full-text search across todos and audit logs.
 *
 * Endpoints:
 * - POST /api/search/todos - Search todos with ES|QL (supports query syntax)
 * - POST /api/search/audit - Search audit logs with ES|QL
 * - GET /api/search/suggest - Autocomplete suggestions
 * - GET /api/search/help - Query syntax help
 * - GET /api/search/stats - Index statistics
 *
 * Query syntax (parsed server-side):
 * - tag:value - Filter by tag
 * - context:value - Filter by context
 * - completed:true/false - Filter by completion status
 * - due:today/week/overdue - Filter by due date
 * - Remaining text is full-text searched
 */

import { Hono } from 'hono';

import { createElasticsearchClientFromEnv } from '../elasticsearch';
import { logger, withSpan } from '../utils/logger';
import { handleAuditSearch, handleSuggest, handleTodoSearch } from './search-handlers';
import { getQuerySyntaxHelp } from './search-query-parser';
import { extractUserFromToken } from './users-helpers';

const searchApp = new Hono();

// Lazy-initialize ES client (only when search is used)
let esClient: ReturnType<typeof createElasticsearchClientFromEnv> | null = null;

function getEsClient() {
  if (!esClient) {
    esClient = createElasticsearchClientFromEnv();
  }
  return esClient;
}

/**
 * POST /api/search/todos
 * Full-text search across todos using ES|QL MATCH().
 */
searchApp.post('/todos', (c) => handleTodoSearch(c, getEsClient()));

/**
 * POST /api/search/audit
 * Search audit logs with filtering by action, source, date range.
 */
searchApp.post('/audit', (c) => handleAuditSearch(c, getEsClient()));

/**
 * GET /api/search/suggest
 * Autocomplete suggestions for titles, contexts, or tags.
 */
searchApp.get('/suggest', (c) => handleSuggest(c, getEsClient()));

/**
 * GET /api/search/stats
 * Get search index statistics for the current user.
 */
searchApp.get('/stats', async (c) => {
  return withSpan('search_stats', { 'search.type': 'stats' }, async (span) => {
    const userToken = await extractUserFromToken(c.req.header('Authorization'));
    if (!userToken) return c.json({ error: 'Authentication required' }, 401);

    const username = userToken.username;
    span.setAttribute('user.name', username);

    try {
      const client = getEsClient();

      const todoIndex = `eddo_user_${username}`;
      const auditIndex = `eddo_audit_${username}`;

      const [todoCount, auditCount] = await Promise.all([
        client.count({ index: todoIndex }).catch(() => ({ count: 0 })),
        client.count({ index: auditIndex }).catch(() => ({ count: 0 })),
      ]);

      return c.json({
        indices: {
          audit: { documentCount: auditCount.count, index: auditIndex },
          todos: { documentCount: todoCount.count, index: todoIndex },
        },
        username,
      });
    } catch (error) {
      logger.error({ error }, 'Stats query failed');
      return c.json({ error: 'Stats failed' }, 500);
    }
  });
});

/**
 * GET /api/search/help
 * Returns query syntax help text.
 */
searchApp.get('/help', (c) => {
  return c.json({
    examples: [
      { description: 'Todos tagged gtd:next containing "meeting"', query: 'tag:gtd:next meeting' },
      { description: 'Elastic context todos containing "bug"', query: 'context:elastic bug' },
      { description: 'Pending todos containing "urgent"', query: 'completed:false urgent' },
      { description: 'Overdue todos', query: 'due:overdue' },
      { description: 'Todos due today', query: 'due:today' },
      { description: 'Todos with github OR review tag', query: 'tag:github tag:review' },
    ],
    help: getQuerySyntaxHelp(),
  });
});

export const searchRoutes = searchApp;
