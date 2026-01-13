/**
 * React hook for context management and filtering.
 * Uses MapReduce view for efficient aggregation, wrapped in TanStack Query for caching.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { usePouchDb } from '../pouch_db';
import { useDatabaseChanges } from './use_database_changes';

export interface EddoContextsState {
  /** All unique contexts from existing todos */
  allContexts: string[];
  /** Whether contexts are currently being loaded */
  isLoading: boolean;
  /** Error if contexts failed to load */
  error: Error | null;
}

/** Result row from MapReduce query with group=true */
interface ViewRow {
  key: string;
  value: number;
}

/**
 * Hook for fetching all existing contexts for filtering.
 * Uses MapReduce view (_design/contexts/by_context) with reduce for O(1) aggregation.
 * Results are cached via TanStack Query and invalidated on database changes.
 */
export const useEddoContexts = (): EddoContextsState => {
  const { rawDb } = usePouchDb();
  const { changeCount } = useDatabaseChanges();
  const queryClient = useQueryClient();

  // Invalidate contexts query when database changes
  useEffect(() => {
    if (changeCount > 0) {
      queryClient.invalidateQueries({ queryKey: ['contexts'] });
    }
  }, [changeCount, queryClient]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['contexts'],
    queryFn: async () => {
      // Query MapReduce view with reduce to get unique contexts
      // group=true returns one row per unique context with count
      const result = await rawDb!.query('contexts/by_context', {
        group: true,
        reduce: true,
      });

      // Extract just the context names (keys), sorted alphabetically
      return (result.rows as ViewRow[])
        .map((row) => row.key)
        .filter((key) => key && key.trim())
        .sort();
    },
    enabled: !!rawDb,
    staleTime: Infinity, // Contexts don't change often, rely on invalidation
  });

  return {
    allContexts: data ?? [],
    isLoading,
    error: error as Error | null,
  };
};
