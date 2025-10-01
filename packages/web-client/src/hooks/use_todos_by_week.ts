import { useQuery } from '@tanstack/react-query';

import type { Todo } from '@eddo/core-shared';
import { usePouchDb } from '../pouch_db_types';

interface UseTodosByWeekParams {
  startDate: Date;
  endDate: Date;
}

/**
 * Custom hook to fetch todos for a specific week using TanStack Query.
 *
 * This hook uses TanStack Query for caching and state management, while
 * relying on PouchDB changes feed (via DatabaseChangesProvider) for
 * real-time invalidation.
 *
 * @param startDate - Start of the week (ISO date)
 * @param endDate - End of the week (ISO date)
 * @returns TanStack Query result with todos data, loading, and error states
 */
export function useTodosByWeek({ startDate, endDate }: UseTodosByWeekParams) {
  const { safeDb } = usePouchDb();

  return useQuery({
    queryKey: [
      'todos',
      'byDueDate',
      startDate.toISOString(),
      endDate.toISOString(),
    ],
    queryFn: async () => {
      console.time('fetchTodos');
      const todos = await safeDb.safeQuery<Todo>('todos', 'byDueDate', {
        descending: false,
        endkey: endDate.toISOString(),
        include_docs: false,
        startkey: startDate.toISOString(),
      });
      console.timeEnd('fetchTodos');
      return todos;
    },
    enabled: !!safeDb,
  });
}
