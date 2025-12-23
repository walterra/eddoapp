import { useQuery } from '@tanstack/react-query';

import type { Todo } from '@eddo/core-shared';
import { usePouchDb } from '../pouch_db';

interface UseTimeTrackingActiveParams {
  enabled?: boolean;
}

/**
 * Fetches IDs of todos with active time tracking (end time is null).
 * Uses Mango query to find todos with active entries, then filters client-side.
 *
 * @param enabled - Whether the query should run
 * @returns TanStack Query result with active todo IDs
 */
export function useTimeTrackingActive({ enabled = true }: UseTimeTrackingActiveParams = {}) {
  const { safeDb } = usePouchDb();

  return useQuery({
    queryKey: ['todos', 'byTimeTrackingActive'],
    queryFn: async () => {
      const timerId = `fetchTimeTrackingActive-${Date.now()}`;
      console.time(timerId);

      // Use Mango to find todos that have active entries
      // Then filter client-side for those with null end time (currently tracking)
      // Note: PouchDB defaults to limit=25, so we set a high limit
      const todos = await safeDb.safeFind<Todo>(
        {
          version: 'alpha3',
          active: { $exists: true, $ne: {} },
        },
        { limit: 10000 },
      );

      // Filter for todos with active time tracking (any entry with null end time)
      const ids = todos
        .filter((todo) => Object.values(todo.active).some((endTime) => endTime === null))
        .map((todo) => todo._id);

      console.timeEnd(timerId);
      return ids;
    },
    enabled: !!safeDb && enabled,
  });
}
