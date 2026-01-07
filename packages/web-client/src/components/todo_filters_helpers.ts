/**
 * Helper functions for todo filters
 */
import { add, format, getISOWeek, sub } from 'date-fns';

import type { TimeRange } from './time_range_filter';

/** Format the period label based on current date and time range */
export function getPeriodLabel(currentDate: Date, timeRange: TimeRange): string {
  switch (timeRange.type) {
    case 'current-day':
      return format(currentDate, 'MMM d, yyyy');
    case 'current-week':
      return `CW${getISOWeek(currentDate)}`;
    case 'current-month':
      return format(currentDate, 'MMM yyyy');
    case 'current-year':
      return format(currentDate, 'yyyy');
    case 'custom':
      if (timeRange.startDate && timeRange.endDate) {
        const start = format(new Date(timeRange.startDate), 'MMM d');
        const end = format(new Date(timeRange.endDate), 'MMM d, yyyy');
        return `${start} - ${end}`;
      }
      return 'Custom Range';
    case 'all-time':
      return 'All Time';
    default:
      return 'Period';
  }
}

/** Calculate the number of days in a custom range */
function getCustomRangeDays(timeRange: TimeRange): number {
  if (!timeRange.startDate || !timeRange.endDate) return 0;
  const start = new Date(timeRange.startDate);
  const end = new Date(timeRange.endDate);
  return (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
}

/** Navigate to the next or previous period */
export function navigatePeriod(
  currentDate: Date,
  timeRange: TimeRange,
  direction: 'prev' | 'next',
): Date {
  const addOrSub = direction === 'next' ? add : sub;
  switch (timeRange.type) {
    case 'current-day':
      return addOrSub(currentDate, { days: 1 });
    case 'current-week':
      return addOrSub(currentDate, { weeks: 1 });
    case 'current-month':
      return addOrSub(currentDate, { months: 1 });
    case 'current-year':
      return addOrSub(currentDate, { years: 1 });
    case 'custom':
      return addOrSub(currentDate, { days: getCustomRangeDays(timeRange) });
    default:
      return currentDate;
  }
}
