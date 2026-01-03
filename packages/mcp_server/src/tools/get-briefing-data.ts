/**
 * Get Briefing Data Tool - Aggregates all data needed for daily briefing in one call
 */
import type { TodoAlpha3 } from '@eddo/core-server';
import type { MangoQuery } from 'nano';
import { z } from 'zod';

import { createErrorResponse, createSuccessResponse } from './response-helpers.js';
import type { GetUserDb, ToolContext } from './types.js';

/** Tool description for LLM consumption */
export const getBriefingDataDescription = `Get all data needed for a daily briefing in a single call.

Returns aggregated data including:
- Today's todos (due today, not completed)
- Overdue todos (past due date, not completed)
- Next actions (tagged gtd:next, not completed)
- Waiting for items (tagged gtd:waiting, not completed)
- Calendar appointments (tagged gtd:calendar, due today)
- Active time tracking entries

Use this instead of multiple listTodos calls when generating daily briefings.`;

/** Zod schema for getBriefingData parameters */
export const getBriefingDataParameters = z
  .object({})
  .describe('No parameters required - returns all briefing-relevant data for the current date');

export type GetBriefingDataArgs = z.infer<typeof getBriefingDataParameters>;

/** Date range for queries */
interface DateRange {
  todayStart: string;
  todayEnd: string;
  todayDate: string;
}

/** Structure for briefing data response */
interface BriefingData {
  todaysTodos: TodoAlpha3[];
  overdueTodos: TodoAlpha3[];
  nextActions: TodoAlpha3[];
  waitingFor: TodoAlpha3[];
  calendarToday: TodoAlpha3[];
  activeTimeTracking: Array<TodoAlpha3 & { activeSessionCount: number }>;
  metadata: {
    date: string;
    dateStart: string;
    dateEnd: string;
    counts: {
      todaysTodos: number;
      overdueTodos: number;
      nextActions: number;
      waitingFor: number;
      calendarToday: number;
      activeTimeTracking: number;
    };
  };
}

/** Query results from parallel execution */
interface QueryResults {
  todaysTodos: TodoAlpha3[];
  overdueTodos: TodoAlpha3[];
  nextActions: TodoAlpha3[];
  waitingFor: TodoAlpha3[];
  calendarToday: TodoAlpha3[];
  activeTimeTracking: Array<TodoAlpha3 & { activeSessionCount: number }>;
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
 * Builds all briefing queries for parallel execution
 */
function buildBriefingQueries(dateRange: DateRange): Array<{ name: string; query: MangoQuery }> {
  const { todayStart, todayEnd } = dateRange;
  const baseSelector = { version: 'alpha3', completed: null };
  const defaultOptions = {
    sort: [{ due: 'asc' as const }],
    limit: 50,
    use_index: 'version-completed-due-index',
  };

  return [
    {
      name: 'todaysTodos',
      query: {
        selector: { ...baseSelector, due: { $gte: todayStart, $lte: todayEnd } },
        ...defaultOptions,
      },
    },
    {
      name: 'overdueTodos',
      query: { selector: { ...baseSelector, due: { $lt: todayStart } }, ...defaultOptions },
    },
    {
      name: 'nextActions',
      query: { selector: { ...baseSelector, tags: { $in: ['gtd:next'] } }, ...defaultOptions },
    },
    {
      name: 'waitingFor',
      query: { selector: { ...baseSelector, tags: { $in: ['gtd:waiting'] } }, ...defaultOptions },
    },
    {
      name: 'calendarToday',
      query: {
        selector: {
          ...baseSelector,
          tags: { $in: ['gtd:calendar'] },
          due: { $gte: todayStart, $lte: todayEnd },
        },
        ...defaultOptions,
      },
    },
  ];
}

/**
 * Executes all briefing queries in parallel
 */
async function executeAllQueries(
  db: ReturnType<GetUserDb>,
  context: ToolContext,
  dateRange: DateRange,
): Promise<QueryResults> {
  const queries = buildBriefingQueries(dateRange);

  const [queryResults, activeTimeTracking] = await Promise.all([
    Promise.all(queries.map((q) => executeQuery(db, q.query, context, q.name))),
    getActiveTimeTracking(db, context),
  ]);

  const [todaysTodos, overdueTodos, nextActions, waitingFor, calendarToday] = queryResults;

  return { todaysTodos, overdueTodos, nextActions, waitingFor, calendarToday, activeTimeTracking };
}

/**
 * Builds the briefing data response structure
 */
function buildBriefingData(results: QueryResults, dateRange: DateRange): BriefingData {
  return {
    todaysTodos: deduplicateTodos(results.todaysTodos),
    overdueTodos: deduplicateTodos(results.overdueTodos),
    nextActions: deduplicateTodos(results.nextActions),
    waitingFor: deduplicateTodos(results.waitingFor),
    calendarToday: deduplicateTodos(results.calendarToday),
    activeTimeTracking: results.activeTimeTracking,
    metadata: {
      date: dateRange.todayDate,
      dateStart: dateRange.todayStart,
      dateEnd: dateRange.todayEnd,
      counts: {
        todaysTodos: results.todaysTodos.length,
        overdueTodos: results.overdueTodos.length,
        nextActions: results.nextActions.length,
        waitingFor: results.waitingFor.length,
        calendarToday: results.calendarToday.length,
        activeTimeTracking: results.activeTimeTracking.length,
      },
    },
  };
}

/**
 * Execute handler for getBriefingData tool
 */
export async function executeGetBriefingData(
  _args: GetBriefingDataArgs,
  context: ToolContext,
  getUserDb: GetUserDb,
): Promise<string> {
  const db = getUserDb(context);
  const startTime = Date.now();
  const dateRange = getDateRange();

  context.log.info('Getting briefing data for user', { userId: context.session?.userId });

  try {
    const results = await executeAllQueries(db, context, dateRange);
    const briefingData = buildBriefingData(results, dateRange);
    const executionTime = Date.now() - startTime;

    context.log.info('Briefing data retrieved successfully', {
      counts: briefingData.metadata.counts,
      executionTime,
    });

    return createSuccessResponse({
      summary: `Briefing data for ${dateRange.todayDate}`,
      data: briefingData,
      operation: 'get_briefing_data',
      executionTime,
    });
  } catch (error) {
    context.log.error('Failed to get briefing data', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return createErrorResponse({
      summary: 'Failed to get briefing data',
      error,
      operation: 'get_briefing_data',
      recoverySuggestions: [
        'Check database connection',
        'Verify authentication credentials',
        'Try using individual listTodos calls as fallback',
      ],
    });
  }
}
