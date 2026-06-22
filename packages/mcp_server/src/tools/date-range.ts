/** Date range for current UTC day queries */
export interface DateRange {
  todayStart: string;
  todayEnd: string;
  todayDate: string;
}

/**
 * Returns UTC day boundaries for a reference instant.
 *
 * @param now - Reference instant.
 * @return UTC date range metadata.
 */
export function getUtcDateRange(now: Date = new Date()): DateRange {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const date = now.getUTCDate();

  return {
    todayStart: new Date(Date.UTC(year, month, date, 0, 0, 0, 0)).toISOString(),
    todayEnd: new Date(Date.UTC(year, month, date, 23, 59, 59, 999)).toISOString(),
    todayDate: now.toISOString().split('T')[0] ?? '1970-01-01',
  };
}
