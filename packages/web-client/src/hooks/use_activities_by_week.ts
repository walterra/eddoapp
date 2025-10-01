import { useQuery } from '@tanstack/react-query';

import type { Activity } from '@eddo/core-shared';
import { usePouchDb } from '../pouch_db_types';

interface UseActivitiesByWeekParams {
  startDate: Date;
  endDate: Date;
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
 * @returns TanStack Query result with activities data, loading, and error states
 */
export function useActivitiesByWeek({
  startDate,
  endDate,
}: UseActivitiesByWeekParams) {
  const { safeDb } = usePouchDb();

  return useQuery({
    queryKey: [
      'activities',
      'byActive',
      startDate.toISOString(),
      endDate.toISOString(),
    ],
    queryFn: async () => {
      console.time('fetchActivities');
      const activities = await safeDb.safeQuery<Activity>('todos', 'byActive', {
        descending: false,
        endkey: endDate.toISOString(),
        include_docs: false,
        startkey: startDate.toISOString(),
      });
      console.timeEnd('fetchActivities');
      return activities;
    },
    enabled: !!safeDb,
  });
}
