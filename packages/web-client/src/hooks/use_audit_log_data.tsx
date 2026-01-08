/**
 * Hook for fetching and managing audit log entries.
 * Combines initial fetch with real-time SSE updates.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';

import type { AuditLogAlpha1 } from '@eddo/core-shared';

import { AUDIT_LOG_QUERY_KEY, useAuditLogStream, type AuditEntry } from './use_audit_log_stream';
import { useAuth } from './use_auth';

/** API response for audit log list */
interface AuditLogResponse {
  entries: AuditLogAlpha1[];
  hasMore: boolean;
}

interface UseAuditLogOptions {
  /** Enable/disable fetching and streaming. Defaults to true. */
  enabled?: boolean;
  /** Initial number of entries to fetch */
  initialLimit?: number;
}

/** Fetch audit log entries from API */
async function fetchAuditLog(token: string, limit: number): Promise<AuditLogResponse> {
  const response = await fetch(`/api/audit-log?limit=${limit}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error('Failed to fetch audit log');
  return response.json();
}

/** Determine if query should be enabled */
function useQueryEnabled(enabled: boolean): boolean {
  const { authToken, isAuthenticated } = useAuth();
  return enabled && isAuthenticated && !!authToken?.token;
}

/** Get error message from error object */
function getErrorMessage(error: unknown): string | null {
  return error instanceof Error ? error.message : null;
}

/**
 * Fetches initial audit log entries and subscribes to real-time updates.
 */
export function useAuditLog(options: UseAuditLogOptions = {}) {
  const { enabled = true, initialLimit = 20 } = options;
  const { authToken } = useAuth();
  const queryClient = useQueryClient();
  const queryEnabled = useQueryEnabled(enabled);

  const { data, isLoading, error, refetch } = useQuery<AuditLogResponse>({
    queryKey: [...AUDIT_LOG_QUERY_KEY, 'initial'],
    queryFn: () => fetchAuditLog(authToken!.token, initialLimit),
    enabled: queryEnabled,
    staleTime: 1000 * 60,
  });

  // Sync initial data to stream cache for SSE updates to merge with
  useEffect(() => {
    if (data?.entries) {
      queryClient.setQueryData<AuditEntry[]>(AUDIT_LOG_QUERY_KEY, data.entries);
    }
  }, [data, queryClient]);

  const streamState = useAuditLogStream({ enabled: queryEnabled });

  // Subscribe to stream cache reactively
  const streamEntries = useQuery<AuditEntry[]>({
    queryKey: AUDIT_LOG_QUERY_KEY,
    queryFn: () => [],
    enabled: false, // Never fetch, only read from cache
    staleTime: Infinity,
  });

  // Use stream cache if populated, otherwise fall back to initial data
  const entries = streamEntries.data ?? data?.entries ?? [];
  const refresh = useCallback(() => refetch(), [refetch]);

  return {
    entries,
    isLoading,
    error: getErrorMessage(error),
    hasMore: data?.hasMore ?? false,
    isConnected: streamState.isConnected,
    connectionError: streamState.error,
    refresh,
    reconnect: streamState.reconnect,
  };
}
