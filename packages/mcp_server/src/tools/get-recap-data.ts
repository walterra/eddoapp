import { z } from 'zod';
import { getTimezoneDateRange, type DateRange } from './date-range.js';
import type { ReportQuery } from './report_payload.js';
import { reportResponse } from './report_response.js';
import { createErrorResponse } from './response-helpers.js';
import type { GetUserDb, ToolContext } from './types.js';

export const getRecapDataDescription = `Get compact daily recap data: up to 10 recent completions, 10 upcoming next actions, and all summarized active sessions.
Includes date, weekday, timezone, total counts, returned counts, and explicit truncation/countExact metadata.
Items include title, context, due/completed timestamps, trackedMinutes and activeSessionCount, without descriptions or internal revisions.
Counts with countExact=false are lower bounds. Use this instead of multiple listTodos calls; never interpret tool failure as an empty day.`;

export const getRecapDataParameters = z
  .object({})
  .describe('Returns recap data for the current date in the user timezone');
export type GetRecapDataArgs = z.infer<typeof getRecapDataParameters>;

export function recapQueries(range: DateRange): ReportQuery[] {
  const options = { use_index: 'version-completed-due-index' };
  return [
    {
      name: 'completedToday',
      limit: 10,
      query: {
        ...options,
        selector: {
          version: 'alpha4',
          completed: { $gte: range.completedStart, $lte: range.completedEnd },
        },
        sort: [{ version: 'desc' }, { completed: 'desc' }, { due: 'desc' }],
      },
    },
    {
      name: 'upcomingNextActions',
      limit: 10,
      query: {
        ...options,
        selector: {
          version: 'alpha4',
          completed: null,
          tags: { $all: ['gtd:next'], $nin: ['gtd:someday'] },
        },
        sort: [{ due: 'asc' }],
      },
    },
  ];
}

/** Fetches compact recap sections without converting database failures into empty results. */
export async function executeGetRecapData(
  _args: GetRecapDataArgs,
  context: ToolContext,
  getUserDb: GetUserDb,
): Promise<string> {
  const range = getTimezoneDateRange(new Date(), context.session?.timezone);
  try {
    return await reportResponse(
      { type: 'recap', range, queries: recapQueries(range) },
      context,
      getUserDb,
    );
  } catch (error) {
    context.log.error('Failed to get recap data', {
      error: error instanceof Error ? error.message : String(error),
    });
    return createErrorResponse({
      summary: 'Failed to get recap data',
      error,
      operation: 'get_recap_data',
      recoverySuggestions: [
        'Check database connection and retry; do not infer no accomplishments from missing data.',
      ],
    });
  }
}
