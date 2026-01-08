import type { Todo } from '../types/todo';

/**
 * Calculates total duration from time tracking entries.
 * @param active - Time tracking record with start timestamps as keys and end timestamps as values
 * @param activeDate - Optional date string (yyyy-MM-dd) to filter entries by specific date
 * @returns Total duration in milliseconds
 */
export function getActiveDuration(active: Todo['active'], activeDate?: string): number {
  return Object.entries(active).reduce((p, c) => {
    // TODO The 'split' is a CEST quick fix
    const currentDate = c[0].split('T')[0];

    if (activeDate !== undefined && activeDate !== currentDate) {
      return p;
    }

    return p + (c[1] !== null ? new Date(c[1]) : new Date()).getTime() - new Date(c[0]).getTime();
  }, 0);
}

/**
 * Calculates total duration from time tracking entries within a date range.
 * @param active - Time tracking record with start timestamps as keys and end timestamps as values
 * @param startDate - Start of date range (yyyy-MM-dd)
 * @param endDate - End of date range (yyyy-MM-dd)
 * @returns Total duration in milliseconds
 */
export function getActiveDurationInRange(
  active: Todo['active'],
  startDate: string,
  endDate: string,
): number {
  return Object.entries(active).reduce((total, [start, end]) => {
    const entryDate = start.split('T')[0];

    if (entryDate < startDate || entryDate > endDate) {
      return total;
    }

    const startTime = new Date(start).getTime();
    const endTime = end !== null ? new Date(end).getTime() : Date.now();

    return total + (endTime - startTime);
  }, 0);
}
