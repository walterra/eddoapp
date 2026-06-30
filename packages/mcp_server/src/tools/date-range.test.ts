import { describe, expect, it } from 'vitest';

import { getTimezoneDateRange, getUtcDateRange } from './date-range.js';

describe('getUtcDateRange', () => {
  it('returns date-only day boundaries for a reference instant', () => {
    const result = getUtcDateRange(new Date('2026-01-02T12:34:56.789Z'));

    expect(result).toEqual({
      todayStart: '2026-01-02',
      todayEnd: '2026-01-02',
      todayDate: '2026-01-02',
      completedStart: '2026-01-02T00:00:00.000Z',
      completedEnd: '2026-01-02T23:59:59.999Z',
      timeZone: 'UTC',
    });
  });

  it('does not shift the range for offset timestamps near midnight', () => {
    const result = getUtcDateRange(new Date('2026-01-02T00:30:00+02:00'));

    expect(result).toEqual({
      todayStart: '2026-01-01',
      todayEnd: '2026-01-01',
      todayDate: '2026-01-01',
      completedStart: '2026-01-01T00:00:00.000Z',
      completedEnd: '2026-01-01T23:59:59.999Z',
      timeZone: 'UTC',
    });
  });
});

describe('getTimezoneDateRange', () => {
  it('returns the user-local date and UTC completion boundaries', () => {
    const result = getTimezoneDateRange(new Date('2026-01-02T23:30:00.000Z'), 'Europe/Vienna');

    expect(result).toEqual({
      todayStart: '2026-01-03',
      todayEnd: '2026-01-03',
      todayDate: '2026-01-03',
      completedStart: '2026-01-02T23:00:00.000Z',
      completedEnd: '2026-01-03T22:59:59.999Z',
      timeZone: 'Europe/Vienna',
    });
  });
});
