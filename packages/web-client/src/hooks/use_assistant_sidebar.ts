import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './use_auth';

interface AssistantVisibility {
  username?: string;
  open: boolean;
}
export interface AssistantSidebarState {
  isOpen: boolean;
  toggle: () => void;
  close: () => void;
}

/** Keeps assistant visibility independent from activity and sandbox preferences and resets on account changes. */
export function useAssistantSidebar(): AssistantSidebarState {
  const { username } = useAuth();
  const [state, setState] = useState<AssistantVisibility>({ open: false });
  useEffect(() => setState({ username, open: false }), [username]);
  const toggle = useCallback(
    () =>
      setState((previous) => ({
        username,
        open: previous.username !== username || !previous.open,
      })),
    [username],
  );
  const close = useCallback(() => setState({ username, open: false }), [username]);
  return { isOpen: Boolean(username && state.username === username && state.open), toggle, close };
}
