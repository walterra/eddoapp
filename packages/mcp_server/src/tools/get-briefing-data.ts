import { z } from 'zod';
import { getTimezoneDateRange, type DateRange } from './date-range.js';
import type { ReportQuery } from './report_payload.js';
import { reportResponse } from './report_response.js';
import { createErrorResponse } from './response-helpers.js';
import type { GetUserDb, ToolContext } from './types.js';

export const getBriefingDataDescription = `Get compact daily briefing data with current date, weekday, timezone, total counts and explicit selection/truncation metadata.
Returns up to 10 actionable todos today, 10 most recently overdue actions, 10 next actions, 5 waiting items, 20 calendar appointments, and all summarized active sessions.
Someday items are excluded from action lists and counted separately as somedayBacklog. Counts with countExact=false are lower bounds.
Todo fields include id, title, context, due, tags, calendar time, trackedMinutes and activeSessionCount; descriptions and internal revisions are omitted.
Use this instead of multiple listTodos calls. Never infer zero items from a failed tool response.`;

export const getBriefingDataParameters = z
  .object({})
  .describe('Returns briefing data for the current date in the user timezone');
export type GetBriefingDataArgs = z.infer<typeof getBriefingDataParameters>;

/** Selects recent overdue actions instead of letting an old read-later backlog dominate. */
function actionQueries(range: DateRange): ReportQuery[] {
  const base = { version: 'alpha4', completed: null };
  const options = { use_index: 'version-completed-due-index' };
  return [
    {
      name: 'todaysTodos',
      limit: 10,
      query: {
        ...options,
        selector: {
          ...base,
          due: { $gte: range.todayStart, $lte: range.todayEnd },
          tags: { $nin: ['gtd:someday', 'gtd:waiting', 'gtd:calendar'] },
        },
        sort: [{ due: 'asc' }],
      },
    },
    {
      name: 'overdueTodos',
      limit: 10,
      query: {
        ...options,
        selector: {
          ...base,
          due: { $lt: range.todayStart },
          tags: { $nin: ['gtd:someday', 'gtd:waiting', 'gtd:calendar'] },
        },
        sort: [{ due: 'desc' }],
      },
    },
    {
      name: 'nextActions',
      limit: 10,
      query: {
        ...options,
        selector: { ...base, tags: { $all: ['gtd:next'], $nin: ['gtd:someday'] } },
        sort: [{ due: 'asc' }],
      },
    },
  ];
}

function contextQueries(range: DateRange): ReportQuery[] {
  const base = { version: 'alpha4', completed: null };
  const options = { use_index: 'version-completed-due-index' };
  return [
    {
      name: 'waitingFor',
      limit: 5,
      query: {
        ...options,
        selector: { ...base, tags: { $in: ['gtd:waiting'] } },
        sort: [{ due: 'asc' }],
      },
    },
    {
      name: 'calendarToday',
      limit: 20,
      query: {
        ...options,
        selector: {
          ...base,
          tags: { $in: ['gtd:calendar'] },
          due: { $gte: range.todayStart, $lte: range.todayEnd },
        },
        sort: [{ due: 'asc' }],
      },
    },
    {
      name: 'somedayBacklog',
      limit: 0,
      query: {
        ...options,
        selector: { ...base, due: { $lt: range.todayStart }, tags: { $in: ['gtd:someday'] } },
      },
    },
  ];
}

export function briefingQueries(range: DateRange): ReportQuery[] {
  return [...actionQueries(range), ...contextQueries(range)];
}

/** Fetches bounded briefing sections and fails explicitly when a database query fails. */
export async function executeGetBriefingData(
  _args: GetBriefingDataArgs,
  context: ToolContext,
  getUserDb: GetUserDb,
): Promise<string> {
  const range = getTimezoneDateRange(new Date(), context.session?.timezone);
  try {
    return await reportResponse(
      { type: 'briefing', range, queries: briefingQueries(range) },
      context,
      getUserDb,
    );
  } catch (error) {
    context.log.error('Failed to get briefing data', {
      error: error instanceof Error ? error.message : String(error),
    });
    return createErrorResponse({
      summary: 'Failed to get briefing data',
      error,
      operation: 'get_briefing_data',
      recoverySuggestions: [
        'Check database connection and retry; do not treat unavailable sections as empty.',
      ],
    });
  }
}
