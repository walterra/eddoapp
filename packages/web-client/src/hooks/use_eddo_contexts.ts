/**
 * React hook for context management and filtering.
 * Uses a projected Mango query, wrapped in TanStack Query for caching.
 */
import { useQuery } from '@tanstack/react-query';

import { type Todo } from '@eddo/core-client';
import { usePouchDb } from '../pouch_db';

export interface EddoContextsState {
  /** All unique contexts from existing todos */
  allContexts: string[];
  /** Whether contexts are currently being loaded */
  isLoading: boolean;
  /** Error if contexts failed to load */
  error: Error | null;
}

/**
 * Hook for fetching all existing contexts for filtering.
 * Fetches only context fields to avoid rebuilding a JavaScript MapReduce index after sync.
 * Results remain cached during sync and refresh after their stale interval.
 */
export const useEddoContexts = (): EddoContextsState => {
  const { safeDb } = usePouchDb();
  const { data, isLoading, error } = useQuery({
    queryKey: ['contexts'],
    queryFn: async () => {
      const todos = await safeDb.safeFind<Pick<Todo, 'context'>>(
        { version: 'alpha4' },
        { fields: ['context'], limit: 10000 },
      );
      const contexts = todos
        .map((todo) => todo.context)
        .filter((context) => context && context.trim())
        .map((context) => context.trim());
      return [...new Set(contexts)].sort();
    },
    enabled: !!safeDb,
    staleTime: 5 * 60 * 1000,
  });

  return {
    allContexts: data ?? [],
    isLoading,
    error: error as Error | null,
  };
};
