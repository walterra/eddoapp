/**
 * Hook for real-time preference updates via Server-Sent Events.
 * Listens to the SSE endpoint and updates React Query cache on changes.
 */
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from './use_auth';

interface SSEConnectionState {
  isConnected: boolean;
  lastEventId: string | null;
  error: string | null;
}

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

  const [connectionState, setConnectionState] = useState<SSEConnectionState>({
    isConnected: false,
    lastEventId: null,
    error: null,
  });

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
    if (!authToken?.token || !enabled) {
      return;
    }

    cleanup();

    // EventSource doesn't support custom headers, so pass token as query param
    // This is acceptable since the connection is over HTTPS
    const url = `/api/users/preferences/stream?token=${encodeURIComponent(authToken.token)}`;

    console.log('[PreferencesStream] Connecting to SSE...');
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.addEventListener('connected', (event) => {
      console.log('[PreferencesStream] Connected:', event.data);
      setConnectionState({
        isConnected: true,
        lastEventId: event.lastEventId || null,
        error: null,
      });
    });

    eventSource.addEventListener('preference-update', (event) => {
      console.log('[PreferencesStream] Received update');
      try {
        const profile = JSON.parse(event.data);

        // Update React Query cache directly
        queryClient.setQueryData(['profile'], profile);

        // Call optional callback
        if (onUpdate) {
          onUpdate(profile);
        }

        setConnectionState((prev) => ({
          ...prev,
          lastEventId: event.lastEventId || prev.lastEventId,
        }));
      } catch (err) {
        console.error('[PreferencesStream] Failed to parse update:', err);
      }
    });

    eventSource.addEventListener('heartbeat', () => {
      // Heartbeat received, connection is healthy
    });

    eventSource.onerror = (error) => {
      console.error('[PreferencesStream] Connection error:', error);
      setConnectionState((prev) => ({
        ...prev,
        isConnected: false,
        error: 'Connection lost',
      }));

      // EventSource will automatically try to reconnect
      // We just update state to reflect the disconnection
    };

    eventSource.onopen = () => {
      setConnectionState((prev) => ({
        ...prev,
        isConnected: true,
        error: null,
      }));
    };
  }, [authToken?.token, enabled, cleanup, queryClient, onUpdate]);

  // Connect when authenticated and enabled
  useEffect(() => {
    if (isAuthenticated && enabled) {
      connect();
    } else {
      cleanup();
      setConnectionState({
        isConnected: false,
        lastEventId: null,
        error: null,
      });
    }

    return cleanup;
  }, [isAuthenticated, enabled, connect, cleanup]);

  return {
    ...connectionState,
    reconnect: connect,
  };
};
