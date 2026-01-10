/**
 * Hook for fetching audit entries by their IDs (from todo.auditLog arrays).
 * Used by the graph view to show agent activity messages for displayed todos.
 *
 * Optimized to:
 * 1. Check SSE cache first (entries already received via stream)
 * 2. Cache individual entries by ID (avoids refetching known entries)
 * 3. Only fetch missing IDs in batches
 */
import type { QueryClient } from '@tanstack/react-query';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import type { AuditLogAlpha1, Todo } from '@eddo/core-shared';

import { AUDIT_LOG_QUERY_KEY, type AuditEntry } from './use_audit_log_stream';
import { useAuth } from './use_auth';

interface AuditLogResponse {
  entries: AuditLogAlpha1[];
  hasMore: boolean;
}

/** Query key for individual audit entry */
const auditEntryKey = (id: string) => ['audit-entry', id] as const;

/** Fetch audit log entries by their document IDs */
async function fetchAuditByIds(token: string, auditIds: string[]): Promise<AuditLogAlpha1[]> {
  if (auditIds.length === 0) return [];

  const idsParam = encodeURIComponent(auditIds.join(','));
  const response = await fetch(`/api/audit-log?ids=${idsParam}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) throw new Error('Failed to fetch audit log');

  const data: AuditLogResponse = await response.json();
  return data.entries;
}

/** Extract all unique audit IDs from todos */
function extractAuditIds(todos: Todo[]): string[] {
  const auditIds = new Set<string>();
  for (const todo of todos) {
    if (todo.auditLog) {
      for (const auditId of todo.auditLog) {
        auditIds.add(auditId);
      }
    }
  }
  return Array.from(auditIds);
}

/** Check which audit IDs are already cached vs need fetching */
function partitionCachedAndMissing(
  auditIds: string[],
  queryClient: QueryClient,
): { cachedEntries: AuditLogAlpha1[]; missingIds: string[] } {
  const cached: AuditLogAlpha1[] = [];
  const missing: string[] = [];

  // Get SSE cache entries
  const sseEntries = queryClient.getQueryData<AuditEntry[]>(AUDIT_LOG_QUERY_KEY) || [];
  const sseEntriesById = new Map(sseEntries.map((e) => [e._id, e]));

  for (const id of auditIds) {
    // Check SSE cache first
    const fromSSE = sseEntriesById.get(id);
    if (fromSSE) {
      cached.push(fromSSE);
      continue;
    }

    // Check individual entry cache
    const fromCache = queryClient.getQueryData<AuditLogAlpha1>(auditEntryKey(id));
    if (fromCache) {
      cached.push(fromCache);
      continue;
    }

    missing.push(id);
  }

  return { cachedEntries: cached, missingIds: missing };
}

/** Combine and dedupe entries */
function mergeEntries(
  cachedEntries: AuditLogAlpha1[],
  fetchedEntries: AuditLogAlpha1[] | undefined,
): AuditLogAlpha1[] {
  const fetched = fetchedEntries ?? [];
  const byId = new Map<string, AuditLogAlpha1>();
  for (const entry of [...cachedEntries, ...fetched]) {
    byId.set(entry._id, entry);
  }
  return Array.from(byId.values());
}

interface UseAuditForTodosOptions {
  todos: Todo[];
  enabled?: boolean;
}

/**
 * Fetches audit entries referenced by the todos' auditLog arrays.
 * Checks SSE cache and individual entry cache before fetching.
 */
export function useAuditForTodos(options: UseAuditForTodosOptions) {
  const { todos, enabled = true } = options;
  const { authToken, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const auditIds = useMemo(() => extractAuditIds(todos), [todos]);

  const { cachedEntries, missingIds } = useMemo(
    () => partitionCachedAndMissing(auditIds, queryClient),
    [auditIds, queryClient],
  );

  const queryEnabled = enabled && isAuthenticated && !!authToken?.token && missingIds.length > 0;
  const missingIdsKey = useMemo(
    () => (missingIds.length > 0 ? [...missingIds].sort().join(',') : ''),
    [missingIds],
  );

  const {
    data: fetchedEntries,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['audit-by-ids', missingIdsKey],
    queryFn: async () => {
      const entries = await fetchAuditByIds(authToken!.token, missingIds);
      for (const entry of entries) {
        queryClient.setQueryData(auditEntryKey(entry._id), entry);
      }
      return entries;
    },
    enabled: queryEnabled,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
  });

  const allEntries = useMemo(
    () => mergeEntries(cachedEntries, fetchedEntries),
    [cachedEntries, fetchedEntries],
  );

  return {
    entries: allEntries,
    isLoading: isLoading && missingIds.length > 0,
    error: error instanceof Error ? error.message : null,
  };
}
