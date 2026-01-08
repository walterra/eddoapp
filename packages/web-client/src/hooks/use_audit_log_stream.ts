/**
 * Hook for real-time audit log updates via Server-Sent Events.
 * Listens to the SSE endpoint and maintains audit entries in React Query cache.
 */
import type { QueryClient } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { AuditLogAlpha1 } from '@eddo/core-shared';

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

/** Query key for audit log entries */
export const AUDIT_LOG_QUERY_KEY = ['audit-log'] as const;

interface UseAuditLogStreamOptions {
  /** Enable/disable the stream. Defaults to true when authenticated. */
  enabled?: boolean;
  /** Maximum number of entries to keep in memory */
  maxEntries?: number;
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

/** Create audit entry handler */
function createEntryHandler(
  queryClient: QueryClient,
  maxEntries: number,
  setState: React.Dispatch<React.SetStateAction<AuditStreamState>>,
  onEntry?: (entry: AuditEntry) => void,
): (event: MessageEvent) => void {
  return (event) => {
    try {
      const entry = JSON.parse(event.data) as AuditEntry;
      queryClient.setQueryData<AuditEntry[]>(AUDIT_LOG_QUERY_KEY, (old) => {
        return [entry, ...(old || [])].slice(0, maxEntries);
      });
      setState((prev) => ({ ...prev, lastEventId: event.lastEventId || prev.lastEventId }));
      if (onEntry) onEntry(entry);
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

/**
 * Subscribes to real-time audit log updates via SSE.
 * Maintains entries in React Query cache under ['audit-log'].
 */
export function useAuditLogStream(options: UseAuditLogStreamOptions = {}) {
  const { enabled = true, maxEntries = 20, onEntry } = options;
  const { authToken, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const [state, setState] = useState<AuditStreamState>(INITIAL_STATE);
  const eventSourceRef = useRef<EventSource | null>(null);

  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (!authToken?.token || !enabled) return;
    cleanup();

    const eventSource = new EventSource(buildAuditSSEUrl(authToken.token));
    eventSourceRef.current = eventSource;

    eventSource.addEventListener('connected', createConnectedHandler(setState));
    eventSource.addEventListener(
      'audit-entry',
      createEntryHandler(queryClient, maxEntries, setState, onEntry),
    );
    eventSource.addEventListener('heartbeat', () => {});
    eventSource.onerror = createErrorHandler(setState);
    eventSource.onopen = () => setState((prev) => ({ ...prev, isConnected: true, error: null }));
  }, [authToken?.token, enabled, cleanup, queryClient, maxEntries, onEntry]);

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
 * Hook to get audit log entries from cache.
 */
export function useAuditLogEntries(): AuditEntry[] {
  const queryClient = useQueryClient();
  return queryClient.getQueryData<AuditEntry[]>(AUDIT_LOG_QUERY_KEY) || [];
}
