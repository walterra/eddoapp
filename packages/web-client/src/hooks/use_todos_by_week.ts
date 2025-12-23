import { useQuery } from '@tanstack/react-query';

import type { Todo } from '@eddo/core-shared';
import { usePouchDb } from '../pouch_db';

interface UseTodosByWeekParams {
  startDate: Date;
  endDate: Date;
  enabled?: boolean;
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
 * @param enabled - Whether the query should run (default: true if safeDb exists)
 * @returns TanStack Query result with todos data, loading, and error states
 */
export function useTodosByWeek({ startDate, endDate, enabled = true }: UseTodosByWeekParams) {
  const { safeDb } = usePouchDb();

  return useQuery({
    queryKey: ['todos', 'byDueDate', startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      console.time('fetchTodos');
      // Use include_docs to fetch full documents efficiently
      // View emits null, doc is fetched via include_docs
      const todos = await safeDb.safeQuery<Todo>('todos_by_due_date', 'byDueDate', {
        descending: false,
        endkey: endDate.toISOString(),
        include_docs: true,
        startkey: startDate.toISOString(),
      });
      console.timeEnd('fetchTodos');
      return todos;
    },
    enabled: !!safeDb && enabled,
  });
}
