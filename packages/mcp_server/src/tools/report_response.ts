import type { DateRange } from './date-range.js';
import {
  activeReportSection,
  queryReportSection,
  type ReportQuery,
  type ReportSection,
} from './report_payload.js';
import { createSuccessResponse } from './response-helpers.js';
import type { GetUserDb, ToolContext } from './types.js';

export interface ReportResponseOptions {
  type: 'briefing' | 'recap';
  range: DateRange;
  queries: ReportQuery[];
}

/** Preserves date metadata, total counts, and selection limits alongside compact arrays. */
export async function reportResponse(
  options: ReportResponseOptions,
  context: ToolContext,
  getUserDb: GetUserDb,
): Promise<string> {
  const started = Date.now();
  const db = getUserDb(context);
  context.log.info(`Getting ${options.type} data for user`, { userId: context.session?.userId });
  const sections: Record<string, ReportSection> = {};
  await Promise.all(
    options.queries.map(async (query) => {
      context.log.debug('Executing report section query', {
        name: query.name,
        query: JSON.stringify(query.query),
      });
      sections[query.name] = await queryReportSection(db, query, started);
    }),
  );
  sections.activeTimeTracking = await activeReportSection(db, started);
  const data = buildReportData(options, sections);
  context.log.info(`${options.type} data retrieved successfully`, {
    counts: Object.fromEntries(
      Object.entries(sections).map(([name, section]) => [name, section.total]),
    ),
  });
  return createSuccessResponse({
    summary: `${options.type} data for ${options.range.todayDate}`,
    data,
    operation: `get_${options.type}_data`,
    executionTime: Date.now() - started,
  });
}

function buildReportData(
  options: ReportResponseOptions,
  sections: Record<string, ReportSection>,
): Record<string, unknown> {
  const data = Object.fromEntries(
    Object.entries(sections)
      .filter(([name]) => name !== 'somedayBacklog')
      .map(([name, value]) => [name, value.items]),
  );
  const counts = Object.fromEntries(
    Object.entries(sections).map(([name, value]) => [name, value.total]),
  );
  const selection = Object.fromEntries(
    Object.entries(sections).map(([name, value]) => [
      name,
      {
        total: value.total,
        returned: value.returned,
        countExact: value.countExact,
        truncated: value.truncated,
      },
    ]),
  );
  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' }).format(
    new Date(`${options.range.todayDate}T12:00:00Z`),
  );
  return {
    ...data,
    metadata: {
      date: options.range.todayDate,
      weekday,
      timeZone: options.range.timeZone,
      dateStart: options.range.todayStart,
      dateEnd: options.range.todayEnd,
      counts,
      selection,
      trackingScope: 'trackedMinutes is cumulative across all stored sessions, not just today.',
      countSemantics:
        'Exact when countExact=true; otherwise total is a lower bound. Queries are not a cross-section snapshot.',
    },
  };
}
