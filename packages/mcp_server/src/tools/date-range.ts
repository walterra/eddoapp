/** Date range for current date-only day queries */
export interface DateRange {
  todayStart: string;
  todayEnd: string;
  todayDate: string;
}

/**
 * Returns date-only boundaries for a reference instant.
 *
 * @param now - Reference instant.
 * @return Date-only range metadata.
 */
export function getUtcDateRange(now: Date = new Date()): DateRange {
  const todayDate = now.toISOString().split('T')[0] ?? '1970-01-01';

  return {
    todayStart: todayDate,
    todayEnd: todayDate,
    todayDate,
  };
}
