/**
 * React hook for tag management and autocomplete.
 * Uses MapReduce view for efficient aggregation, wrapped in TanStack Query for caching.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { usePouchDb } from '../pouch_db';
import { useDatabaseChanges } from './use_database_changes';

export interface TagsState {
  /** All unique tags from existing todos */
  allTags: string[];
  /** Whether tags are currently being loaded */
  isLoading: boolean;
  /** Error if tags failed to load */
  error: Error | null;
}

/** Result row from MapReduce query with group=true */
interface ViewRow {
  key: string;
  value: number;
}

/**
 * Hook for fetching all existing tags for autocomplete.
 * Uses MapReduce view (_design/tags/by_tag) with reduce for O(1) aggregation.
 * Results are cached via TanStack Query and invalidated on database changes.
 */
export const useTags = (): TagsState => {
  const { rawDb } = usePouchDb();
  const { changeCount } = useDatabaseChanges();
  const queryClient = useQueryClient();

  // Invalidate tags query when database changes
  useEffect(() => {
    if (changeCount > 0) {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    }
  }, [changeCount, queryClient]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['tags'],
    queryFn: async () => {
      // Query MapReduce view with reduce to get unique tags
      // group=true returns one row per unique tag with count
      const result = await rawDb!.query('tags/by_tag', {
        group: true,
        reduce: true,
      });

      // Extract just the tag names (keys), sorted alphabetically
      return (result.rows as ViewRow[])
        .map((row) => row.key)
        .filter((key) => key && key.trim())
        .sort();
    },
    enabled: !!rawDb,
    staleTime: Infinity, // Tags don't change often, rely on invalidation
  });

  return {
    allTags: data ?? [],
    isLoading,
    error: error as Error | null,
  };
};
