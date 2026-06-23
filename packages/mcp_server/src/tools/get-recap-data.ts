/**
 * Get Recap Data Tool - Aggregates all data needed for daily recap in one call
 */
import type { TodoAlpha4 } from '@eddo/core-server';
import type { MangoQuery } from 'nano';
import { z } from 'zod';

import { getTimezoneDateRange, type DateRange } from './date-range.js';
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

/** Structure for recap data response */
interface RecapData {
  completedToday: TodoAlpha4[];
  activeTimeTracking: Array<TodoAlpha4 & { activeSessionCount: number }>;
  upcomingNextActions: TodoAlpha4[];
  metadata: {
    date: string;
    dateStart: string;
    dateEnd: string;
    timeZone: string;
    counts: {
      completedToday: number;
      activeTimeTracking: number;
      upcomingNextActions: number;
    };
  };
}

/** Query results from parallel execution */
interface QueryResults {
  completedToday: TodoAlpha4[];
  activeTimeTracking: Array<TodoAlpha4 & { activeSessionCount: number }>;
  upcomingNextActions: TodoAlpha4[];
}

/**
 * Executes a Mango query and returns results
 */
async function executeQuery(
  db: ReturnType<GetUserDb>,
  query: MangoQuery,
  context: ToolContext,
  queryName: string,
): Promise<TodoAlpha4[]> {
  try {
    context.log.debug(`Executing ${queryName} query`, { query: JSON.stringify(query) });
    const response = await db.find(query);
    return response.docs as TodoAlpha4[];
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    context.log.warn(`Query ${queryName} failed, returning empty array`, { error: message });
    return [];
  }
}

/**
 * Deduplicates todos by ID
 */
function deduplicateTodos(todos: TodoAlpha4[]): TodoAlpha4[] {
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
): Promise<Array<TodoAlpha4 & { activeSessionCount: number }>> {
  try {
    const result = await db.view('todos_by_time_tracking_active', 'byTimeTrackingActive', {
      include_docs: true,
    });

    const seenIds = new Set<string>();
    return result.rows
      .map((row) => row.doc)
      .filter((doc): doc is TodoAlpha4 => {
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
  const [completedToday, activeTimeTracking, upcomingNextActions] = await Promise.all([
    executeQuery(
      db,
      {
        selector: {
          version: 'alpha4',
          completed: { $gte: dateRange.completedStart, $lte: dateRange.completedEnd },
        },
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
        selector: { version: 'alpha4', completed: null, tags: { $in: ['gtd:next'] } },
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
      timeZone: dateRange.timeZone,
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
  const dateRange = getTimezoneDateRange(new Date(), context.session?.timezone);

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
