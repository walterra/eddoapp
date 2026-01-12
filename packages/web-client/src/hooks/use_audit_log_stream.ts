/**
 * Hook for real-time audit log updates via Server-Sent Events.
 * Listens to the SSE endpoint and maintains audit entries bucketed by source in React Query cache.
 */
import type { QueryClient } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { AuditLogAlpha1, AuditSource } from '@eddo/core-shared';

import { useAuth } from './use_auth';

/** SSE connection state */
export interface AuditStreamState {
  isConnected: boolean;
  lastEventId: string | null;
  error: string | null;
}

const INITIAL_STATE: AuditStreamState = {
  isConnected: false,
  lastEventId: null,
  error: null,
};

/** Audit log entry from the API */
export type AuditEntry = AuditLogAlpha1;

/** Entries grouped by source */
export type AuditEntriesBySource = Record<AuditSource, AuditEntry[]>;

/** Query key for audit log entries (bucketed by source) */
export const AUDIT_LOG_QUERY_KEY = ['audit-log'] as const;

/** Default max entries per source bucket */
const DEFAULT_MAX_ENTRIES_PER_SOURCE = 20;

/** Debounce delay for batching SSE updates (ms) */
const SSE_UPDATE_DEBOUNCE_MS = 100;

/** All audit sources */
const AUDIT_SOURCES: readonly AuditSource[] = [
  'web',
  'mcp',
  'telegram',
  'github-sync',
  'rss-sync',
  'email-sync',
] as const;

/** Create empty buckets for all sources */
function createEmptyBuckets(): AuditEntriesBySource {
  return {
    web: [],
    mcp: [],
    telegram: [],
    'github-sync': [],
    'rss-sync': [],
    'email-sync': [],
  };
}

interface UseAuditLogStreamOptions {
  /** Enable/disable the stream. Defaults to true when authenticated. */
  enabled?: boolean;
  /** Maximum number of entries per source bucket */
  maxEntriesPerSource?: number;
  /** Callback when a new entry is received */
  onEntry?: (entry: AuditEntry) => void;
}

/** Build SSE URL with token */
function buildAuditSSEUrl(token: string): string {
  return `/api/audit-log/stream?token=${encodeURIComponent(token)}`;
}

/** Create connected event handler */
function createConnectedHandler(
  setState: React.Dispatch<React.SetStateAction<AuditStreamState>>,
): (event: MessageEvent) => void {
  return (event) => {
    console.log('[AuditStream] Connected:', event.data);
    setState({ isConnected: true, lastEventId: event.lastEventId || null, error: null });
  };
}

/** Add entry to appropriate bucket, maintaining max size */
function addEntryToBuckets(
  buckets: AuditEntriesBySource,
  entry: AuditEntry,
  maxPerSource: number,
): AuditEntriesBySource {
  const source = entry.source;
  if (!AUDIT_SOURCES.includes(source)) {
    return buckets;
  }

  const currentBucket = buckets[source] || [];
  const newBucket = [entry, ...currentBucket].slice(0, maxPerSource);

  return {
    ...buckets,
    [source]: newBucket,
  };
}

/** Pending entries buffer for debounced updates */
interface PendingEntriesBuffer {
  entries: AuditEntry[];
  lastEventId: string | null;
  timer: ReturnType<typeof setTimeout> | null;
}

/** Options for flushing pending entries */
interface FlushOptions {
  buffer: PendingEntriesBuffer;
  queryClient: QueryClient;
  maxEntriesPerSource: number;
  setState: React.Dispatch<React.SetStateAction<AuditStreamState>>;
  onEntry?: (entry: AuditEntry) => void;
}

/** Flush pending entries to query cache */
function flushPendingEntries(options: FlushOptions): void {
  const { buffer, queryClient, maxEntriesPerSource, setState, onEntry } = options;
  if (buffer.entries.length === 0) return;

  const entriesToFlush = [...buffer.entries];
  const lastEventId = buffer.lastEventId;

  // Clear the buffer
  buffer.entries = [];
  buffer.timer = null;

  // Apply all pending entries in one batch update
  queryClient.setQueryData<AuditEntriesBySource>(AUDIT_LOG_QUERY_KEY, (old) => {
    let currentBuckets = old || createEmptyBuckets();
    for (const entry of entriesToFlush) {
      currentBuckets = addEntryToBuckets(currentBuckets, entry, maxEntriesPerSource);
    }
    return currentBuckets;
  });

  setState((prev) => ({ ...prev, lastEventId: lastEventId || prev.lastEventId }));

  // Call onEntry for each entry (if provided)
  if (onEntry) {
    for (const entry of entriesToFlush) {
      onEntry(entry);
    }
  }
}

/** Options for creating entry handler */
interface EntryHandlerOptions {
  queryClient: QueryClient;
  maxEntriesPerSource: number;
  setState: React.Dispatch<React.SetStateAction<AuditStreamState>>;
  pendingBuffer: PendingEntriesBuffer;
  onEntry?: (entry: AuditEntry) => void;
}

/** Create debounced audit entry handler that batches updates */
function createEntryHandler(options: EntryHandlerOptions): (event: MessageEvent) => void {
  const { queryClient, maxEntriesPerSource, setState, pendingBuffer, onEntry } = options;
  return (event) => {
    try {
      const entry = JSON.parse(event.data) as AuditEntry;

      // Add to pending buffer
      pendingBuffer.entries.push(entry);
      pendingBuffer.lastEventId = event.lastEventId || pendingBuffer.lastEventId;

      // Clear existing timer and set new one
      if (pendingBuffer.timer) {
        clearTimeout(pendingBuffer.timer);
      }

      pendingBuffer.timer = setTimeout(() => {
        flushPendingEntries({
          buffer: pendingBuffer,
          queryClient,
          maxEntriesPerSource,
          setState,
          onEntry,
        });
      }, SSE_UPDATE_DEBOUNCE_MS);
    } catch (err) {
      console.error('[AuditStream] Failed to parse entry:', err);
    }
  };
}

