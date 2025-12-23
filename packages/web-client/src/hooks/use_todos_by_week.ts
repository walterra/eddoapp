import { useQuery } from '@tanstack/react-query';

import type { Todo } from '@eddo/core-shared';
import { usePouchDb } from '../pouch_db';

interface UseTodosByWeekParams {
  startDate: Date;
  endDate: Date;
  enabled?: boolean;
}

/**
 * Fetches todos for a date range using Mango queries (faster than MapReduce in PouchDB).
 * Uses the version-due-index for efficient querying.
 *
 * @param startDate - Start of the date range
 * @param endDate - End of the date range
 * @param enabled - Whether the query should run
 * @returns TanStack Query result with todos data
 */
export function useTodosByWeek({ startDate, endDate, enabled = true }: UseTodosByWeekParams) {
  const { safeDb } = usePouchDb();

  return useQuery({
    queryKey: ['todos', 'byDueDate', startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      const timerId = `fetchTodos-${Date.now()}`;
      console.time(timerId);
      // Use Mango find (faster than MapReduce views in PouchDB)
      const todos = await safeDb.safeFind<Todo>({
        version: 'alpha3',
        due: {
          $gte: startDate.toISOString(),
          $lte: endDate.toISOString(),
        },
      });
      console.timeEnd(timerId);
      return todos;
    },
    enabled: !!safeDb && enabled,
  });
}
