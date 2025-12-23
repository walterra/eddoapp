import { useQuery } from '@tanstack/react-query';

import type { Activity, Todo } from '@eddo/core-shared';
import { usePouchDb } from '../pouch_db';

interface UseActivitiesByWeekParams {
  startDate: Date;
  endDate: Date;
  enabled?: boolean;
}

/**
 * Fetches activities (time tracking entries) for a date range.
 * Uses Mango query to find todos with active entries, then expands and filters client-side.
 *
 * @param startDate - Start of the date range
 * @param endDate - End of the date range
 * @param enabled - Whether the query should run
 * @returns TanStack Query result with activities data
 */
export function useActivitiesByWeek({
  startDate,
  endDate,
  enabled = true,
}: UseActivitiesByWeekParams) {
  const { safeDb } = usePouchDb();

  return useQuery({
    queryKey: ['activities', 'byActive', startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      const timerId = `fetchActivities-${Date.now()}`;
      console.time(timerId);

      const startKey = startDate.toISOString();
      const endKey = endDate.toISOString();

      // Use Mango to find todos that have active entries
      const todos = await safeDb.safeFind<Todo>({
        version: 'alpha3',
        active: { $exists: true, $ne: {} },
      });

      // Expand active entries into Activity objects and filter by date range
      const activities: Activity[] = [];
      for (const todo of todos) {
        for (const [from, to] of Object.entries(todo.active)) {
          // Check if this activity overlaps with the date range
          if (from >= startKey && from <= endKey) {
            activities.push({
              doc: todo,
              from,
              id: todo._id,
              to,
            });
          }
        }
      }

      // Sort by from date ascending
      activities.sort((a, b) => a.from.localeCompare(b.from));

      console.timeEnd(timerId);
      return activities;
    },
    enabled: !!safeDb && enabled,
  });
}