/** Create error handler */
function createErrorHandler(
  setState: React.Dispatch<React.SetStateAction<AuditStreamState>>,
): () => void {
  return () => {
    console.error('[AuditStream] Connection error');
    setState((prev) => ({ ...prev, isConnected: false, error: 'Connection lost' }));
  };
}

/** Refs used by the SSE stream hook */
interface StreamRefs {
  eventSource: React.MutableRefObject<EventSource | null>;
  pendingBuffer: React.MutableRefObject<PendingEntriesBuffer>;
}

/** Options for cleanup function */
interface CleanupOptions {
  refs: StreamRefs;
  queryClient: QueryClient;
  maxEntriesPerSource: number;
  setState: React.Dispatch<React.SetStateAction<AuditStreamState>>;
}

/** Create cleanup function for SSE connection */
function createCleanup(options: CleanupOptions): () => void {
  const { refs, queryClient, maxEntriesPerSource, setState } = options;
  return () => {
    if (refs.eventSource.current) {
      refs.eventSource.current.close();
      refs.eventSource.current = null;
    }
    if (refs.pendingBuffer.current.timer) {
      clearTimeout(refs.pendingBuffer.current.timer);
      refs.pendingBuffer.current.timer = null;
    }
    if (refs.pendingBuffer.current.entries.length > 0) {
      flushPendingEntries({
        buffer: refs.pendingBuffer.current,
        queryClient,
        maxEntriesPerSource,
        setState,
      });
    }
  };
}

/** Options for connect function */
interface ConnectOptions extends CleanupOptions {
  token: string;
  cleanup: () => void;
  onEntry?: (entry: AuditEntry) => void;
}

/** Create connect function for SSE connection */
function createConnect(options: ConnectOptions): () => void {
  const { refs, queryClient, maxEntriesPerSource, setState, token, cleanup, onEntry } = options;
  return () => {
    cleanup();
    refs.pendingBuffer.current = { entries: [], lastEventId: null, timer: null };
    const eventSource = new EventSource(buildAuditSSEUrl(token));
    refs.eventSource.current = eventSource;
    eventSource.addEventListener('connected', createConnectedHandler(setState));
    eventSource.addEventListener(
      'audit-entry',
      createEntryHandler({
        queryClient,
        maxEntriesPerSource,
        setState,
        pendingBuffer: refs.pendingBuffer.current,
        onEntry,
      }),
    );
    eventSource.addEventListener('heartbeat', () => {});
    eventSource.onerror = createErrorHandler(setState);
    eventSource.onopen = () => setState((prev) => ({ ...prev, isConnected: true, error: null }));
  };
}

/**
 * Subscribes to real-time audit log updates via SSE.
 * Maintains entries bucketed by source in React Query cache under ['audit-log'].
 */
export function useAuditLogStream(options: UseAuditLogStreamOptions = {}) {
  const { enabled = true, maxEntriesPerSource = DEFAULT_MAX_ENTRIES_PER_SOURCE, onEntry } = options;
  const { authToken, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuditStreamState>(INITIAL_STATE);

  const refs: StreamRefs = {
    eventSource: useRef<EventSource | null>(null),
    pendingBuffer: useRef<PendingEntriesBuffer>({ entries: [], lastEventId: null, timer: null }),
  };

  const cleanupOpts: CleanupOptions = { refs, queryClient, maxEntriesPerSource, setState };
  const cleanup = useCallback(
    () => createCleanup(cleanupOpts)(),
    [queryClient, maxEntriesPerSource],
  );

  const connect = useCallback(() => {
    if (!authToken?.token || !enabled) return;
    createConnect({ ...cleanupOpts, token: authToken.token, cleanup, onEntry })();
  }, [authToken?.token, enabled, cleanup, queryClient, maxEntriesPerSource, onEntry]);

  useEffect(() => {
    if (isAuthenticated && enabled) connect();
    else {
      cleanup();
      setState(INITIAL_STATE);
    }
    return cleanup;
  }, [isAuthenticated, enabled, connect, cleanup]);

  return { ...state, reconnect: connect };
}

/**
 * Hook to get audit log entries bucketed by source from cache.
 */
export function useAuditLogEntriesBySource(): AuditEntriesBySource {
  const queryClient = useQueryClient();
  return (
    queryClient.getQueryData<AuditEntriesBySource>(AUDIT_LOG_QUERY_KEY) || createEmptyBuckets()
  );
}

/**
 * Helper to aggregate all buckets into a flat sorted array
 * @param buckets - Entries grouped by source
 * @returns All entries sorted by timestamp (newest first)
 */
export function aggregateEntries(buckets: AuditEntriesBySource): AuditEntry[] {
  const allEntries = Object.values(buckets).flat();
  return allEntries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

/**
 * Helper to filter entries by source and limit results
 * @param buckets - Entries grouped by source
 * @param source - Source to filter by, or 'all' for all sources
 * @param limit - Maximum entries to return
 * @returns Filtered and limited entries sorted by timestamp
 */
export function filterEntriesBySource(
  buckets: AuditEntriesBySource,
  source: AuditSource | 'all',
  limit: number = 20,
): AuditEntry[] {
  if (source === 'all') {
    return aggregateEntries(buckets).slice(0, limit);
  }
  return (buckets[source] || []).slice(0, limit);
}

// Re-export for backward compatibility
export { createEmptyBuckets };
