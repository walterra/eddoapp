import { useId } from 'react';
import { HiOutlineX } from 'react-icons/hi';
import { useAuth } from '../../hooks/use_auth';
import { Thread } from '../chat/assistant-ui/thread';
import { AssistantPanel } from './assistant_panel';
import { AssistantThreadRuntime } from './assistant_runtime_provider';
import { AssistantStatus } from './assistant_status';
import type { AssistantConnection } from './assistant_types';
import { useAssistantSession } from './use_assistant_session';

export interface AssistantSidebarProps {
  onClose: () => void;
}
interface AuthenticatedSidebarProps extends AssistantSidebarProps {
  username: string;
  token: string;
  onSignIn: () => void;
}
const connectionLabels: Record<AssistantConnection, string> = {
  connecting: 'Connecting',
  connected: 'Live',
  reconnecting: 'Reconnecting',
  blocked: 'Access required',
};
const headerButton =
  'rounded p-1 text-neutral-500 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-neutral-400 dark:hover:bg-neutral-700';

function AssistantLoading() {
  return (
    <div aria-label="Loading assistant history" className="flex-1 space-y-4 p-4" role="status">
      {[0, 1, 2].map((index) => (
        <div className="space-y-2" key={index}>
          <div className="h-3 w-3/4 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
        </div>
      ))}
    </div>
  );
}

interface AssistantHeaderProps {
  connection: AssistantConnection;
  headingId: string;
  onClose: () => void;
}
function AssistantHeader({ connection, headingId, onClose }: AssistantHeaderProps) {
  return (
    <header className="flex items-start justify-between gap-3 border-b border-neutral-200 px-3 py-3 dark:border-neutral-700">
      <div>
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100" id={headingId}>
          Assistant
        </h2>
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          One conversation across web and Telegram
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span aria-live="polite" className="text-xs text-neutral-500 dark:text-neutral-400">
          {connectionLabels[connection]}
        </span>
        <button
          aria-label="Close assistant"
          className={headerButton}
          onClick={onClose}
          title="Close assistant (Escape)"
          type="button"
        >
          <HiOutlineX aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}

function AuthenticatedSidebar({ username, token, onClose, onSignIn }: AuthenticatedSidebarProps) {
  const { state, session } = useAssistantSession(username, token);
  const headingId = useId();
  return (
    <AssistantThreadRuntime session={session} state={state}>
      <AssistantPanel headingId={headingId} onClose={onClose}>
        <AssistantHeader connection={state.connection} headingId={headingId} onClose={onClose} />
        <AssistantStatus onSignIn={onSignIn} session={session} state={state} />
        {state.nextCursor && (
          <button
            className="text-primary-700 dark:text-primary-300 px-3 py-2 text-xs font-medium hover:bg-neutral-100 disabled:opacity-50 dark:hover:bg-neutral-700"
            disabled={state.loadingOlder}
            onClick={() => void session.loadOlder()}
            type="button"
          >
            {state.loadingOlder ? 'Loading earlier messages…' : 'Load earlier messages'}
          </button>
        )}
        {state.loading ? (
          <AssistantLoading />
        ) : (
          state.connection !== 'blocked' && (
            <Thread allowCancellation={false} maxMessageLength={8000} showReasoning={false} />
          )
        )}
      </AssistantPanel>
    </AssistantThreadRuntime>
  );
}

/** Renders the shared assistant independently of sandbox sessions and provider-key preferences. */
export function AssistantSidebar({ onClose }: AssistantSidebarProps) {
  const { authToken, logout } = useAuth();
  if (!authToken) return null;
  return (
    <AuthenticatedSidebar
      key={authToken.username}
      onClose={onClose}
      onSignIn={logout}
      token={authToken.token}
      username={authToken.username}
    />
  );
}
