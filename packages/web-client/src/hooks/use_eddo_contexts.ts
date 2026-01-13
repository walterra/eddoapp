/**
 * React hook for context management and filtering.
 * Uses Mango query with context index for efficient context extraction.
 */
import { type Todo } from '@eddo/core-client';
import { useEffect, useState } from 'react';

import { usePouchDb } from '../pouch_db';
import { useDatabaseChanges } from './use_database_changes';

export interface EddoContextsState {
  allContexts: string[];
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook for fetching all existing contexts for filtering.
 * Uses Mango query with fields projection to only fetch context, not full documents.
 */
export const useEddoContexts = (): EddoContextsState => {
  const { safeDb } = usePouchDb();
  const { changeCount } = useDatabaseChanges();
  const [allContexts, setAllContexts] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchContexts = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Query alpha3 documents, fetching only the context field
        const todos = await safeDb.safeFind<Pick<Todo, 'context'>>(
          { version: 'alpha3' },
          { fields: ['context'] },
        );

        // Extract unique contexts from results
        const contextSet = new Set<string>();
        for (const todo of todos) {
          if (todo.context && todo.context.trim()) {
            contextSet.add(todo.context.trim());
          }
        }

        setAllContexts(Array.from(contextSet).sort());
      } catch (err) {
        console.error('Failed to fetch contexts:', err);
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchContexts();
  }, [safeDb, changeCount]);

  return {
    allContexts,
    isLoading,
    error,
  };
};
