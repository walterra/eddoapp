/**
 * Hook for real-time preference updates via Server-Sent Events.
 * Listens to the SSE endpoint and updates React Query cache on changes.
 */
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from './use_auth';
import {
  buildSSEUrl,
  handleConnectedEvent,
  handleConnectionError,
  handleConnectionOpen,
  handlePreferenceUpdate,
  INITIAL_CONNECTION_STATE,
  type SSEConnectionState,
} from './use_preferences_stream_helpers';

interface PreferencesStreamOptions {
  /** Enable/disable the stream. Defaults to true when authenticated. */
  enabled?: boolean;
  /** Callback when preferences are updated */
  onUpdate?: (profile: unknown) => void;
}

/**
 * Subscribes to real-time preference updates via SSE.
 * Updates the React Query ['profile'] cache when changes arrive.
 */
export const usePreferencesStream = (options: PreferencesStreamOptions = {}) => {
  const { enabled = true, onUpdate } = options;
  const { authToken, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const [connectionState, setConnectionState] =
    useState<SSEConnectionState>(INITIAL_CONNECTION_STATE);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (!authToken?.token || !enabled) return;

    cleanup();

    console.log('[PreferencesStream] Connecting to SSE...');
    const eventSource = new EventSource(buildSSEUrl(authToken.token));
    eventSourceRef.current = eventSource;

    eventSource.addEventListener('connected', (e) => handleConnectedEvent(e, setConnectionState));
    eventSource.addEventListener('preference-update', (e) =>
      handlePreferenceUpdate(e, queryClient, onUpdate, setConnectionState),
    );
    eventSource.addEventListener('heartbeat', () => {});
    eventSource.onerror = () => handleConnectionError(setConnectionState);
    eventSource.onopen = () => handleConnectionOpen(setConnectionState);
  }, [authToken?.token, enabled, cleanup, queryClient, onUpdate]);

  useEffect(() => {
    if (isAuthenticated && enabled) {
      connect();
    } else {
      cleanup();
      setConnectionState(INITIAL_CONNECTION_STATE);
    }
    return cleanup;
  }, [isAuthenticated, enabled, connect, cleanup]);

  return { ...connectionState, reconnect: connect };
};
