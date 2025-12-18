import { useQuery } from '@tanstack/react-query';

import type { Activity } from '@eddo/core-shared';
import { usePouchDb } from '../pouch_db';

interface UseActivitiesByWeekParams {
  startDate: Date;
  endDate: Date;
  enabled?: boolean;
}

/**
 * Custom hook to fetch activities (time tracking entries) for a specific week using TanStack Query.
 *
 * This hook uses TanStack Query for caching and state management, while
 * relying on PouchDB changes feed (via DatabaseChangesProvider) for
 * real-time invalidation.
 *
 * @param startDate - Start of the week (ISO date)
 * @param endDate - End of the week (ISO date)
 * @param enabled - Whether the query should run (default: true if safeDb exists)
 * @returns TanStack Query result with activities data, loading, and error states
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
      console.time('fetchActivities');
      const activities = await safeDb.safeQuery<Activity>('todos_by_active', 'byActive', {
        descending: false,
        endkey: endDate.toISOString(),
        include_docs: false,
        startkey: startDate.toISOString(),
      });
      console.timeEnd('fetchActivities');
      return activities;
    },
    enabled: !!safeDb && enabled,
  });
}
