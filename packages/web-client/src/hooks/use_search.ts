/**
 * Hook for searching todos via ES|QL.
 */

import { useCallback, useState } from 'react';

import {
  executeSearchRequest,
  executeStatsRequest,
  executeSuggestRequest,
  getAuthToken,
  type SearchParams,
  type SearchResponse,
  type SearchResult,
  type SearchStats,
  type Suggestion,
} from './use_search_api';

export type { SearchParams, SearchResponse, SearchResult, SearchStats, Suggestion };

/** Hook return type */
interface UseSearchReturn {
  clearResults: () => void;
  error: string | null;
  fetchStats: () => Promise<SearchStats | null>;
  getSuggestions: (
    prefix: string,
    field?: 'title' | 'context' | 'tags',
    limit?: number,
  ) => Promise<Suggestion[]>;
  isSearching: boolean;
  results: SearchResult[];
  searchTodos: (params: SearchParams) => Promise<SearchResponse | null>;
  stats: SearchStats | null;
}

/** Creates the searchTodos callback. */
function createSearchCallback(
  setIsSearching: (v: boolean) => void,
  setError: (v: string | null) => void,
  setResults: (v: SearchResult[]) => void,
): (params: SearchParams) => Promise<SearchResponse | null> {
  return async (params: SearchParams) => {
    const token = getAuthToken();
    if (!token) {
      setError('Not authenticated');
      return null;
    }
    setIsSearching(true);
    setError(null);
    try {
      const data = await executeSearchRequest(params, token);
      setResults(data.results);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      return null;
    } finally {
      setIsSearching(false);
    }
  };
}

/** Hook for todo search functionality. */
export function useSearch(): UseSearchReturn {
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [stats, setStats] = useState<SearchStats | null>(null);

  const searchTodos = useCallback(createSearchCallback(setIsSearching, setError, setResults), []);

  const getSuggestions = useCallback(
    async (prefix: string, field: 'title' | 'context' | 'tags' = 'title', limit = 10) => {
      const token = getAuthToken();
      return !token || prefix.length < 1
        ? []
        : executeSuggestRequest(prefix, field, limit, token).catch(() => []);
    },
    [],
  );

  const fetchStats = useCallback(async () => {
    const token = getAuthToken();
    if (!token) return null;
    try {
      const data = await executeStatsRequest(token);
      setStats(data);
      return data;
    } catch {
      return null;
    }
  }, []);

  const clearResults = useCallback(() => {
    setResults([]);
    setError(null);
  }, []);

  return {
    clearResults,
    error,
    fetchStats,
    getSuggestions,
    isSearching,
    results,
    searchTodos,
    stats,
  };
}
