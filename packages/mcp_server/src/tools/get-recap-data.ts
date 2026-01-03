/**
 * Get Recap Data Tool - Aggregates all data needed for daily recap in one call
 */
import type { TodoAlpha3 } from '@eddo/core-server';
import type { MangoQuery } from 'nano';
import { z } from 'zod';

import { createErrorResponse, createSuccessResponse } from './response-helpers.js';
import type { GetUserDb, ToolContext } from './types.js';

/** Tool description for LLM consumption */
export const getRecapDataDescription = `Get all data needed for a daily recap in a single call.

Returns aggregated data including:
- Todos completed today (with completion timestamps)
- Active time tracking entries (for showing work in progress)
- Upcoming next actions (tagged gtd:next, not completed, for tomorrow preview)

Use this instead of multiple listTodos calls when generating daily recaps.`;

/** Zod schema for getRecapData parameters */
export const getRecapDataParameters = z
  .object({})
  .describe('No parameters required - returns all recap-relevant data for the current date');

export type GetRecapDataArgs = z.infer<typeof getRecapDataParameters>;

/** Date range for queries */
interface DateRange {
  todayStart: string;
  todayEnd: string;
  todayDate: string;
}

/** Structure for recap data response */
interface RecapData {
  completedToday: TodoAlpha3[];
  activeTimeTracking: Array<TodoAlpha3 & { activeSessionCount: number }>;
  upcomingNextActions: TodoAlpha3[];
  metadata: {
    date: string;
    dateStart: string;
    dateEnd: string;
    counts: {
      completedToday: number;
      activeTimeTracking: number;
      upcomingNextActions: number;
    };
  };
}

/** Query results from parallel execution */
interface QueryResults {
  completedToday: TodoAlpha3[];
  activeTimeTracking: Array<TodoAlpha3 & { activeSessionCount: number }>;
  upcomingNextActions: TodoAlpha3[];
}

/**
 * Gets today's date range in ISO format
 */
function getDateRange(): DateRange {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  return {
    todayStart: start.toISOString(),
    todayEnd: end.toISOString(),
    todayDate: now.toISOString().split('T')[0],
  };
}

/**
 * Executes a Mango query and returns results
 */
async function executeQuery(
  db: ReturnType<GetUserDb>,
  query: MangoQuery,
  context: ToolContext,
  queryName: string,
): Promise<TodoAlpha3[]> {
  try {
    context.log.debug(`Executing ${queryName} query`, { query: JSON.stringify(query) });
    const response = await db.find(query);
    return response.docs as TodoAlpha3[];
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    context.log.warn(`Query ${queryName} failed, returning empty array`, { error: message });
    return [];
  }
}

/**
 * Deduplicates todos by ID
 */
function deduplicateTodos(todos: TodoAlpha3[]): TodoAlpha3[] {
  const seenIds = new Set<string>();
  return todos.filter((todo) => {
    if (seenIds.has(todo._id)) return false;
    seenIds.add(todo._id);
    return true;
  });
}

/**
 * Gets todos with active time tracking using the view
 */
async function getActiveTimeTracking(
  db: ReturnType<GetUserDb>,
  context: ToolContext,
): Promise<Array<TodoAlpha3 & { activeSessionCount: number }>> {
  try {
    const result = await db.view('todos_by_time_tracking_active', 'byTimeTrackingActive', {
      include_docs: true,
    });

    const seenIds = new Set<string>();
    return result.rows
      .map((row) => row.doc)
      .filter((doc): doc is TodoAlpha3 => {
        if (!doc || seenIds.has(doc._id)) return false;
        seenIds.add(doc._id);
        return true;
      })
      .map((todo) => ({
        ...todo,
        activeSessionCount: Object.values(todo.active).filter((end) => end === null).length,
      }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    context.log.warn('Failed to get active time tracking, returning empty array', {
      error: message,
    });
    return [];
  }
}

/**
 * Executes all recap queries in parallel
 */
async function executeAllQueries(
  db: ReturnType<GetUserDb>,
  context: ToolContext,
  dateRange: DateRange,
): Promise<QueryResults> {
  const { todayStart, todayEnd } = dateRange;

  const [completedToday, activeTimeTracking, upcomingNextActions] = await Promise.all([
    executeQuery(
      db,
      {
        selector: { version: 'alpha3', completed: { $gte: todayStart, $lte: todayEnd } },
        sort: [{ due: 'asc' }],
        limit: 100,
        use_index: 'version-completed-due-index',
      },
      context,
      'completedToday',
    ),
    getActiveTimeTracking(db, context),
    executeQuery(
      db,
      {
        selector: { version: 'alpha3', completed: null, tags: { $in: ['gtd:next'] } },
        sort: [{ due: 'asc' }],
        limit: 10,
        use_index: 'version-completed-due-index',
      },
      context,
      'upcomingNextActions',
    ),
  ]);

  return { completedToday, activeTimeTracking, upcomingNextActions };
}

/**
 * Builds the recap data response structure
 */
function buildRecapData(results: QueryResults, dateRange: DateRange): RecapData {
  return {
    completedToday: deduplicateTodos(results.completedToday),
    activeTimeTracking: results.activeTimeTracking,
    upcomingNextActions: deduplicateTodos(results.upcomingNextActions),
    metadata: {
      date: dateRange.todayDate,
      dateStart: dateRange.todayStart,
      dateEnd: dateRange.todayEnd,
      counts: {
        completedToday: results.completedToday.length,
        activeTimeTracking: results.activeTimeTracking.length,
        upcomingNextActions: results.upcomingNextActions.length,
      },
    },
  };
}

/**
 * Execute handler for getRecapData tool
 */
export async function executeGetRecapData(
  _args: GetRecapDataArgs,
  context: ToolContext,
  getUserDb: GetUserDb,
): Promise<string> {
  const db = getUserDb(context);
  const startTime = Date.now();
  const dateRange = getDateRange();

  context.log.info('Getting recap data for user', { userId: context.session?.userId });

  try {
    const results = await executeAllQueries(db, context, dateRange);
    const recapData = buildRecapData(results, dateRange);
    const executionTime = Date.now() - startTime;

    context.log.info('Recap data retrieved successfully', {
      counts: recapData.metadata.counts,
      executionTime,
    });

    return createSuccessResponse({
      summary: `Recap data for ${dateRange.todayDate}`,
      data: recapData,
      operation: 'get_recap_data',
      executionTime,
    });
  } catch (error) {
    context.log.error('Failed to get recap data', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return createErrorResponse({
      summary: 'Failed to get recap data',
      error,
      operation: 'get_recap_data',
      recoverySuggestions: [
        'Check database connection',
        'Verify authentication credentials',
        'Try using individual listTodos calls as fallback',
      ],
    });
  }
}
