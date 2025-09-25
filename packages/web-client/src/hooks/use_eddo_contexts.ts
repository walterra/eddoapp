import type { Todo } from '@eddo/core-shared';
import { useEffect, useState } from 'react';

import { usePouchDb } from '../pouch_db';
import { useDatabaseChanges } from './use_database_changes';

export interface EddoContextsState {
  allContexts: string[];
  isLoading: boolean;
  error: Error | null;
}

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

        const todos = await safeDb.safeAllDocs<Todo>();

        const contextSet = new Set<string>();

        todos.forEach((todo) => {
          if (todo.context && todo.context.trim()) {
            contextSet.add(todo.context.trim());
          }
        });

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
