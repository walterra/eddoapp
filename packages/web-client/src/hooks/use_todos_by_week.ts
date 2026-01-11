import { useQuery } from '@tanstack/react-query';

import type { Todo } from '@eddo/core-shared';
import { usePouchDb } from '../pouch_db';

interface UseTodosByWeekParams {
  /** Start date in YYYY-MM-DD format */
  startDate: string;
  /** End date in YYYY-MM-DD format */
  endDate: string;
  enabled?: boolean;
}

/**
 * Fetches todos for a date range using Mango queries (faster than MapReduce in PouchDB).
 * Uses date-only strings (YYYY-MM-DD) for comparison to avoid timezone issues.
 * Since ISO strings sort lexicographically, we use date prefixes for range queries.
 *
 * @param startDate - Start date in YYYY-MM-DD format
 * @param endDate - End date in YYYY-MM-DD format
 * @param enabled - Whether the query should run
 * @returns TanStack Query result with todos data
 */
export function useTodosByWeek({ startDate, endDate, enabled = true }: UseTodosByWeekParams) {
  const { safeDb } = usePouchDb();

  return useQuery({
    queryKey: ['todos', 'byDueDate', startDate, endDate],
    queryFn: async () => {
      const timerId = `fetchTodos-${Date.now()}`;
      console.time(timerId);
      // Use Mango find (faster than MapReduce views in PouchDB)
      // Note: PouchDB defaults to limit=25, so we set a high limit
      // Use date-only prefix comparison: "2026-01-07" matches "2026-01-07T..."
      // End date uses next character after 'T' to include all times on that day
      const todos = await safeDb.safeFind<Todo>(
        {
          version: 'alpha3',
          due: {
            $gte: startDate,
            $lte: endDate + 'T\uffff',
          },
        },
        { limit: 10000 },
      );
      console.timeEnd(timerId);
      return todos;
    },
    enabled: !!safeDb && enabled,
  });
}
