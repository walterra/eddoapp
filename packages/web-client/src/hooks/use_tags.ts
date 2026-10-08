/**
 * React hook for tag management and autocomplete.
 * Uses a projected Mango query, wrapped in TanStack Query for caching.
 */
import { useQuery } from '@tanstack/react-query';

import { type Todo } from '@eddo/core-client';
import { usePouchDb } from '../pouch_db';

export interface TagsState {
  /** All unique tags from existing todos */
  allTags: string[];
  /** Whether tags are currently being loaded */
  isLoading: boolean;
  /** Error if tags failed to load */
  error: Error | null;
}

/**
 * Hook for fetching all existing tags for autocomplete.
 * Fetches only tag fields to avoid rebuilding a JavaScript MapReduce index after sync.
 * Results remain cached during sync and refresh after their stale interval.
 */
export const useTags = (): TagsState => {
  const { safeDb } = usePouchDb();
  const { data, isLoading, error } = useQuery({
    queryKey: ['tags'],
    queryFn: async () => {
      const todos = await safeDb.safeFind<Pick<Todo, 'tags'>>(
        { version: 'alpha4' },
        { fields: ['tags'], limit: 10000 },
      );
      const tags = todos
        .filter((todo) => Array.isArray(todo.tags))
        .flatMap((todo) => todo.tags)
        .filter((tag) => tag && tag.trim())
        .map((tag) => tag.trim());
      return [...new Set(tags)].sort();
    },
    enabled: !!safeDb,
    staleTime: 5 * 60 * 1000,
  });

  return {
    allTags: data ?? [],
    isLoading,
    error: error as Error | null,
  };
};
