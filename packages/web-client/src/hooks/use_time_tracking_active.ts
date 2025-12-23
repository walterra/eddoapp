import { useQuery } from '@tanstack/react-query';

import { usePouchDb } from '../pouch_db';

interface UseTimeTrackingActiveParams {
  enabled?: boolean;
}

/**
 * Custom hook to fetch currently active time tracking entries using TanStack Query.
 *
 * This hook uses TanStack Query for caching and state management, while
 * relying on PouchDB changes feed (via DatabaseChangesProvider) for
 * real-time invalidation.
 *
 * @param enabled - Whether the query should run (default: true if safeDb exists)
 * @returns TanStack Query result with active todo IDs, loading, and error states
 */
export function useTimeTrackingActive({ enabled = true }: UseTimeTrackingActiveParams = {}) {
  const { safeDb } = usePouchDb();

  return useQuery({
    queryKey: ['todos', 'byTimeTrackingActive'],
    queryFn: async () => {
      console.time('fetchTimeTrackingActive');
      // View emits null, we only need the doc IDs
      // Use include_docs to get doc._id from each row
      const results = await safeDb.safeQuery<{ _id: string }>(
        'todos_by_time_tracking_active',
        'byTimeTrackingActive',
        {
          key: null,
          include_docs: true,
        },
      );
      const ids = results.map((d) => d._id);
      console.timeEnd('fetchTimeTrackingActive');
      return ids;
    },
    enabled: !!safeDb && enabled,
  });
}
