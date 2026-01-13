import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import type { Activity, Todo } from '@eddo/core-shared';
import { usePouchDb } from '../pouch_db';

/** Maximum number of activity range queries to keep in cache */
const MAX_CACHED_RANGES = 5;

/** Cleans up old activity queries to prevent memory bloat */
function cleanupOldActivityQueries(queryClient: ReturnType<typeof useQueryClient>): void {
  const allQueries = queryClient.getQueriesData<Activity[]>({
    queryKey: ['activities', 'byActive'],
  });

  if (allQueries.length <= MAX_CACHED_RANGES) return;

  const queryStates = allQueries
    .map(([queryKey]) => ({
      queryKey,
      state: queryClient.getQueryState(queryKey),
    }))
    .filter((q) => q.state)
    .sort((a, b) => (a.state!.dataUpdatedAt || 0) - (b.state!.dataUpdatedAt || 0));

  const toRemove = queryStates.slice(0, queryStates.length - MAX_CACHED_RANGES);
  toRemove.forEach(({ queryKey }) => queryClient.removeQueries({ queryKey, exact: true }));
}

interface UseActivitiesByWeekParams {
  /** Start date in YYYY-MM-DD format */
  startDate: string;
  /** End date in YYYY-MM-DD format */
  endDate: string;
  enabled?: boolean;
}

/**
 * Fetches activities (time tracking entries) for a date range.
 * Uses Mango query to find todos with active entries, then expands and filters client-side.
 * Uses date-only strings (YYYY-MM-DD) for comparison to avoid timezone issues.
 *
 * @param startDate - Start date in YYYY-MM-DD format
 * @param endDate - End date in YYYY-MM-DD format
 * @param enabled - Whether the query should run
 * @returns TanStack Query result with activities data
 */
export function useActivitiesByWeek({
  startDate,
  endDate,
  enabled = true,
}: UseActivitiesByWeekParams) {
  const { safeDb } = usePouchDb();
  const queryClient = useQueryClient();

  // Clean up old activity queries to prevent memory bloat
  useEffect(() => {
    cleanupOldActivityQueries(queryClient);
  }, [queryClient, startDate, endDate]);

  return useQuery({
    queryKey: ['activities', 'byActive', startDate, endDate],
    queryFn: async () => {
      const timerId = `fetchActivities-${Date.now()}`;
      console.time(timerId);

      // Use date-only prefix for comparison (avoids timezone issues)
      const startKey = startDate;
      const endKey = endDate + 'T\uffff';

      // Use Mango to find todos that have active entries
      // Note: PouchDB defaults to limit=25, so we set a high limit
      const todos = await safeDb.safeFind<Todo>(
        {
          version: 'alpha3',
          active: { $exists: true, $ne: {} },
        },
        { limit: 10000 },
      );

      // Expand active entries into Activity objects and filter by date range
      const activities: Activity[] = [];
      for (const todo of todos) {
        for (const [from, to] of Object.entries(todo.active)) {
          // Check if this activity overlaps with the date range using date prefix comparison
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
