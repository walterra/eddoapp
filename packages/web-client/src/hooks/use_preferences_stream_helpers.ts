/**
 * Helper functions for preferences stream hook
 */
import type { QueryClient } from '@tanstack/react-query';

export interface SSEConnectionState {
  isConnected: boolean;
  lastEventId: string | null;
  error: string | null;
}

export const INITIAL_CONNECTION_STATE: SSEConnectionState = {
  isConnected: false,
  lastEventId: null,
  error: null,
};

/** Build SSE URL with token */
export function buildSSEUrl(token: string): string {
  return `/api/users/preferences/stream?token=${encodeURIComponent(token)}`;
}

/** Handle connected event */
export function handleConnectedEvent(
  event: Event,
  setState: React.Dispatch<React.SetStateAction<SSEConnectionState>>,
): void {
  console.log('[PreferencesStream] Connected:', (event as MessageEvent).data);
  setState({
    isConnected: true,
    lastEventId: (event as MessageEvent).lastEventId || null,
    error: null,
  });
}

/** Handle preference update event */
export function handlePreferenceUpdate(
  event: Event,
  queryClient: QueryClient,
  onUpdate?: (profile: unknown) => void,
  setState?: React.Dispatch<React.SetStateAction<SSEConnectionState>>,
): void {
  console.log('[PreferencesStream] Received update');
  try {
    const profile = JSON.parse((event as MessageEvent).data);
    queryClient.setQueryData(['profile'], profile);

    if (onUpdate) {
      onUpdate(profile);
    }

    if (setState) {
      setState((prev) => ({
        ...prev,
        lastEventId: (event as MessageEvent).lastEventId || prev.lastEventId,
      }));
    }
  } catch (err) {
    console.error('[PreferencesStream] Failed to parse update:', err);
  }
}

/** Handle connection error */
export function handleConnectionError(
  setState: React.Dispatch<React.SetStateAction<SSEConnectionState>>,
): void {
  console.error('[PreferencesStream] Connection error');
  setState((prev) => ({
    ...prev,
    isConnected: false,
    error: 'Connection lost',
  }));
}

/** Handle connection open */
export function handleConnectionOpen(
  setState: React.Dispatch<React.SetStateAction<SSEConnectionState>>,
): void {
  setState((prev) => ({
    ...prev,
    isConnected: true,
    error: null,
  }));
}
