import { describe, expect, it } from 'vitest';

import {
  formatDateInTimeZone,
  formatScheduledTimeForTimeZone,
  getUtcRangeForTimeZoneDate,
  isValidTimeZone,
  normalizeTimeZone,
} from './timezone';

describe('timezone utils', () => {
  it('validates IANA timezone identifiers', () => {
    expect(isValidTimeZone('Europe/Vienna')).toBe(true);
    expect(isValidTimeZone('Invalid/Zone')).toBe(false);
  });

  it('normalizes invalid timezones to UTC', () => {
    expect(normalizeTimeZone('Invalid/Zone')).toBe('UTC');
  });

  it('formats dates in the target timezone', () => {
    const date = new Date('2026-01-02T23:30:00.000Z');

    expect(formatDateInTimeZone(date, 'Europe/Vienna')).toBe('2026-01-03');
  });

  it('returns UTC bounds for a timezone-local date', () => {
    expect(getUtcRangeForTimeZoneDate('2026-01-03', 'Europe/Vienna')).toEqual({
      start: '2026-01-02T23:00:00.000Z',
      end: '2026-01-03T22:59:59.999Z',
    });
  });

  it('converts scheduled local times for display timezone', () => {
    expect(
      formatScheduledTimeForTimeZone('2026-01-03', '09:00', 'Europe/Vienna', 'America/Los_Angeles'),
    ).toEqual({
      date: '2026-01-03',
      time: '00:00',
      dayOffset: 0,
      timeZone: 'America/Los_Angeles',
    });
  });
});
