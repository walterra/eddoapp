/**
 * Hook for fetching and managing audit log entries.
 * Combines initial fetch with real-time SSE updates, bucketed by source.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo } from 'react';

import type { AuditSource } from '@eddo/core-shared';

import {
  aggregateEntries,
  AUDIT_LOG_QUERY_KEY,
  createEmptyBuckets,
  filterEntriesBySource,
  useAuditLogStream,
  type AuditEntriesBySource,
  type AuditEntry,
} from './use_audit_log_stream';
import { useAuth } from './use_auth';

/** API response for audit log by source */
interface AuditLogBySourceResponse {
  entriesBySource: AuditEntriesBySource;
}

interface UseAuditLogOptions {
  /** Enable/disable fetching and streaming. Defaults to true. */
  enabled?: boolean;
  /** Number of entries per source to fetch initially */
  limitPerSource?: number;
}

/** Fetch audit log entries grouped by source from API */
async function fetchAuditLogBySource(
  token: string,
  limitPerSource: number,
): Promise<AuditLogBySourceResponse> {
  const response = await fetch(`/api/audit-log/by-source?limitPerSource=${limitPerSource}`, {
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

/** Merge initial data with SSE stream updates, keeping newest entries */
function mergeBuckets(
  initial: AuditEntriesBySource,
  stream: AuditEntriesBySource,
  maxPerSource: number,
): AuditEntriesBySource {
  const sources: AuditSource[] = [
    'web',
    'mcp',
    'telegram',
    'github-sync',
    'rss-sync',
    'email-sync',
  ];

  const result = createEmptyBuckets();

  for (const source of sources) {
    const initialEntries = initial[source] || [];
    const streamEntries = stream[source] || [];

    // Combine, dedupe by _id, sort by timestamp descending, limit
    const combined = [...streamEntries, ...initialEntries];
    const seen = new Set<string>();
    const deduped: AuditEntry[] = [];

    for (const entry of combined) {
      if (!seen.has(entry._id)) {
        seen.add(entry._id);
        deduped.push(entry);
      }
    }

    result[source] = deduped
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, maxPerSource);
  }

  return result;
}

/**
 * Fetches initial audit log entries (bucketed by source) and subscribes to real-time updates.
 */
export function useAuditLog(options: UseAuditLogOptions = {}) {
  const { enabled = true, limitPerSource = 20 } = options;
  const { authToken } = useAuth();
  const queryClient = useQueryClient();
  const queryEnabled = useQueryEnabled(enabled);

  // Fetch initial data bucketed by source
  const { data, isLoading, error, refetch } = useQuery<AuditLogBySourceResponse>({
    queryKey: [...AUDIT_LOG_QUERY_KEY, 'initial-by-source'],
    queryFn: () => fetchAuditLogBySource(authToken!.token, limitPerSource),
    enabled: queryEnabled,
    staleTime: 1000 * 60,
  });

  // Sync initial data to stream cache
  useEffect(() => {
    if (data?.entriesBySource) {
      queryClient.setQueryData<AuditEntriesBySource>(AUDIT_LOG_QUERY_KEY, (existingStream) => {
        // Merge with any existing SSE entries
        const stream = existingStream || createEmptyBuckets();
        return mergeBuckets(data.entriesBySource, stream, limitPerSource);
      });
    }
  }, [data, queryClient, limitPerSource]);

  // Connect to SSE stream
  const streamState = useAuditLogStream({
    enabled: queryEnabled,
    maxEntriesPerSource: limitPerSource,
  });

  // Subscribe to stream cache reactively
  const streamData = useQuery<AuditEntriesBySource>({
    queryKey: AUDIT_LOG_QUERY_KEY,
    queryFn: () => createEmptyBuckets(),
    enabled: false, // Never fetch, only read from cache
    staleTime: Infinity,
  });

  // Use merged data from cache
  const entriesBySource = streamData.data || data?.entriesBySource || createEmptyBuckets();

  // Compute flat entries list (for backward compatibility or "all" filter)
  const entries = useMemo(() => aggregateEntries(entriesBySource), [entriesBySource]);

  const refresh = useCallback(() => refetch(), [refetch]);

  return {
    /** Entries grouped by source */
    entriesBySource,
    /** All entries aggregated and sorted (newest first) */
    entries,
    /** Loading state */
    isLoading,
    /** Error message if fetch failed */
    error: getErrorMessage(error),
    /** SSE connection status */
    isConnected: streamState.isConnected,
    /** SSE connection error */
    connectionError: streamState.error,
    /** Trigger a refresh of initial data */
    refresh,
    /** Reconnect SSE stream */
    reconnect: streamState.reconnect,
    /** Helper to filter entries by source with limit */
    getFilteredEntries: (source: AuditSource | 'all', limit = 20) =>
      filterEntriesBySource(entriesBySource, source, limit),
  };
}
