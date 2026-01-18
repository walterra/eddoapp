/**
 * Search route handlers for ES|QL search operations.
 */

import type { Context as HonoContext } from 'hono';
import { z } from 'zod';

import type { Client } from '@elastic/elasticsearch';

import { logger, withSpan } from '../utils/logger';
import { generateWhereConditions, parseSearchQuery } from './search-query-parser';
import { extractUserFromToken } from './users-helpers';

/** Escapes special characters in ES|QL string literals. */
export function escapeEsqlString(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/** Transforms ES|QL response to array of objects. */
function transformEsqlResponse(response: {
  columns: Array<{ name: string; type: string }>;
  values: unknown[][];
}): Record<string, unknown>[] {
  const { columns, values } = response;
  return values.map((row) => {
    const obj: Record<string, unknown> = {};
    columns.forEach((col, i) => {
      obj[col.name] = row[i];
    });
    return obj;
  });
}

/** Adds additional conditions from API params. */
function addApiParamConditions(
  conditions: string[],
  params: { context?: string; tags?: string[]; includeCompleted: boolean },
  parsed: { context: string | null; completed: boolean | null; tags: string[] },
): void {
  if (!params.includeCompleted && parsed.completed === null) {
    conditions.push('completed IS NULL');
  }

  if (params.context && !parsed.context) {
    conditions.push(`context == "${escapeEsqlString(params.context)}"`);
  }

  if (params.tags && params.tags.length > 0) {
    const additionalTags = params.tags.filter((t) => !parsed.tags.includes(t));
    if (additionalTags.length > 0) {
      const tagConditions = additionalTags
        .map((tag) => `tags : "${escapeEsqlString(tag)}"`)
        .join(' OR ');
      conditions.push(`(${tagConditions})`);
    }
  }
}

/** Request schema for searching todos. */
export const searchTodosSchema = z.object({
  context: z.string().optional(),
  includeCompleted: z.boolean().default(true),
  limit: z.number().int().min(1).max(100).default(20),
  query: z.string().min(1).max(500),
  tags: z.array(z.string()).optional(),
});

/** Handles todo search requests. */
export async function handleTodoSearch(c: HonoContext, esClient: Client): Promise<Response> {
  return withSpan('search_todos', { 'search.type': 'todos' }, async (span) => {
    const userToken = await extractUserFromToken(c.req.header('Authorization'));
    if (!userToken) return c.json({ error: 'Authentication required' }, 401);

    const username = userToken.username;
    span.setAttribute('user.name', username);

    try {
      const body = await c.req.json();
      const params = searchTodosSchema.parse(body);

      span.setAttribute('search.limit', params.limit);
      span.setAttribute('search.query', params.query);

      const indexName = `eddo_user_${username}`;
      const parsed = parseSearchQuery(params.query);
      const conditions = generateWhereConditions(parsed, escapeEsqlString);

      addApiParamConditions(conditions, params, parsed);

      const esqlQuery = buildTodoQuery(indexName, conditions, parsed, params.limit);
      logger.debug({ esqlQuery, parsed, username }, 'Executing todo search');

      const response = await esClient.esql.query({ format: 'json', query: esqlQuery });
      const results = transformEsqlResponse(
        response as { columns: Array<{ name: string; type: string }>; values: unknown[][] },
      );

      span.setAttribute('search.results_count', results.length);

      return c.json({ query: params.query, results, total: results.length });
    } catch (error) {
      return handleSearchError(c, error, span, 'Todo search failed');
    }
  });
}

/** Builds ES|QL query for todo search. */
function buildTodoQuery(
  indexName: string,
  conditions: string[],
  parsed: { searchText: string },
  limit: number,
): string {
  let query = `FROM ${indexName} METADATA _score`;

  if (conditions.length > 0) {
    query += ` | WHERE ${conditions.join(' AND ')}`;
  }

  query += parsed.searchText.length > 0 ? ` | SORT _score DESC, due ASC` : ` | SORT due ASC`;
  query += ` | LIMIT ${limit}`;
  query += ` | KEEP todoId, title, description, context, tags, due, completed, _score`;

  return query;
}

/** Request schema for searching audit logs. */
export const searchAuditSchema = z.object({
  action: z
    .enum([
      'create',
      'update',
      'delete',
      'complete',
      'uncomplete',
      'time_tracking_start',
      'time_tracking_stop',
    ])
    .optional(),
  entityId: z.string().optional(),
  fromDate: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(50),
  query: z.string().optional(),
  source: z.enum(['web', 'mcp', 'telegram', 'github-sync', 'rss-sync', 'email-sync']).optional(),
  toDate: z.string().optional(),
});

/** Handles audit search requests. */
export async function handleAuditSearch(c: HonoContext, esClient: Client): Promise<Response> {
  return withSpan('search_audit', { 'search.type': 'audit' }, async (span) => {
    const userToken = await extractUserFromToken(c.req.header('Authorization'));
    if (!userToken) return c.json({ error: 'Authentication required' }, 401);

    const username = userToken.username;
    span.setAttribute('user.name', username);

    try {
      const body = await c.req.json();
      const params = searchAuditSchema.parse(body);

      span.setAttribute('search.limit', params.limit);
      if (params.action) span.setAttribute('search.action', params.action);
      if (params.source) span.setAttribute('search.source', params.source);

      const indexName = `eddo_audit_${username}`;
      const esqlQuery = buildAuditQuery(indexName, params);

      logger.debug({ esqlQuery, username }, 'Executing audit search');

      const response = await esClient.esql.query({ format: 'json', query: esqlQuery });
      const results = transformEsqlResponse(
        response as { columns: Array<{ name: string; type: string }>; values: unknown[][] },
      );

      span.setAttribute('search.results_count', results.length);

      return c.json({ results, total: results.length });
    } catch (error) {
      return handleSearchError(c, error, span, 'Audit search failed');
    }
  });
}

/** Builds ES|QL query for audit search. */
function buildAuditQuery(indexName: string, params: z.infer<typeof searchAuditSchema>): string {
  const conditions: string[] = [];

  if (params.query) {
    conditions.push(`MATCH(after, "${escapeEsqlString(params.query)}")`);
  }
  if (params.action) {
    conditions.push(`action == "${params.action}"`);
  }
  if (params.source) {
    conditions.push(`source == "${params.source}"`);
  }
  if (params.entityId) {
    conditions.push(`entityId == "${escapeEsqlString(params.entityId)}"`);
  }
  if (params.fromDate) {
    conditions.push(`timestamp >= "${params.fromDate}"`);
  }
  if (params.toDate) {
    conditions.push(`timestamp <= "${params.toDate}"`);
  }

  let query = `FROM ${indexName}`;
  if (conditions.length > 0) {
    query += ` | WHERE ${conditions.join(' AND ')}`;
  }

  query += ` | SORT timestamp DESC`;
  query += ` | LIMIT ${params.limit}`;
  query += ` | KEEP auditId, timestamp, action, entityType, entityId, source`;

  return query;
}

/** Request schema for suggestions. */
export const suggestSchema = z.object({
  field: z.enum(['title', 'context', 'tags']).default('title'),
  limit: z.number().int().min(1).max(20).default(10),
  prefix: z.string().min(1).max(100),
});

/** Handles suggest requests. */
export async function handleSuggest(c: HonoContext, esClient: Client): Promise<Response> {
  return withSpan('search_suggest', { 'search.type': 'suggest' }, async (span) => {
    const userToken = await extractUserFromToken(c.req.header('Authorization'));
    if (!userToken) return c.json({ error: 'Authentication required' }, 401);

    const username = userToken.username;
    span.setAttribute('user.name', username);

    try {
      const params = suggestSchema.parse({
        field: c.req.query('field') ?? 'title',
        limit: parseInt(c.req.query('limit') ?? '10', 10),
        prefix: c.req.query('prefix') ?? '',
      });

      span.setAttribute('search.field', params.field);
      span.setAttribute('search.prefix', params.prefix);

      const indexName = `eddo_user_${username}`;
      const esqlQuery = buildSuggestQuery(indexName, params);

      logger.debug({ esqlQuery, username }, 'Executing suggest query');

      const response = await esClient.esql.query({ format: 'json', query: esqlQuery });
      const suggestions = transformEsqlResponse(
        response as { columns: Array<{ name: string; type: string }>; values: unknown[][] },
      );

      span.setAttribute('search.suggestions_count', suggestions.length);

      return c.json({ field: params.field, prefix: params.prefix, suggestions });
    } catch (error) {
      return handleSearchError(c, error, span, 'Suggest query failed');
    }
  });
}

/** Builds ES|QL query for suggestions. */
function buildSuggestQuery(indexName: string, params: z.infer<typeof suggestSchema>): string {
  const escapedPrefix = escapeEsqlString(params.prefix.toLowerCase());

  if (params.field === 'tags') {
    return `FROM ${indexName}
      | WHERE tags IS NOT NULL
      | STATS count = COUNT(*) BY tag = tags
      | WHERE TO_LOWER(tag) LIKE "${escapedPrefix}*"
      | SORT count DESC
      | LIMIT ${params.limit}
      | KEEP tag, count`;
  }

  if (params.field === 'context') {
    return `FROM ${indexName}
      | WHERE TO_LOWER(context) LIKE "${escapedPrefix}*"
      | STATS count = COUNT(*) BY context
      | SORT count DESC
      | LIMIT ${params.limit}
      | KEEP context, count`;
  }

  return `FROM ${indexName}
    | WHERE TO_LOWER(title) LIKE "*${escapedPrefix}*"
    | SORT due DESC
    | LIMIT ${params.limit}
    | KEEP todoId, title`;
}

/** Handles search errors consistently. */
function handleSearchError(
  c: HonoContext,
  error: unknown,
  span: { setAttribute: (key: string, value: unknown) => void },
  message: string,
): Response {
  logger.error({ error }, message);
  span.setAttribute('search.error', true);

  if (error instanceof z.ZodError) {
    return c.json({ details: error.errors, error: 'Invalid search parameters' }, 400);
  }

  return c.json({ error: 'Search failed' }, 500);
}
