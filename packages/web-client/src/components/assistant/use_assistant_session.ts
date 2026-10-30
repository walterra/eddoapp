import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { createAssistantBrowserClient } from './assistant_api';
import { createAssistantPendingStore } from './assistant_pending';
import { createAssistantSession } from './assistant_session';
import {
  AssistantClientError,
  type AssistantPendingStore,
  type AssistantSession,
  type AssistantSnapshot,
} from './assistant_types';

interface AssistantSessionResult {
  state: AssistantSnapshot;
  session: AssistantSession;
}
function pendingStore(username: string): AssistantPendingStore {
  try {
    return createAssistantPendingStore(username, window.localStorage);
  } catch {
    const unavailable = (): never => {
      throw new AssistantClientError('storage');
    };
    return { read: unavailable, write: unavailable, clear: unavailable };
  }
}

/** Scopes browser memory, persistence, and subscriptions to the current authenticated account. */
export function useAssistantSession(username: string, token: string): AssistantSessionResult {
  const session = useMemo(
    () =>
      createAssistantSession({
        username,
        client: createAssistantBrowserClient({ username, token }),
        pendingStore: pendingStore(username),
      }),
    [username, token],
  );
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  useEffect(() => {
    session.start();
    return () => session.stop();
  }, [session]);
  return { state, session };
}
