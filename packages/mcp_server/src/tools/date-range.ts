import {
  formatDateInTimeZone,
  getUtcRangeForTimeZoneDate,
  normalizeTimeZone,
} from '@eddo/core-server';

/** Date range for current date-only day queries */
export interface DateRange {
  todayStart: string;
  todayEnd: string;
  todayDate: string;
  completedStart: string;
  completedEnd: string;
  timeZone: string;
}

/**
 * Returns timezone-aware boundaries for a reference instant.
 *
 * @param now Reference instant.
 * @param timeZone IANA timezone.
 * @return Date range metadata.
 */
export function getTimezoneDateRange(now: Date = new Date(), timeZone?: string): DateRange {
  const normalizedTimeZone = normalizeTimeZone(timeZone);
  const todayDate = formatDateInTimeZone(now, normalizedTimeZone);
  const completedRange = getUtcRangeForTimeZoneDate(todayDate, normalizedTimeZone);

  return {
    todayStart: todayDate,
    todayEnd: todayDate,
    todayDate,
    completedStart: completedRange.start,
    completedEnd: completedRange.end,
    timeZone: normalizedTimeZone,
  };
}

/**
 * Returns UTC day boundaries for compatibility.
 *
 * @param now Reference instant.
 * @return Date range metadata.
 */
export function getUtcDateRange(now: Date = new Date()): DateRange {
  return getTimezoneDateRange(now, 'UTC');
}
