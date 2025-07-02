/**
 * React hook for tag management and autocomplete
 */
import { type Todo } from '@eddo/shared';
import { useEffect, useState } from 'react';

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

/**
 * Hook for fetching all existing tags for autocomplete
 */
export const useTags = (): TagsState => {
  const { safeDb } = usePouchDb();
  const { changeCount } = useDatabaseChanges();
  const [allTags, setAllTags] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchTags = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const todos = await safeDb.safeAllDocs<Todo>();

        const tagSet = new Set<string>();

        todos.forEach((todo) => {
          if (todo.tags && Array.isArray(todo.tags)) {
            todo.tags.forEach((tag) => {
              if (tag.trim()) {
                tagSet.add(tag.trim());
              }
            });
          }
        });

        setAllTags(Array.from(tagSet).sort());
      } catch (err) {
        console.error('Failed to fetch tags:', err);
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTags();
  }, [safeDb, changeCount]); // Re-fetch when database changes

  return {
    allTags,
    isLoading,
    error,
  };
};
