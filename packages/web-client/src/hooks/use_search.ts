/**
 * Hook for searching todos via ES|QL.
 */

import { useCallback, useState } from 'react';

const API_BASE = '/api/search';

/** Search result item */
export interface SearchResult {
  todoId: string;
  title: string;
  description: string;
  context: string;
  tags: string[] | null;
  due: string | null;
  completed: string | null;
  _score: number;
}

/** Search response */
export interface SearchResponse {
  query: string;
  total: number;
  results: SearchResult[];
}

/** Search parameters */
export interface SearchParams {
  query: string;
  limit?: number;
  includeCompleted?: boolean;
  context?: string;
  tags?: string[];
}

/** Search stats response */
export interface SearchStats {
  username: string;
  indices: {
    todos: { index: string; documentCount: number };
    audit: { index: string; documentCount: number };
  };
}

/** Suggestion item */
export interface Suggestion {
  tag?: string;
  context?: string;
  todoId?: string;
  title?: string;
  count?: number;
}

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

/** Hook for todo search functionality. */
export function useSearch(): UseSearchReturn {
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [stats, setStats] = useState<SearchStats | null>(null);

  const searchTodos = useCallback(async (params: SearchParams) => {
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
  }, []);

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

/** Get auth token from localStorage */
function getAuthToken(): string | null {
  const stored = localStorage.getItem('authToken');
  if (!stored) return null;
  try {
    return JSON.parse(stored).token ?? null;
  } catch {
    return null;
  }
}

/** Executes search API request. */
async function executeSearchRequest(params: SearchParams, token: string): Promise<SearchResponse> {
  const response = await fetch(`${API_BASE}/todos`, {
    body: JSON.stringify({
      context: params.context,
      includeCompleted: params.includeCompleted ?? true,
      limit: params.limit ?? 20,
      query: params.query,
      tags: params.tags,
    }),
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    method: 'POST',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error ?? `Search failed: ${response.status}`);
  }

  return response.json();
}

/** Executes suggest API request. */
async function executeSuggestRequest(
  prefix: string,
  field: string,
  limit: number,
  token: string,
): Promise<Suggestion[]> {
  const params = new URLSearchParams({ field, limit: String(limit), prefix });
  const response = await fetch(`${API_BASE}/suggest?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.ok ? (await response.json()).suggestions : [];
}

/** Executes stats API request. */
async function executeStatsRequest(token: string): Promise<SearchStats | null> {
  const response = await fetch(`${API_BASE}/stats`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.ok ? response.json() : null;
}
