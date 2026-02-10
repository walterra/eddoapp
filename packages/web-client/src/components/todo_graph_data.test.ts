import { describe, expect, it } from 'vitest';

import type { TimeRange } from './time_range_filter';
import { resolveGraphDateRange } from './todo_graph_data';

const createCurrentDayRange = (): TimeRange => ({ type: 'current-day' });

describe('resolveGraphDateRange', () => {
  it('returns all-time range when dependency mode is active', () => {
    const dateRange = resolveGraphDateRange(
      new Date('2026-02-10T12:00:00.000Z'),
      createCurrentDayRange(),
      '2026-02-09T13:35:42.830Z',
    );

    expect(dateRange).toEqual({
      startDate: '2000-01-01',
      endDate: '2099-12-31',
    });
  });

  it('uses selected time range when dependency mode is inactive', () => {
    const dateRange = resolveGraphDateRange(
      new Date('2026-02-10T12:00:00.000Z'),
      createCurrentDayRange(),
      null,
    );

    expect(dateRange).toEqual({
      startDate: '2026-02-10',
      endDate: '2026-02-10',
    });
  });
});
