/**
 * React hook for tag management and autocomplete.
 * Uses Mango query with tags index for efficient tag extraction.
 */
import { type Todo } from '@eddo/core-client';
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
 * Hook for fetching all existing tags for autocomplete.
 * Uses Mango query with fields projection to only fetch tags, not full documents.
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

        // Query alpha3 documents, fetching only the tags field
        // PouchDB-find doesn't support $gt: [] for arrays, so we filter client-side
        const todos = await safeDb.safeFind<Pick<Todo, 'tags'>>(
          { version: 'alpha3' },
          { fields: ['tags'] },
        );

        // Extract unique tags from results, filtering out malformed data
        const tagSet = new Set<string>();
        const validTags = todos
          .filter((todo) => Array.isArray(todo.tags))
          .flatMap((todo) => todo.tags!)
          .filter((tag) => tag && tag.trim());
        validTags.forEach((tag) => tagSet.add(tag.trim()));

        setAllTags(Array.from(tagSet).sort());
      } catch (err) {
        console.error('Failed to fetch tags:', err);
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTags();
  }, [safeDb, changeCount]);

  return {
    allTags,
    isLoading,
    error,
  };
};
