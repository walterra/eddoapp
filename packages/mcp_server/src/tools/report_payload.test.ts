import type { TodoAlpha4 } from '@eddo/core-server';
import type { MangoQuery } from 'nano';
import { describe, expect, it, vi } from 'vitest';
import { getTimezoneDateRange } from './date-range.js';
import { briefingQueries, executeGetBriefingData } from './get-briefing-data.js';
import { executeGetRecapData } from './get-recap-data.js';
import { activeReportSection, queryReportSection, reportItem } from './report_payload.js';
import type { GetUserDb, ToolContext } from './types.js';

function todo(index: number, changes: Partial<TodoAlpha4> = {}): TodoAlpha4 {
  return {
    _id: `todo-${index}`,
    title: `Task ${index}`,
    context: 'work',
    due: '2026-10-20',
    completed: null,
    active: {},
    tags: ['gtd:next'],
    description: 'long description'.repeat(2000),
    link: null,
    repeat: null,
    version: 'alpha4',
    ...changes,
  };
}
function database(docs: TodoAlpha4[]): ReturnType<GetUserDb> {
  return {
    find: vi.fn(async (query: MangoQuery) => {
      const start = Number(query.bookmark ?? 0);
      return { docs: docs.slice(start, start + 200), bookmark: String(start + 200) };
    }),
    view: vi.fn(async () => ({ rows: [] })),
  } as unknown as ReturnType<GetUserDb>;
}
const now = Date.parse('2026-10-20T06:50:00Z');
const context = {
  session: { timezone: 'Europe/Vienna' },
  log: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
} as unknown as ToolContext;

describe('compact report payloads', () => {
  it('counts all pages but retains only bounded fields and candidates', async () => {
    const db = database(Array.from({ length: 620 }, (_, index) => todo(index)));
    const result = await queryReportSection(
      db,
      { name: 'nextActions', query: { selector: {} }, limit: 10 },
      now,
    );
    expect(result).toMatchObject({ total: 620, returned: 10, countExact: true, truncated: true });
    expect(JSON.stringify(result)).not.toContain('long description');
    expect(result.items[0]).not.toHaveProperty('_rev');
    expect(vi.mocked(db.find).mock.calls[0][0].fields).not.toContain('description');
  });

  it('marks a saturated unpageable result as a lower bound, not an exact total', async () => {
    const db = database([]);
    vi.mocked(db.find).mockResolvedValue({
      docs: Array.from({ length: 200 }, (_, index) => todo(index)),
      bookmark: '',
    });
    expect(
      await queryReportSection(
        db,
        { name: 'nextActions', query: { selector: {} }, limit: 10 },
        now,
      ),
    ).toMatchObject({ total: 200, countExact: false });
  });

  it('keeps the earliest calendar appointments even across pages', async () => {
    const db = database(
      Array.from({ length: 205 }, (_, index) =>
        todo(index, { scheduledTime: index === 204 ? '08:00' : '18:00' }),
      ),
    );
    const result = await queryReportSection(
      db,
      { name: 'calendarToday', query: { selector: {} }, limit: 20 },
      now,
    );
    expect(result.items[0].scheduledTime).toBe('08:00');
    expect(result.total).toBe(205);
  });

  it('bounds titles and summarizes active time instead of exposing timestamp maps', async () => {
    const item = todo(1, { title: 'x'.repeat(1000), active: { '2026-10-20T05:50:00Z': null } });
    expect(reportItem(item, now)).toMatchObject({
      trackedMinutes: 60,
      activeSessionCount: 1,
      fieldsTruncated: true,
    });
    const db = database([]);
    vi.mocked(db.view).mockResolvedValue({ rows: [{ doc: item }, { doc: item }] } as never);
    const result = await activeReportSection(db, now);
    expect(result.total).toBe(1);
    expect(result.items[0].title).toHaveLength(160);
  });

  it('excludes someday backlog from overdue actions and orders recent overdue first', () => {
    const queries = briefingQueries(getTimezoneDateRange(new Date(now), 'Europe/Vienna'));
    const overdue = queries.find((query) => query.name === 'overdueTodos')!;
    expect(overdue.query.sort).toEqual([{ due: 'desc' }]);
    expect(overdue.query.selector.tags).toEqual({
      $nin: ['gtd:someday', 'gtd:waiting', 'gtd:calendar'],
    });
    expect(queries.find((query) => query.name === 'somedayBacklog')?.limit).toBe(0);
  });

  it.each([executeGetBriefingData, executeGetRecapData])(
    'fails explicitly rather than fabricating empty sections',
    async (execute) => {
      const db = database([]);
      vi.mocked(db.find).mockRejectedValue(new Error('database unavailable'));
      const response = JSON.parse(await execute({}, context, () => db));
      expect(response.error).toBe('database unavailable');
      expect(response.data).toBeUndefined();
    },
  );

  it.each([executeGetBriefingData, executeGetRecapData])(
    'retains correct weekday and exact counts in metadata',
    async (execute) => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(now);
      try {
        const result = JSON.parse(await execute({}, context, () => database([todo(1)])));
        expect(result.data.metadata).toMatchObject({
          date: '2026-10-20',
          weekday: 'Tuesday',
          timeZone: 'Europe/Vienna',
        });
        expect(result.data.activeTimeTracking).toEqual([]);
      } finally {
        vi.useRealTimers();
      }
    },
  );
});
