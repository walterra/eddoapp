/**
 * Search Todos Tool - Full-text search using Elasticsearch ES|QL
 *
 * Design: ES is a secondary index for search/relevance scoring only.
 * Search returns IDs + scores, then fetches full docs from CouchDB (source of truth).
 */
import type { TodoAlpha3 } from '@eddo/core-server';
import type { Client } from '@elastic/elasticsearch';
import type nano from 'nano';
import { z } from 'zod';

import { createErrorResponse, createSuccessResponse } from './response-helpers.js';
import { buildEsqlQuery, parseSearchQuery, type ParsedQuery } from './search-query-utils.js';
import type { GetUserDb, ToolContext } from './types.js';

/** Tool description for LLM consumption */
export const searchTodosDescription = `Search todos using full-text search with Elasticsearch.
Supports query syntax: tag:value, context:value, completed:true/false, due:today/week/overdue.
Plain text is full-text searched on title and description.`;

/** Zod schema for searchTodos parameters */
export const searchTodosParameters = z.object({
  includeCompleted: z.boolean().default(true).describe('Include completed todos'),
  limit: z.number().default(20).describe('Maximum results (default: 20, max: 100)'),
  query: z.string().min(1).max(500).describe('Search query with optional syntax'),
});

export type SearchTodosArgs = z.infer<typeof searchTodosParameters>;

/** Search hit from ES (minimal - just ID and score) */
interface SearchHit {
  todoId: string;
  _score: number;
}

/** Search result with full todo data from CouchDB */
interface SearchResult {
  _score: number;
  todo: TodoAlpha3;
}

/** Transforms ES|QL response to search hits. */
function transformEsqlResponse(response: {
  columns: Array<{ name: string; type: string }>;
  values: unknown[][];
}): SearchHit[] {
  return response.values.map((row) => {
    const obj: Record<string, unknown> = {};
    response.columns.forEach((col, i) => {
      obj[col.name] = row[i];
    });
    return obj as unknown as SearchHit;
  });
}

/** Fetches full todo documents from CouchDB by IDs. */
async function fetchTodosFromCouchDb(
  db: nano.DocumentScope<TodoAlpha3>,
  hits: SearchHit[],
): Promise<SearchResult[]> {
  if (hits.length === 0) return [];

  const ids = hits.map((h) => h.todoId);
  const scoreMap = new Map(hits.map((h) => [h.todoId, h._score]));

  try {
    const response = await db.fetch({ keys: ids });

    const results: SearchResult[] = [];
    for (const row of response.rows) {
      if ('doc' in row && row.doc && !('error' in row)) {
        const todo = row.doc as TodoAlpha3;
        results.push({ _score: scoreMap.get(todo._id) ?? 0, todo });
      }
    }

    results.sort((a, b) => b._score - a._score);
    return results;
  } catch {
    return fetchTodosIndividually(db, hits);
  }
}

/** Fallback: fetches todos individually if bulk fails. */
async function fetchTodosIndividually(
  db: nano.DocumentScope<TodoAlpha3>,
  hits: SearchHit[],
): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  for (const hit of hits) {
    try {
      const todo = await db.get(hit.todoId);
      results.push({ _score: hit._score, todo });
    } catch {
      // Skip missing docs
    }
  }
  return results;
}

/** Validates search preconditions. */
function validateSearchContext(
  esClient: Client | null,
  userId: string | undefined,
): { error: string | null; username?: string } {
  if (!esClient) {
    return {
      error: createErrorResponse({
        error: new Error('Elasticsearch is not configured'),
        operation: 'search',
        recoverySuggestions: ['Use listTodos tool instead', 'Set ELASTICSEARCH_URL'],
        summary: 'Search unavailable',
      }),
    };
  }

  if (!userId) {
    return {
      error: createErrorResponse({
        error: new Error('No user session'),
        operation: 'search',
        recoverySuggestions: ['Ensure X-User-ID header is provided'],
        summary: 'Authentication required',
      }),
    };
  }

  return { error: null, username: userId.replace(/^user_/, '') };
}

/** Success response options */
interface SuccessResponseOptions {
  query: string;
  parsed: ParsedQuery;
  results: SearchResult[];
  indexName: string;
  times: { es: number; couch: number; total: number };
}

/** Builds success response with search results. */
function buildSuccessResponse(opts: SuccessResponseOptions): string {
  return createSuccessResponse({
    data: {
      parsed: opts.parsed,
      query: opts.query,
      results: opts.results.map((r) => ({ _score: r._score, ...r.todo })),
    },
    executionTime: opts.times.total,
    extra: {
      metadata: {
        couch_time: `${opts.times.couch.toFixed(2)}ms`,
        es_time: `${opts.times.es.toFixed(2)}ms`,
        execution_time: `${opts.times.total.toFixed(2)}ms`,
        index: opts.indexName,
        operation: 'search',
        timestamp: new Date().toISOString(),
      },
    },
    operation: 'search',
    summary: `Found ${opts.results.length} matching todos`,
  });
}

/** Execute handler for searchTodos tool. */
export async function executeSearchTodos(
  args: SearchTodosArgs,
  context: ToolContext,
  getEsClient: () => Client | null,
  getUserDb: GetUserDb,
): Promise<string> {
  const validation = validateSearchContext(getEsClient(), context.session?.userId);
  if (validation.error) return validation.error;

  const username = validation.username!;
  const indexName = `eddo_user_${username}`;
  const limit = Math.min(args.limit, 100);

  context.log.info('Searching todos', {
    limit,
    query: args.query,
    userId: context.session?.userId,
  });

  try {
    const startTime = Date.now();
    const parsed = parseSearchQuery(args.query);
    const esqlQuery = buildEsqlQuery(indexName, parsed, limit);

    context.log.debug('Executing ES|QL query', { esqlQuery, ...parsed });

    const esClient = getEsClient()!;
    const response = await esClient.esql.query({ format: 'json', query: esqlQuery });
    const esTime = Date.now() - startTime;

    const hits = transformEsqlResponse(
      response as { columns: Array<{ name: string; type: string }>; values: unknown[][] },
    );
    const db = getUserDb(context);
    const couchStartTime = Date.now();
    const results = await fetchTodosFromCouchDb(db, hits);
    const couchTime = Date.now() - couchStartTime;

    context.log.info('Search completed', { hitsCount: hits.length, resultsCount: results.length });

    return buildSuccessResponse({
      indexName,
      parsed,
      query: args.query,
      results,
      times: { couch: couchTime, es: esTime, total: Date.now() - startTime },
    });
  } catch (error) {
    return handleSearchError(error, args.query, context);
  }
}

/** Handles search errors and returns appropriate response. */
function handleSearchError(error: unknown, query: string, context: ToolContext): string {
  const message = error instanceof Error ? error.message : 'Unknown error';
  context.log.error('Search failed', { error: message, query });

  if (message.includes('index_not_found') || message.includes('no such index')) {
    return createSuccessResponse({
      data: { query, results: [] },
      executionTime: 0,
      operation: 'search',
      summary: 'No search index found - no todos have been synced yet',
    });
  }

  return createErrorResponse({
    error,
    operation: 'search',
    recoverySuggestions: [
      'Check if Elasticsearch is running',
      'Verify the search query syntax',
      'Use listTodos tool as fallback',
    ],
    summary: 'Search failed',
  });
}
