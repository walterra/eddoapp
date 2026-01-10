/**
 * Hook for fetching audit entries filtered by specific todo IDs.
 * Used by the graph view to show agent activity messages for displayed todos.
 */
import { useQuery } from '@tanstack/react-query';

import type { AuditLogAlpha1 } from '@eddo/core-shared';

import { useAuth } from './use_auth';

interface AuditLogResponse {
  entries: AuditLogAlpha1[];
  hasMore: boolean;
}

/** Fetch audit log entries for specific entity IDs */
async function fetchAuditForTodos(
  token: string,
  todoIds: string[],
  limit: number,
): Promise<AuditLogAlpha1[]> {
  if (todoIds.length === 0) return [];

  // Use the new entityIds filter parameter
  const entityIdsParam = encodeURIComponent(todoIds.join(','));
  const response = await fetch(`/api/audit-log?limit=${limit}&entityIds=${entityIdsParam}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) throw new Error('Failed to fetch audit log');

  const data: AuditLogResponse = await response.json();
  return data.entries;
}

interface UseAuditForTodosOptions {
  /** Todo IDs to fetch audit entries for */
  todoIds: string[];
  /** Enable/disable fetching */
  enabled?: boolean;
  /** Maximum entries to fetch (default: 100) */
  limit?: number;
}

/**
 * Fetches audit entries that relate to the specified todos.
 * Uses server-side filtering by entityId for efficiency.
 */
export function useAuditForTodos(options: UseAuditForTodosOptions) {
  const { todoIds, enabled = true, limit = 100 } = options;
  const { authToken, isAuthenticated } = useAuth();

  const queryEnabled = enabled && isAuthenticated && !!authToken?.token && todoIds.length > 0;

  // Create a stable key from sorted todo IDs (truncate if too many to keep key reasonable)
  const todoIdsKey =
    todoIds.length > 50
      ? `${todoIds.length}-todos-${todoIds.slice(0, 10).sort().join(',')}`
      : [...todoIds].sort().join(',');

  const { data, isLoading, error } = useQuery({
    queryKey: ['audit-for-todos', todoIdsKey, limit],
    queryFn: () => fetchAuditForTodos(authToken!.token, todoIds, limit),
    enabled: queryEnabled,
    staleTime: 1000 * 30, // 30 seconds
  });

  return {
    entries: data ?? [],
    isLoading,
    error: error instanceof Error ? error.message : null,
  };
}
