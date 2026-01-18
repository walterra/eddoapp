/**
 * API functions for todo search.
 */

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

/** Get auth token from localStorage */
export function getAuthToken(): string | null {
  const stored = localStorage.getItem('authToken');
  if (!stored) return null;
  try {
    return JSON.parse(stored).token ?? null;
  } catch {
    return null;
  }
}

/** Executes search API request. */
export async function executeSearchRequest(
  params: SearchParams,
  token: string,
): Promise<SearchResponse> {
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
export async function executeSuggestRequest(
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
export async function executeStatsRequest(token: string): Promise<SearchStats | null> {
  const response = await fetch(`${API_BASE}/stats`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.ok ? response.json() : null;
}
