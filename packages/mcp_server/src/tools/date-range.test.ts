import { describe, expect, it } from 'vitest';

import { getUtcDateRange } from './date-range.js';

describe('getUtcDateRange', () => {
  it('returns date-only day boundaries for a reference instant', () => {
    const result = getUtcDateRange(new Date('2026-01-02T12:34:56.789Z'));

    expect(result).toEqual({
      todayStart: '2026-01-02',
      todayEnd: '2026-01-02',
      todayDate: '2026-01-02',
    });
  });

  it('does not shift the range for offset timestamps near midnight', () => {
    const result = getUtcDateRange(new Date('2026-01-02T00:30:00+02:00'));

    expect(result).toEqual({
      todayStart: '2026-01-01',
      todayEnd: '2026-01-01',
      todayDate: '2026-01-01',
    });
  });
});
