/**
 * List Todos Tool - Query todos with optional filters
 */
import type { MangoQuery, MangoSelector } from 'nano';
import { z } from 'zod';

import {
  createEmptyDatabaseResponse,
  createErrorResponse,
  createSuccessResponse,
} from './response-helpers.js';
import type { GetUserDb, ToolContext } from './types.js';

/** Tool description for LLM consumption */
export const listTodosDescription = `List todos with optional filters from the authenticated user's database.

Available filters: context, completed, dateFrom/dateTo (due date range), completedFrom/completedTo (completion date range), externalId, limit, tags

GTD-AWARE QUERY HANDLING:
- "What's next?" → filter by gtd:next tags
- "What am I waiting for?" → filter by gtd:waiting tags
- "Show my projects" → filter by gtd:project tags
- "Someday items" → filter by gtd:someday tags
- "What's my schedule?" → filter by gtd:calendar tags
- "What did I complete today?" → use completedFrom/completedTo with today's date range`;

/** Zod schema for listTodos parameters */
export const listTodosParameters = z.object({
  context: z.string().optional().describe('Filter todos by GTD context (e.g. "work", "private")'),
  completed: z
    .boolean()
    .optional()
    .describe(
      'Filter by completion status: true for completed, false for incomplete, undefined for all',
    ),
  dateFrom: z
    .string()
    .optional()
    .describe('Start date filter for due date in ISO format (inclusive)'),
  dateTo: z.string().optional().describe('End date filter for due date in ISO format (inclusive)'),
  completedFrom: z
    .string()
    .optional()
    .describe('Start date filter for completion date in ISO format (inclusive)'),
  completedTo: z
    .string()
    .optional()
    .describe('End date filter for completion date in ISO format (inclusive)'),
  limit: z.number().default(50).describe('Maximum number of todos to return (default: 50)'),
  tags: z
    .array(z.string())
    .optional()
    .describe('Filter by specific tags (e.g., ["gtd:next"] for next actions)'),
  externalId: z
    .string()
    .optional()
    .describe('Filter by exact external system ID (e.g., "github:owner/repo/issues/123")'),
});

export type ListTodosArgs = z.infer<typeof listTodosParameters>;

/**
 * Builds a date range selector for a field
 */
function buildDateRangeSelector(from?: string, to?: string): Record<string, unknown> | undefined {
  if (!from && !to) return undefined;
  const range: Record<string, unknown> = {};
  if (from) range['$gte'] = from;
  if (to) range['$lte'] = to;
  return range;
}

/**
 * Builds the completed field selector based on args
 */
function buildCompletedSelector(args: ListTodosArgs): unknown {
  const hasCompletedDateRange = args.completedFrom || args.completedTo;

  if (hasCompletedDateRange) {
    if (args.completed === false) {
      throw new Error('Cannot use completedFrom/completedTo with completed=false');
    }
    return buildDateRangeSelector(args.completedFrom, args.completedTo);
  }

  if (args.completed === undefined) return undefined;
  return args.completed ? { $ne: null } : null;
}

/**
 * Builds the Mango selector based on filter arguments
 */
function buildSelector(args: ListTodosArgs): MangoSelector {
  const selector: MangoSelector = { version: 'alpha3' };

  if (args.context) selector.context = args.context;

  const completedSelector = buildCompletedSelector(args);
  if (completedSelector !== undefined) selector.completed = completedSelector;

  const dueSelector = buildDateRangeSelector(args.dateFrom, args.dateTo);
  if (dueSelector) selector.due = dueSelector;

  if (args.tags && args.tags.length > 0) selector.tags = { $in: args.tags };
  if (args.externalId) selector.externalId = args.externalId;

  return selector;
}

/**
 * Determines the appropriate CouchDB index based on query filters
 */
function selectIndex(args: ListTodosArgs): string {
  const hasCompletedFilter = args.completed !== undefined || args.completedFrom || args.completedTo;

  if (args.context && hasCompletedFilter) return 'version-context-completed-due-index';
  if (args.context) return 'version-context-due-index';
  if (hasCompletedFilter) return 'version-completed-due-index';
  return 'version-due-index';
}

/**
 * Builds the Mango query with selector, sorting, and index
 */
function buildQuery(args: ListTodosArgs, limit: number): MangoQuery {
  return {
    selector: buildSelector(args),
    sort: [{ due: 'asc' }],
    limit,
    use_index: selectIndex(args),
  };
}

/**
 * Formats the successful list response
 */
function formatListResponse(
  docs: unknown[],
  args: ListTodosArgs,
  limit: number,
  executionTime: number,
): string {
  return createSuccessResponse({
    summary: `Found ${docs.length} matching todos`,
    data: docs,
    operation: 'list',
    executionTime,
    extra: {
      pagination: {
        count: docs.length,
        limit,
        has_more: docs.length === limit,
      },
      metadata: {
        execution_time: `${executionTime.toFixed(2)}ms`,
        operation: 'list',
        timestamp: new Date().toISOString(),
        filters_applied: Object.keys(args).filter(
          (k) => args[k as keyof typeof args] !== undefined,
        ),
      },
    },
  });
}

/**
 * Execute handler for listTodos tool
 */
export async function executeListTodos(
  args: ListTodosArgs,
  context: ToolContext,
  getUserDb: GetUserDb,
): Promise<string> {
  const db = getUserDb(context);
  const limit = args.limit && args.limit > 0 ? args.limit : 50;

  context.log.info('Listing todos for user', {
    userId: context.session?.userId,
    filters: args,
  });

  try {
    const query = buildQuery(args, limit);

    context.log.info('Executing Mango query', {
      query: JSON.stringify(query, null, 2),
      dbName: context.session?.userId,
    });

    const startTime = Date.now();
    const response = await db.find(query);
    const executionTime = Date.now() - startTime;

    context.log.info('Todos retrieved successfully', { count: response.docs.length });

    return formatListResponse(response.docs, args, limit, executionTime);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (message.includes('Database does not exist') || message.includes('no_db_file')) {
      context.log.info('Database does not exist, returning empty result');
      return createEmptyDatabaseResponse('list', limit);
    }

    return createErrorResponse({
      summary: 'Failed to list todos',
      error,
      operation: 'list',
      recoverySuggestions: [
        'Check database connection',
        'Verify authentication credentials',
        'Try with simpler filter criteria',
      ],
    });
  }
}
